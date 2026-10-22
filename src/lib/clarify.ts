import { ATTRIBUTION_OPTIONS, type ApplicationData } from "@/lib/application";

/*
 * Shared between the browser and /api/clarify: what is sent for clarification
 * questions and what comes back. Contact details and the student's name are never sent.
 */

export type ClarifyInput = {
  internship: { title: string; company: string; description: string };
  project: {
    name: string;
    about: string;
    personal: string;
    results: string;
    /** "Mine individually", "Shared with the team", "A mix…" or "" */
    resultsOwnership: string;
  };
  /** Resume sections (education, experience, skills, additional), contact details removed. */
  resume: string;
  /** Follow-up questions already put to the student; answer null means they skipped it. */
  previous: { question: string; answer: string | null }[];
};

export const CLARIFY_LIMITS = {
  description: 15000,
  resume: 20000,
  field: 6000,
  short: 300,
  previous: 6,
} as const;

export type QuestionFocus = "ownership" | "actions" | "results";

export type ClarifyQuestion = { id: string; question: string; why: string; focus: QuestionFocus };

/** The model's reading of how the experience relates to the role. An interpretation, not a fact. */
export type RelevantPoint = { roleNeed: string; evidence: string };

export type ClarifyResult = { questions: ClarifyQuestion[]; relevant: RelevantPoint[] };

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

function withoutContact(text: string): string {
  return text.replace(EMAIL_RE, "[email removed]").replace(PHONE_RE, "[phone removed]");
}

export function buildClarifyInput(data: ApplicationData, previous: ClarifyInput["previous"] = []): ClarifyInput {
  const { experience, internship, resume } = data;
  const sections = resume.proposed
    ? ([
        ["Education", resume.proposed.education],
        ["Experience", resume.proposed.experience],
        ["Skills", resume.proposed.skills],
        ["Additional", resume.proposed.additional],
      ] as const)
        .filter(([, text]) => text.trim())
        .map(([heading, text]) => `${heading}\n${text.trim()}`)
        .join("\n\n")
    : "";

  return {
    internship: {
      title: internship.title.trim(),
      company: internship.company.trim(),
      description: internship.description.trim(),
    },
    project: {
      name: experience.projectName.trim(),
      about: withoutContact(experience.about.trim()),
      personal: withoutContact(experience.personal.trim()),
      results: withoutContact(experience.results.trim()),
      resultsOwnership: experience.results.trim()
        ? (ATTRIBUTION_OPTIONS.find((o) => o.value === experience.resultsAttribution)?.label ?? "")
        : "",
    },
    resume: withoutContact(sections),
    previous,
  };
}

/** Identifies the information the questions were based on, so edits can mark them outdated. */
export function clarifyFingerprint(input: ClarifyInput): string {
  return JSON.stringify([input.internship, input.project, input.resume]);
}

/** Which inputs are over the limits the server accepts, in words the student can act on. */
export function overLimit(input: ClarifyInput): string | null {
  const L = CLARIFY_LIMITS;
  if (input.internship.description.length > L.description)
    return `The job description is too long (${input.internship.description.length.toLocaleString()} characters; the limit is ${L.description.toLocaleString()}). Remove anything that isn't part of the posting.`;
  if (input.resume.length > L.resume)
    return `Your resume text is too long (${input.resume.length.toLocaleString()} characters; the limit is ${L.resume.toLocaleString()}). Remove sections that aren't relevant on the first step.`;
  for (const [label, value] of [
    ["What the project was about", input.project.about],
    ["What you personally did", input.project.personal],
    ["Results", input.project.results],
  ] as const) {
    if (value.length > L.field)
      return `“${label}” is too long (${value.length.toLocaleString()} characters; the limit is ${L.field.toLocaleString()}).`;
  }
  return null;
}
