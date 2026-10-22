import { getClarifyProvider } from "@/lib/ai";
import { InputSchema, sanitise, SYSTEM_PROMPT, userMessage } from "@/lib/ai/clarifyPrompt";
import { ProviderError } from "@/lib/ai/provider";
import type { ClarifyError } from "@/lib/clarify";

/*
 * Generates up to three clarification questions about the student's own contribution.
 * The provider (AI_PROVIDER), its key and model come from server-side environment
 * variables only. Request and response content is never logged.
 */

export const maxDuration = 60;

const MAX_BODY_BYTES = 120_000;

function fail(status: number, error: ClarifyError) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  // Check configuration first, so nothing is parsed or sent when AI isn't set up.
  const provider = getClarifyProvider();
  if ("setupError" in provider) return fail(503, provider.setupError);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return fail(413, { code: "too_long", retryable: false, message: "Your information is too long to analyse. Shorten your resume text or the job description." });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, { code: "invalid_input", retryable: false, message: "The request couldn't be read. Please try again." });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, {
      code: "invalid_input",
      retryable: false,
      message: "Some information is missing or too long. Check your project details and the job description.",
    });
  }
  const input = parsed.data;

  try {
    const output = await provider.generate({ system: SYSTEM_PROMPT, user: userMessage(input) });
    return Response.json({ result: sanitise(output, input.previous) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(`[clarify] ${provider.id}/${provider.model}: ${err.logDetail}`);
      return fail(err.status, err.clarify);
    }
    console.error(`[clarify] ${provider.id}/${provider.model}: ${err instanceof Error ? err.name : "UnknownError"}`);
    return fail(502, { code: "no_result", retryable: true, message: "We couldn't prepare questions this time. Try again." });
  }
}
