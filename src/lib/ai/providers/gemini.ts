import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { NO_RESULT, ProviderError, type ProviderFactory } from "@/lib/ai/provider";

/*
 * Google Gemini provider, using the official @google/genai SDK and the Interactions API.
 * Configuration, server-side only:
 *   GEMINI_API_KEY  required (from Google AI Studio)
 *   GEMINI_MODEL    optional, defaults to gemini-3.8-flash (has a free tier)
 * Requests are not stored by Google for later retrieval (store: false) and are not retried
 * automatically, so a quota error never turns into repeated requests.
 */

const DEFAULT_MODEL = "gemini-3.8-flash";

// Each task's Zod schema as JSON Schema, plus the array limits Gemini enforces itself.
const jsonSchemas = new WeakMap<object, Record<string, unknown>>();
function responseSchema(schema: z.ZodType, arrayLimits: Record<string, number> = {}): Record<string, unknown> {
  const cached = jsonSchemas.get(schema);
  if (cached) return cached;
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown> & {
    properties: Record<string, Record<string, unknown>>;
  };
  void _ignored;
  for (const [key, max] of Object.entries(arrayLimits)) {
    if (json.properties[key]) json.properties[key] = { ...json.properties[key], maxItems: max };
  }
  jsonSchemas.set(schema, json);
  return json;
}

export const createGeminiProvider: ProviderFactory = (env) => {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      setupError: {
        code: "not_configured",
        retryable: false,
        message: "AI features aren't set up on this server yet: AI_PROVIDER is “gemini” but GEMINI_API_KEY is missing.",
      },
    };
  }
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const client = new GoogleGenAI({ apiKey });

  return {
    id: "gemini",
    model,
    async generate({ system, user, schema, arrayLimits }) {
      let interaction;
      try {
        interaction = await client.interactions.create(
          {
            model,
            system_instruction: system,
            input: user,
            response_format: { type: "text", mime_type: "application/json", schema: responseSchema(schema, arrayLimits) },
            generation_config: { max_output_tokens: 4096 },
            store: false,
          },
          // The Interactions client ignores the constructor's httpOptions: timeout and retries
          // must be set per request. maxRetries 0 means one attempt only, never automatic retries.
          { timeout: 45_000, maxRetries: 0 },
        );
      } catch (err) {
        throw translate(err);
      }

      const noResult = (detail: string) => new ProviderError(NO_RESULT, 502, detail);
      if (interaction.status !== "completed") throw noResult(`interaction status=${interaction.status}`);
      let json: unknown;
      try {
        json = JSON.parse(interaction.output_text ?? "");
      } catch {
        throw noResult("output was not valid JSON");
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw noResult("output did not match the schema");
      return parsed.data;
    },
  };
};

/**
 * Maps Gemini API errors to what the student sees. Logs status and Google's reason, never content.
 * The SDK's Interactions client throws its own (unexported) error classes with a numeric `status`,
 * and other calls throw ApiError, so errors are classified by HTTP status rather than by class.
 */
function translate(err: unknown): ProviderError {
  const status =
    err instanceof ApiError ? err.status : typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : undefined;
  const name = err instanceof Error ? err.name : "UnknownError";
  if (status === undefined) {
    return new ProviderError(
      { code: "unavailable", retryable: true, message: "The AI service didn't respond. Try again in a moment." },
      502,
      `${name} (no response from the Gemini API)`,
    );
  }
  const message = err instanceof Error ? err.message : "";
  const log = `${name} status=${status}: ${message.replace(/\s+/g, " ").slice(0, 300)}`;
  // Google reports an invalid key as 400 INVALID_ARGUMENT with reason API_KEY_INVALID.
  const badKey = /API_KEY_INVALID|API key not valid|API key expired/i.test(message);

  if (badKey || status === 401 || status === 403) {
    return new ProviderError(
      { code: "auth", retryable: false, message: "The server's Gemini API key was rejected. Check the GEMINI_API_KEY environment variable." },
      503,
      log,
    );
  }
  if (status === 429) {
    return new ProviderError(
      {
        code: "rate_limited",
        retryable: true,
        message: "The AI service's free quota is used up for now. Try again later, or continue without AI.",
      },
      429,
      log,
    );
  }
  if (status === 400 || status === 404) {
    return new ProviderError(
      {
        code: "rejected",
        retryable: false,
        message: "The AI service rejected the request, for example because GEMINI_MODEL isn't available to this key. The server log has the exact reason.",
      },
      502,
      log,
    );
  }
  if (status === 503) {
    return new ProviderError(
      {
        code: "unavailable",
        retryable: true,
        message: "The AI service is busy right now. Try again in a minute, or continue without AI.",
      },
      503,
      log,
    );
  }
  return new ProviderError(
    { code: "unavailable", retryable: true, message: "The AI service didn't respond. Try again in a moment." },
    502,
    log,
  );
}
