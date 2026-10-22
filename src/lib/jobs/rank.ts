import { evidenceFacts, jobEvidence, type JobEvidence } from "@/lib/jobs/evidence";
import type { JobExplanation } from "@/lib/jobs/explain";
import type { JobListing } from "@/lib/jobs/types";
import type { ProfileFact } from "@/lib/profile";

/*
 * Orders the openings that passed the strict filters by evidence from the student's confirmed
 * profile, using a rule the page states in words. No scores or percentages.
 */

export const RANKING_RULE =
  "Ranked by evidence from your confirmed profile. An opening is linked to one of your own-work items when the role's own text shares a responsibility or skill with it, or when an AI fit note cites it. Openings linked to two or more items come first; those linked to fewer are marked exploratory and follow. Within each group, openings that don't ask for more experience than your profile shows come first, then those linked to more items, then those sharing more responsibility and skill areas; ties keep the search order. Your venture's industry, skills you only list, and company text the employer repeats across its listings (such as “About us”) don't count.";

// Sections that describe the company or its policies rather than the role.
const COMPANY_SECTION = /^(about (us|the company|[a-z0-9&.' ]{2,30})|who we are|our (story|mission|culture|values)|life at .*|why join .*|why .* \?|benefits|perks|what we offer|equal (employment )?opportunit.*|diversity.*|eeo.*)\s*:?$/i;
const ROLE_SECTION = /^about (the )?(role|team|job|position|opportunity)\b/i;
const sentenceKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sentences = (text: string) => text.split(/\n+|(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);

/**
 * The role's own text: company sections are skipped, and sentences the employer repeats across
 * two or more of its listings here (its standard description) are removed.
 */
export function roleText(job: JobListing, repeated: Set<string>): string {
  const kept: string[] = [];
  let skipping = false;
  for (const line of job.description.split("\n")) {
    const heading = line.trim().replace(/^[•\-–*\s]+/, "");
    if (heading.length > 0 && heading.length <= 60 && !/[.!?]$/.test(heading)) {
      if (ROLE_SECTION.test(heading)) skipping = false;
      else if (COMPANY_SECTION.test(heading)) skipping = true;
    }
    if (!skipping) kept.push(line);
  }
  return [job.title, ...sentences(kept.join("\n")).filter((s) => !repeated.has(`${job.company}|${sentenceKey(s)}`))].join("\n");
}

/** Sentences that appear in two or more listings from the same employer. */
export function repeatedSentences(jobs: JobListing[]): Set<string> {
  const seen = new Map<string, Set<string>>();
  for (const job of jobs) {
    for (const s of new Set(sentences(job.description).map(sentenceKey))) {
      const key = `${job.company}|${s}`;
      seen.set(key, (seen.get(key) ?? new Set()).add(job.id));
    }
  }
  return new Set([...seen].filter(([, ids]) => ids.size >= 2).map(([key]) => key));
}

export type RankedJob = {
  job: JobListing;
  evidence: JobEvidence;
  /** Distinct own-work profile items linked to the listing, by shared terms or AI fit notes. */
  linkedCount: number;
  /** Fewer than two linked items: shown as an exploratory match. */
  exploratory: boolean;
  experienceGap: boolean;
};

export function rankJobs(
  jobs: JobListing[],
  facts: ProfileFact[],
  explanations: Record<string, JobExplanation | undefined>,
  now: Date,
): RankedJob[] {
  const ownIds = new Set(evidenceFacts(facts).map((f) => f.id));
  const repeated = repeatedSentences(jobs);
  return jobs
    .map((job, index) => {
      const evidence = jobEvidence(roleText(job, repeated), facts, now);
      const aiIds = (explanations[job.id]?.fits ?? []).map((f) => f.factId).filter((id) => ownIds.has(id));
      const linkedCount = new Set([...evidence.linked.map((l) => l.factId), ...aiIds]).size;
      const areas = new Set(evidence.linked.flatMap((l) => l.terms)).size;
      return { job, index, evidence, linkedCount, areas, exploratory: linkedCount < 2, experienceGap: Boolean(evidence.experience?.gap) };
    })
    .sort(
      (a, b) =>
        Number(a.exploratory) - Number(b.exploratory) ||
        Number(a.experienceGap) - Number(b.experienceGap) ||
        b.linkedCount - a.linkedCount ||
        b.areas - a.areas ||
        a.index - b.index,
    )
    .map(({ job, evidence, linkedCount, exploratory, experienceGap }) => ({ job, evidence, linkedCount, exploratory, experienceGap }));
}
