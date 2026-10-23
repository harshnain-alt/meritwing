import type { JobEvidence } from "@/lib/jobs/evidence";
import { FACT_SOURCE_LABEL, type ProfileFact } from "@/lib/profile";

/*
 * "Why this fits" for one opening, from the rule-based evidence (no AI): the student's own
 * profile items that share work with the listing, and what the listing asks for that the
 * confirmed profile doesn't show.
 */

export type FitBreakdown = {
  matched: { factId: string; text: string; source: string | null; terms: string[] }[];
  missing: string[];
};

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

export function fitBreakdown(evidence: JobEvidence, facts: ProfileFact[]): FitBreakdown {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return {
    matched: evidence.linked.map((l) => {
      const fact = byId.get(l.factId);
      return { factId: l.factId, text: l.factText, source: fact ? FACT_SOURCE_LABEL[fact.source] : null, terms: l.terms };
    }),
    missing: [
      ...(evidence.experience?.gap
        ? [
            `Asks for ${evidence.experience.requiredYears}+ years of experience; your profile shows ${
              evidence.experience.profileMonths ? `about ${evidence.experience.profileMonths} months of dated work` : "no dated work experience"
            }.`,
          ]
        : []),
      ...evidence.skillsNotShown.map((s) => `${cap(s)} is named in the listing but not shown in your profile.`),
      ...evidence.listedOnly.map((s) => `${cap(s)}: you list it, but your profile doesn't show you using it.`),
    ],
  };
}
