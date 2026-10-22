import type { ApplicationData, ResumeSections } from "@/lib/application";
import { choiceFor, type ResumeCheck } from "@/lib/resumeChecks";
import { isBullet, stripBullet } from "@/lib/resumeParser";

/*
 * Arranges the student's own wording into a resume layout.
 * Nothing here rewrites, embellishes or invents content.
 */

export type PreviewLine = { text: string; bullet: boolean };

export type PreviewEntry = {
  title: string;
  dates?: string;
  subtitle?: string;
  context?: string;
  bullets: string[];
};

export type PreviewSection = {
  heading: string;
  entries: PreviewEntry[];
  lines: PreviewLine[];
};

export type ResumePreviewModel = {
  name: string;
  contact: string[];
  sections: PreviewSection[];
};

export function buildPreview(data: ApplicationData, checks: ResumeCheck[]): ResumePreviewModel {
  const { about, experience, resume } = data;
  const proposed = resume.proposed;
  const choice = (id: ResumeCheck["id"]) => {
    const check = checks.find((c) => c.id === id);
    return check ? choiceFor(data, check) : null;
  };
  const pick = (id: ResumeCheck["id"], answers: string, fromResume: string) =>
    choice(id) === "resume" ? fromResume.trim() : answers.trim() || fromResume.trim();

  // Resume line ranges replaced by the student's answers.
  const excluded = checks.filter((c) => c.block && choice(c.id) === "answers").map((c) => c.block!);
  const resumeLines = (section: keyof ResumeSections): PreviewLine[] => {
    if (!proposed) return [];
    return proposed[section]
      .split("\n")
      .filter((_, i) => !excluded.some((b) => b.section === section && i >= b.start && i <= b.end))
      .filter((line) => line.trim())
      .map((line) => ({ text: isBullet(line) ? stripBullet(line) : line.trim(), bullet: isBullet(line) }));
  };

  const name = pick("name", about.fullName, proposed?.name ?? "");
  const contact = [
    pick("email", about.email, proposed?.email ?? ""),
    pick("phone", about.phone, proposed?.phone ?? ""),
    about.state.trim(),
  ].filter(Boolean);

  const sections: PreviewSection[] = [];

  const educationEntries: PreviewEntry[] =
    about.school.trim() && choice("school") !== "resume"
      ? [{ title: about.school.trim(), subtitle: about.programme.trim(), dates: about.gradYear, bullets: [] }]
      : [];
  sections.push({ heading: "Education", entries: educationEntries, lines: resumeLines("education") });

  if (choice("project") !== "resume") {
    const results = splitItems(experience.results);
    sections.push({
      heading: "Ventures and Projects",
      entries: [
        {
          title: experience.projectName.trim(),
          context: experience.about.trim(),
          bullets: [
            ...splitItems(experience.personal),
            ...results.map((r) => (experience.resultsAttribution === "shared" ? `Team result: ${r}` : r)),
          ],
        },
      ],
      lines: [],
    });
  }

  sections.push({ heading: "Experience", entries: [], lines: resumeLines("experience") });
  sections.push({ heading: "Skills", entries: [], lines: resumeLines("skills") });
  sections.push({
    heading: "Additional Achievements and Responsibilities",
    entries: [],
    lines: resumeLines("additional"),
  });

  return {
    name,
    contact,
    sections: sections.filter((s) => s.entries.some((e) => e.title) || s.lines.length),
  };
}

/** Splits an answer into items on line breaks or bullet characters; keeps the wording. */
function splitItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => (isBullet(line) ? stripBullet(line) : line.trim()))
    .filter(Boolean);
}
