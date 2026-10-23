import type { ApplicationData } from "@/lib/application";

/*
 * Shared by the AI features: input limits, the error shape every AI route returns, and the
 * scrubbing that keeps the student's name and contact details out of anything sent to AI.
 */

export const CLARIFY_LIMITS = {
  description: 15000,
  resume: 20000,
  field: 6000,
  short: 300,
} as const;

export type ClarifyErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "too_long"
  | "invalid_input"
  | "unavailable"
  | "no_result"
  | "rejected";

export type ClarifyError = { code: ClarifyErrorCode; message: string; retryable: boolean };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Ten or more digits with common separators: phone numbers, not year ranges like "2019 – 2024".
const PHONE_RE = /\+?\d(?:[\s().-]*\d){9,}/g;

export function withoutContact(text: string): string {
  return text.replace(EMAIL_RE, "[email removed]").replace(PHONE_RE, "[phone removed]");
}

/** The resume sections sent to AI features: no name or contact lines, emails and phones removed. */
export function resumeForAi(data: ApplicationData): string {
  const proposed = data.resume.proposed;
  if (!proposed) return "";
  return withoutContact(
    ([
      ["Education", proposed.education],
      ["Experience", proposed.experience],
      ["Skills", proposed.skills],
      ["Additional", proposed.additional],
    ] as const)
      .filter(([, text]) => text.trim())
      .map(([heading, text]) => `${heading}\n${text.trim()}`)
      .join("\n\n"),
  );
}
