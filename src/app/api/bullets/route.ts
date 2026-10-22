import { groundBullets, InputSchema, OutputSchema, SYSTEM_PROMPT, userMessage } from "@/lib/ai/bulletsPrompt";
import { handleAiRequest } from "@/lib/ai/route";
import { BULLET_LIMITS } from "@/lib/bullets";

/*
 * Writes resume bullets for the project entry from the student's confirmed facts and
 * follow-up answers, then drops any bullet with details the facts don't support.
 * The provider, key and model come from server-side environment variables only.
 * Request and response content is never logged.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, {
    name: "bullets",
    maxBodyBytes: 140_000,
    input: InputSchema,
    tooLongMessage: "Your information is too long to write bullets from. Shorten your resume text or the job description.",
    invalidMessage: "Some information is missing or too long. Check your project details, answers and the job description.",
    prompt: (input) => ({
      system: SYSTEM_PROMPT,
      user: userMessage(input),
      schema: OutputSchema,
      arrayLimits: { bullets: BULLET_LIMITS.bullets },
    }),
    finish: groundBullets,
  });
}
