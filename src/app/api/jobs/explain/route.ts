import { groundMatches, InputSchema, MATCH_LIMITS, OutputSchema, SYSTEM_PROMPT, userMessage } from "@/lib/ai/matchPrompt";
import { handleAiRequest } from "@/lib/ai/route";

/*
 * Explains why each retrieved opening may fit the student's confirmed profile and which of
 * its stated requirements the profile doesn't support. Receives only confirmed profile facts
 * (no name or contact details) and the public listings. Content is never logged.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, {
    name: "explain",
    maxBodyBytes: 100_000,
    input: InputSchema,
    tooLongMessage: "Too much information to compare at once. Try again.",
    invalidMessage: "Confirm at least one profile fact before matches can be explained.",
    prompt: (input) => ({
      system: SYSTEM_PROMPT,
      user: userMessage(input),
      schema: OutputSchema,
      arrayLimits: { jobs: MATCH_LIMITS.jobs },
    }),
    finish: groundMatches,
  });
}
