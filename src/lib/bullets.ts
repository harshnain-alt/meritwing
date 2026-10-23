import type { ApplicationData, ResultsAttribution } from "@/lib/application";
import { CLARIFY_LIMITS as L, resumeForAi, withoutContact } from "@/lib/clarify";
import { splitItems } from "@/lib/resumePreview";
import { ventureWork } from "@/lib/ventureEntry";

/*
 * Shared between the browser and /api/bullets: what is sent to write AI resume bullets for
 * the venture's Experience entry, the numbered facts the bullets must cite, and what comes back.
 * The student's name and contact details are never sent.
 */

export type BulletsInput = {
  internship: { title: string; company: string; description: string };
  project: {
    name: string;
    about: string;
    personal: string;
    results: string;
    resultsOwnership: ResultsAttribution;
  };
  /** Answers to follow-up questions. The app no longer asks any, so it always sends none. */
  followUps: { question: string; answer: string }[];
  /** Resume sections, contact details removed. Background only: never a source for a bullet. */
  resume: string;
};

export const BULLET_LIMITS = { followUps: 8, question: 600, answer: 2000, bullets: 5 } as const;

export type FactKind = "context" | "personal" | "result" | "answer";

/** One confirmed fact a bullet can be based on. Ids are stable for the same input. */
export type BulletFact = { id: string; kind: FactKind; text: string; question?: string };

export type BulletKind = "personal" | "team";

export type ResumeBullet = { id: string; text: string; kind: BulletKind; sources: string[] };

export type BulletsResult = {
  bullets: ResumeBullet[];
  /** Suggestions dropped by the server because they contained something not in the facts. */
  removed: number;
  /** The unsupported details that caused the removals, for the student to see. */
  removedTerms: string[];
};

/** Splits text into items on line breaks or bullets, then into sentences, keeping the wording. */
function sentences(text: string): string[] {
  return splitItems(text).flatMap((item) => item.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/).map((s) => s.trim())).filter(Boolean);
}

/** The facts a bullet may cite: C (project context), P (personal), R (results), A (answers). */
export function bulletFacts(input: BulletsInput): BulletFact[] {
  const facts: BulletFact[] = [];
  if (input.project.about.trim()) facts.push({ id: "C1", kind: "context", text: input.project.about.trim() });
  sentences(input.project.personal).forEach((text, i) => facts.push({ id: `P${i + 1}`, kind: "personal", text }));
  sentences(input.project.results).forEach((text, i) => facts.push({ id: `R${i + 1}`, kind: "result", text }));
  input.followUps.forEach((f, i) => facts.push({ id: `A${i + 1}`, kind: "answer", text: f.answer.trim(), question: f.question }));
  return facts;
}

/** From the venture entry the student reviewed and added: their own work, and team results kept apart. */
export function buildBulletsInput(data: ApplicationData): BulletsInput {
  const { experience, internship } = data;
  const work = ventureWork(experience);
  const results = withoutContact(work.results);
  return {
    internship: {
      title: internship.title.trim(),
      company: internship.company.trim(),
      description: internship.description.trim(),
    },
    project: {
      name: (experience.entry?.heading ?? experience.projectName).trim(),
      about: withoutContact((experience.entry?.description ?? experience.about).trim()),
      personal: withoutContact(work.personal),
      results,
      resultsOwnership: results ? work.resultsAttribution : "",
    },
    followUps: [],
    resume: resumeForAi(data),
  };
}

/** Identifies the facts the bullets were written from, so later edits can mark them outdated. */
export function bulletsFingerprint(input: BulletsInput): string {
  return JSON.stringify(input);
}

/** Which inputs are over the limits the server accepts, in words the student can act on. */
export function bulletsOverLimit(input: BulletsInput): string | null {
  if (input.internship.description.length > L.description)
    return `The job description is too long (${input.internship.description.length.toLocaleString()} characters; the limit is ${L.description.toLocaleString()}). Remove anything that isn't part of the posting.`;
  if (input.resume.length > L.resume)
    return `Your resume text is too long (${input.resume.length.toLocaleString()} characters; the limit is ${L.resume.toLocaleString()}). Remove sections that aren't relevant on the first step.`;
  for (const [label, value] of [
    ["What the venture does", input.project.about],
    ["What you personally did", input.project.personal],
    ["Team results", input.project.results],
  ] as const) {
    if (value.length > L.field) return `“${label}” is too long (${value.length.toLocaleString()} characters; the limit is ${L.field.toLocaleString()}).`;
  }
  return null;
}
