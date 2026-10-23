import type { ApplicationData, CheckChoice, ResumeSections } from "@/lib/application";
import { findEntryBlock } from "@/lib/resumeParser";
import { entryForResume } from "@/lib/ventureEntry";

export type ResumeCheck = {
  id: "name" | "email" | "phone" | "school" | "project";
  title: string;
  explanation: string;
  answersValue: string;
  resumeValue: string;
  /** Specific differences spotted between the two versions. */
  differences: string[];
  answersOption: string;
  resumeOption: string;
  signature: string;
  /** False when the two versions agree and only a duplicate needs removing. */
  needsDecision: boolean;
  /** Used until the student chooses. */
  defaultChoice: CheckChoice;
  /** For entry overlaps: which resume section and line range the entry occupies. */
  block?: { section: keyof ResumeSections; start: number; end: number };
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function computeChecks(data: ApplicationData): ResumeCheck[] {
  const proposed = data.resume.proposed;
  if (!proposed) return [];
  const { about, experience } = data;
  const checks: ResumeCheck[] = [];

  if (about.fullName.trim() && proposed.name.trim() && norm(about.fullName) !== norm(proposed.name)) {
    checks.push(simpleCheck("name", "Your name is different", about.fullName, proposed.name));
  }
  if (
    about.email.trim() &&
    proposed.email.trim() &&
    about.email.trim().toLowerCase() !== proposed.email.trim().toLowerCase()
  ) {
    checks.push(simpleCheck("email", "Your email is different", about.email, proposed.email));
  }
  const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
  if (about.phone.trim() && proposed.phone.trim() && digits(about.phone) !== digits(proposed.phone)) {
    checks.push(simpleCheck("phone", "Your phone number is different", about.phone, proposed.phone));
  }

  const school = findMention(proposed, ["education"], about.school);
  if (school) {
    const differences: string[] = [];
    const years: string[] = school.text.match(/\b(19|20)\d{2}\b/g) ?? [];
    if (about.gradYear && years.length && !years.includes(about.gradYear)) {
      differences.push(
        `Dates: your resume shows ${[...new Set(years)].join(", ")}; your details say you graduate in ${about.gradYear}.`,
      );
    }
    if (about.programme.trim() && !norm(school.text).includes(norm(about.programme))) {
      differences.push(`Programme: you entered “${about.programme.trim()}”, which doesn't appear in this resume entry.`);
    }
    const answersValue = [about.school, about.programme, about.gradYear].filter((v) => v.trim()).join(" · ");
    const needsDecision = differences.length > 0;
    checks.push({
      id: "school",
      title: `${about.school.trim()} appears in both`,
      explanation: needsDecision
        ? "Your resume's education entry doesn't match your details. Choose which version is correct."
        : "Your resume already lists this school, so it is shown once.",
      answersValue,
      resumeValue: school.text,
      differences,
      answersOption: "Use my details",
      resumeOption: "Use my resume's entry",
      signature: JSON.stringify([answersValue, school.text]),
      needsDecision,
      // When they agree, keep the resume's fuller entry rather than showing the school twice.
      defaultChoice: needsDecision ? "answers" : "resume",
      block: school.block,
    });
  }

  // The venture's Experience entry replaces the resume's own lines about it, so it's never shown twice.
  const projectMatch = experience.entry && findMention(proposed, ["experience", "additional"], experience.entry.heading);
  if (projectMatch && experience.entry) {
    const venture = entryForResume(experience.entry);
    const answersValue = [venture.title, venture.context, ...venture.bullets.map((b) => `• ${b}`)].filter(Boolean).join("\n");
    checks.push({
      id: "project",
      title: `${venture.title} appears in both`,
      explanation:
        "Your resume already describes this venture. Choose which version to use, so it isn't shown twice or with conflicting details.",
      answersValue,
      resumeValue: projectMatch.text,
      differences: [
        "Responsibilities: compare what your resume says you did with what you told us you personally did.",
      ],
      answersOption: "Use my Experience entry from Meritwing",
      resumeOption: "Use my resume's version",
      signature: JSON.stringify([answersValue, projectMatch.text]),
      needsDecision: true,
      defaultChoice: "answers",
      block: projectMatch.block,
    });
  }

  return checks;
}

export function unresolvedChecks(data: ApplicationData, checks: ResumeCheck[]): ResumeCheck[] {
  return checks.filter((c) => c.needsDecision && data.resume.resolutions[c.id]?.signature !== c.signature);
}

/** The student's choice if it still applies, otherwise the check's default. */
export function choiceFor(data: ApplicationData, check: ResumeCheck): CheckChoice {
  const r = data.resume.resolutions[check.id];
  return r?.signature === check.signature ? r.choice : check.defaultChoice;
}

function simpleCheck(id: ResumeCheck["id"], title: string, answersValue: string, resumeValue: string): ResumeCheck {
  return {
    id,
    title,
    explanation: "What you entered and your resume disagree. Choose the correct one.",
    answersValue: answersValue.trim(),
    resumeValue: resumeValue.trim(),
    differences: [],
    answersOption: `Use “${answersValue.trim()}”`,
    resumeOption: `Use “${resumeValue.trim()}”`,
    signature: JSON.stringify([answersValue.trim(), resumeValue.trim()]),
    needsDecision: true,
    defaultChoice: "answers",
  };
}

/** The resume's own lines about the venture, if it mentions it by name. */
export function resumeMention(proposed: ResumeSections | null, name: string): string | null {
  return proposed ? (findMention(proposed, ["experience", "additional"], name)?.text ?? null) : null;
}

function findMention(
  proposed: ResumeSections,
  sections: (keyof ResumeSections)[],
  needle: string,
): { text: string; block: NonNullable<ResumeCheck["block"]> } | null {
  const target = norm(needle);
  if (target.length < 3) return null;
  for (const section of sections) {
    const lines = proposed[section].split("\n");
    const index = lines.findIndex((line) => ` ${norm(line)} `.includes(` ${target} `));
    if (index === -1) continue;
    const [start, end] = findEntryBlock(lines, index);
    return { text: lines.slice(start, end + 1).join("\n"), block: { section, start, end } };
  }
  return null;
}
