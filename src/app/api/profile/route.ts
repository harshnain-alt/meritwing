import { groundProfile, InputSchema, OutputSchema, SYSTEM_PROMPT, userMessage } from "@/lib/ai/profilePrompt";
import { handleAiRequest } from "@/lib/ai/route";
import { PROFILE_LIMITS } from "@/lib/profile";

/*
 * Proposes a candidate profile from the student's resume sections and venture details, for
 * the student to edit and confirm. Facts whose quoted evidence isn't in the student's text,
 * or whose wording adds to it, are dropped. Request and response content is never logged.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, {
    name: "profile",
    maxBodyBytes: 60_000,
    input: InputSchema,
    tooLongMessage: "Your resume text is too long to read. Remove sections that aren't relevant on the first step.",
    invalidMessage: "Some information is missing or too long. Check your venture details on the second step.",
    prompt: (input) => ({
      system: SYSTEM_PROMPT,
      user: userMessage(input),
      schema: OutputSchema,
      arrayLimits: { facts: PROFILE_LIMITS.facts, suggestedRoles: 3 },
    }),
    finish: groundProfile,
  });
}
