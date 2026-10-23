import type { ApplicationData } from "@/lib/application";
import { resumeForAi, withoutContact } from "@/lib/clarify";
import type { JobPreferences } from "@/lib/jobs/types";
import { isBullet, stripBullet } from "@/lib/resumeParser";
import { splitItems } from "@/lib/resumePreview";
import { bulletText, ventureWork } from "@/lib/ventureEntry";

/*
 * The candidate profile: short facts drawn from the student's resume and venture details,
 * each with the exact words it came from. The student edits and confirms them before any
 * job matching uses them. Shared by the browser and /api/profile.
 */

export type FactSource = "resume" | "venture";
export type FactKind = "experience" | "achievement" | "skill" | "education";

/** Where a profile item came from, as the student sees it. */
export const FACT_SOURCE_LABEL = { resume: "From your resume", venture: "From your venture details", student: "Added by you" } as const;

export type ProfileFact = {
  id: string;
  /** Short statement shown to the student. */
  text: string;
  /** The exact words from the resume or venture details it rests on ("" for facts the student added). */
  evidence: string;
  source: FactSource | "student";
  kind: FactKind;
  /**
   * "own": something the student did (resume lines, their venture contributions or results, or
   * added by them). "context": what the venture was about; never counted as the student's work.
   */
  basis: "own" | "context";
};

export type ProfileInput = {
  resume: string;
  venture: { name: string; about: string; personal: string; results: string; resultsOwnership: string };
};

export type FoundPreferences = {
  employmentType?: { value: "internship" | "full-time"; quote: string };
  locations?: { values: string[]; quote: string };
  workplace?: { value: "onsite" | "remote"; quote: string };
};

export type ProfileResult = {
  facts: ProfileFact[];
  /** Function ids the AI suggests, with its reason. Shown as suggestions only. */
  suggestedRoles: { id: string; reason: string }[];
  found: FoundPreferences;
  /** Facts the server dropped because their quoted words weren't in the student's text. */
  removed: number;
};

export const PROFILE_LIMITS = { facts: 12, factText: 300, resume: 20000, field: 6000 } as const;

export function buildProfileInput(data: ApplicationData): ProfileInput {
  const e = data.experience;
  const work = ventureWork(e);
  return {
    resume: resumeForAi(data),
    venture: {
      name: (e.entry?.heading ?? e.projectName).trim(),
      about: withoutContact((e.entry?.description ?? e.about).trim()),
      personal: withoutContact(work.personal),
      // Team results from the entry, kept apart from the student's own work.
      results: withoutContact(work.results),
      resultsOwnership: work.resultsAttribution,
    },
  };
}

export const profileFingerprint = (input: ProfileInput) => JSON.stringify(input);

/**
 * A profile made only from the student's own lines, used when AI isn't available: their venture
 * entry (own work, and team results marked as such), resume experience lines and skills, unchanged.
 */
export function profileFromOwnWords(data: ApplicationData): ProfileFact[] {
  const e = data.experience;
  const facts: ProfileFact[] = [];
  const add = (text: string, source: FactSource, kind: FactKind) => {
    const t = text.trim();
    if (t && facts.length < PROFILE_LIMITS.facts) facts.push({ id: `F${facts.length + 1}`, text: t, evidence: t, source, kind, basis: "own" });
  };
  const work = ventureWork(e);
  splitItems(work.personal).forEach((t) => add(t, "venture", "experience"));
  splitItems(work.results).forEach((t) => add(bulletText({ text: t, kind: "team" }), "venture", "achievement"));
  const proposed = data.resume.proposed;
  if (proposed) {
    proposed.experience
      .split("\n")
      .filter(isBullet)
      .map(stripBullet)
      .forEach((t) => add(t, "resume", "experience"));
    if (proposed.skills.trim()) add(proposed.skills.replace(/\s*\n\s*/g, ", "), "resume", "skill");
  }
  return facts;
}

export const EMPTY_PREFERENCES: JobPreferences = {
  employmentType: "",
  roles: [],
  locations: [],
  workplace: "",
  includeCityNotStated: false,
};
