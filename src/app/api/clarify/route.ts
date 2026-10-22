import { InputSchema, OutputSchema, sanitise, SYSTEM_PROMPT, userMessage } from "@/lib/ai/clarifyPrompt";
import { handleAiRequest } from "@/lib/ai/route";

/*
 * Generates up to three clarification questions about the student's own contribution.
 * The provider (AI_PROVIDER), its key and model come from server-side environment
 * variables only. Request and response content is never logged.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, {
    name: "clarify",
    maxBodyBytes: 120_000,
    input: InputSchema,
    tooLongMessage: "Your information is too long to analyse. Shorten your resume text or the job description.",
    invalidMessage: "Some information is missing or too long. Check your project details and the job description.",
    prompt: (input) => ({
      system: SYSTEM_PROMPT,
      user: userMessage(input),
      schema: OutputSchema,
      arrayLimits: { questions: 3, relevant: 4 },
    }),
    finish: (output, input) => sanitise(output, input.previous),
  });
}
