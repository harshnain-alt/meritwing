import type { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { ProviderError, type AiRequest } from "@/lib/ai/provider";
import type { ClarifyError } from "@/lib/clarify";

/*
 * The request handling every AI route shares: configuration is checked before anything is
 * parsed or sent, the body is size-limited and validated, and only the provider, model and
 * the provider's error reason are logged, never request or response content.
 */

type AiRouteOptions<I, O, R> = {
  /** Log prefix, e.g. "clarify". */
  name: string;
  maxBodyBytes: number;
  input: z.ZodType<I>;
  /** Shown when the body is over maxBodyBytes. */
  tooLongMessage: string;
  /** Shown when the body fails validation. */
  invalidMessage: string;
  prompt: (input: I) => AiRequest<O>;
  /** Server-side checks on the validated output before it reaches the browser. */
  finish: (output: O, input: I) => R;
};

function fail(status: number, error: ClarifyError) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleAiRequest<I, O, R>(request: Request, options: AiRouteOptions<I, O, R>): Promise<Response> {
  const provider = getAiProvider();
  if ("setupError" in provider) return fail(503, provider.setupError);

  if (Number(request.headers.get("content-length") ?? 0) > options.maxBodyBytes) {
    return fail(413, { code: "too_long", retryable: false, message: options.tooLongMessage });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, { code: "invalid_input", retryable: false, message: "The request couldn't be read. Please try again." });
  }
  const parsed = options.input.safeParse(body);
  if (!parsed.success) return fail(400, { code: "invalid_input", retryable: false, message: options.invalidMessage });
  const input = parsed.data;

  try {
    const output = await provider.generate(options.prompt(input));
    return Response.json({ result: options.finish(output, input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(`[${options.name}] ${provider.id}/${provider.model}: ${err.logDetail}`);
      return fail(err.status, err.clarify);
    }
    console.error(`[${options.name}] ${provider.id}/${provider.model}: ${err instanceof Error ? err.name : "UnknownError"}`);
    return fail(502, { code: "no_result", retryable: true, message: "The AI didn't return a usable result this time. Try again." });
  }
}
