import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NO_RESULT, ProviderError, type ProviderFactory } from "@/lib/ai/provider";

/*
 * Anthropic (Claude) provider. Configuration, server-side only:
 *   ANTHROPIC_API_KEY  required
 *   ANTHROPIC_MODEL    optional, defaults to claude-opus-5-5
 */

const DEFAULT_MODEL = "claude-opus-5-5";
// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export const createAnthropicProvider: ProviderFactory = (env) => {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      setupError: {
        code: "not_configured",
        retryable: false,
        message: "AI features aren't set up on this server yet: AI_PROVIDER is “anthropic” but ANTHROPIC_API_KEY is missing.",
      },
    };
  }
  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey, timeout: 50_000, maxRetries: 1 });

  return {
    id: "anthropic",
    model,
    async generate({ system, user, schema }) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          system,
          messages: [{ role: "user", content: user }],
          output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
          ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        });
      } catch (err) {
        throw translate(err);
      }
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new ProviderError(NO_RESULT, 502, `unusable response: stop_reason=${response.stop_reason}`);
      }
      return response.parsed_output;
    },
  };
};

/** Maps Anthropic SDK errors to what the student sees. Logs the API's own reason, never content. */
function translate(err: unknown): ProviderError {
  const status = err instanceof Anthropic.APIError ? err.status : undefined;
  const apiError =
    err instanceof Anthropic.APIError ? (err.error as { error?: { type?: string; message?: string } })?.error : undefined;
  const log =
    `${err instanceof Error ? err.name : "UnknownError"}${status ? ` status=${status}` : ""}` +
    (apiError?.type ? ` ${apiError.type}: ${apiError.message ?? ""}` : "");

  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError(
      { code: "auth", retryable: false, message: "The server's Anthropic API key was rejected. Check the ANTHROPIC_API_KEY environment variable." },
      503,
      log,
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ProviderError(
      { code: "rate_limited", retryable: true, message: "Too many requests right now. Wait a moment and try again." },
      429,
      log,
    );
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    return new ProviderError(
      {
        code: "rejected",
        retryable: false,
        message:
          "The AI service rejected the request, for example because the Anthropic account has no credit left or ANTHROPIC_MODEL is invalid. The server log has the exact reason.",
      },
      502,
      log,
    );
  }
  if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.APIError) {
    return new ProviderError(
      { code: "unavailable", retryable: true, message: "The AI service didn't respond. Try again in a moment." },
      502,
      log,
    );
  }
  // Includes the SDK's own error when the output fails schema validation.
  return new ProviderError(NO_RESULT, 502, log);
}
