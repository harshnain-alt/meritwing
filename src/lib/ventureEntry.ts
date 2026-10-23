import type { ExperienceData, ResultsAttribution, VentureBullet, VentureEntry } from "@/lib/application";
import { isBullet, stripBullet } from "@/lib/resumeParser";

/*
 * "Your venture" → an Experience entry. Built only from the student's three answers, with simple
 * rules and no AI, so nothing is invented: no job title, dates, numbers, tools, outcomes or
 * leadership that the student didn't write. Details they did write are kept.
 */

type Answers = Pick<ExperienceData, "projectName" | "about" | "personal">;

/** Identifies the answers an entry was drafted from, so later edits to them can be noticed. */
export const answersKey = (a: Answers) => JSON.stringify([a.projectName.trim(), a.about.trim(), a.personal.trim()]);

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Sentences that describe what the team did together rather than the student alone. */
const TEAM = /\b(we|our|us|the team)\b/i;

/** Splits an answer into lines or list items, then into sentences, keeping the wording. */
export function sentencesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => (isBullet(line) ? stripBullet(line) : line.trim()))
    .filter(Boolean)
    .flatMap((item) => item.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * One sentence of "What did you personally do?" as a resume bullet in the student's words:
 * "I collected…" → "Collected…"; sentences about "we" or "our" are kept as team results.
 */
export function toBullet(sentence: string): VentureBullet {
  const t = sentence.replace(/[.!?]+$/, "").trim();
  if (/^i\s/i.test(t)) {
    const rest = t.replace(/^i\s+(?:was|am)\s+responsible\s+for\s+/i, "responsible for ").replace(/^i\s+/i, "");
    return { text: capFirst(rest), kind: "own" };
  }
  return { text: capFirst(t), kind: TEAM.test(t) ? "team" : "own" };
}

/** Venture name as the heading, what it does as the description, what the student did as bullets. */
export function draftVentureEntry(a: Answers): VentureEntry {
  const description = a.about.trim().replace(/\s+/g, " ");
  return {
    heading: a.projectName.trim().replace(/\s+/g, " "),
    description: description && capFirst(/[.!?]$/.test(description) ? description : `${description}.`),
    bullets: sentencesOf(a.personal).map(toBullet),
  };
}

/** How a bullet reads on the resume: team bullets are marked so they're never taken as the student's own. */
export function bulletText(b: VentureBullet): string {
  return b.kind === "team" ? `Team result: ${b.text.replace(/^(We|Our|Us)\b/, (w) => w.toLowerCase())}` : b.text;
}

/** The entry as it appears on the resume: empty bullets left out. */
export function entryForResume(e: VentureEntry): { title: string; context: string; bullets: string[] } {
  return { title: e.heading.trim(), context: e.description.trim(), bullets: e.bullets.filter((b) => b.text.trim()).map((b) => bulletText({ ...b, text: b.text.trim() })) };
}

/**
 * The venture work as the profile and AI bullets read it: the student's own bullets, and team
 * results kept apart (as results shared with the team). Uses the entry they added, else the draft
 * the answers give.
 */
export function ventureWork(e: ExperienceData): { personal: string; results: string; resultsAttribution: ResultsAttribution } {
  const entry = e.entry ?? draftVentureEntry(e);
  const lines = (kind: VentureBullet["kind"]) =>
    entry.bullets
      .filter((b) => b.kind === kind && b.text.trim())
      .map((b) => b.text.trim())
      .join("\n");
  const results = lines("team");
  return { personal: lines("own"), results, resultsAttribution: results ? "shared" : "" };
}

const NUMBER = /\b\d[\d,.]*%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|lakh|crore)s?\b/gi;
const LEADERSHIP = /\b(?:led|lead|leading|managed|manage|managing|supervised|headed|oversaw|spearheaded|founded|co-founded)\b/gi;
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Details in an edited line that the answers don't contain: numbers, leadership words, and
 * capitalised names or tools mid-sentence. Shown as a note; the student decides.
 */
export function unsupportedDetails(text: string, a: Answers): string[] {
  const source = ` ${norm([a.projectName, a.about, a.personal].join(" "))} `;
  const found = [...(text.match(NUMBER) ?? []), ...(text.match(LEADERSHIP) ?? [])];
  for (const sentence of text.split(/(?<=[.!?:])\s+/)) {
    for (const word of sentence.split(/\s+/).slice(1)) {
      const w = word.replace(/[^\p{L}\p{N}+#.]/gu, "").replace(/\.$/, "");
      if (/^\p{Lu}[\p{L}\p{N}+#.]+$/u.test(w)) found.push(w);
    }
  }
  return [...new Set(found)].filter((w) => !source.includes(` ${norm(w)} `));
}
