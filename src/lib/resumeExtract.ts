import { GRAD_YEARS, type AboutData, type ResumeSections } from "@/lib/application";
import { normalise, SCHOOL_OPTIONS } from "@/lib/options";
import { findEntryBlock, isBullet } from "@/lib/resumeParser";
import { INDIAN_REGIONS } from "@/lib/states";

/*
 * Picks About details out of the sorted resume sections, using simple rules.
 * Only values found in the resume text are returned; nothing is guessed or reworded.
 */

const PROGRAMME_RE =
  /\b(Executive MBA|EPGP|PGPM|PGDBM|PGDM|PGP|MBA|MiM|Master of Business Administration|Post[- ]?Graduate (?:Diploma|Programme|Program) in [A-Za-z &]+|BBA|BBM|BMS)\b/;

const INSTITUTION_RE = /\b(school|institute|university|college|academy|iim|iit)\b/i;

export function detailsFromResume(sections: ResumeSections): Partial<AboutData> {
  const found: Partial<AboutData> = {};
  if (sections.name.trim()) found.fullName = sections.name.trim();
  if (sections.email.trim()) found.email = sections.email.trim();
  if (sections.phone.trim()) found.phone = sections.phone.trim();

  const education = sections.education.split("\n");
  const school = findSchool(education);
  if (school) {
    found.school = school.value;
    const [start, end] = findEntryBlock(education, school.line);
    const block = education.slice(start, end + 1).join("\n");
    const programme = block.match(PROGRAMME_RE)?.[1];
    if (programme) found.programme = programme;
    const years = (block.match(/\b(19|20)\d{2}\b/g) ?? []).filter((y) => GRAD_YEARS.includes(y));
    if (years.length) found.gradYear = years.sort().at(-1);
  }

  // A state or union territory named in the header lines (e.g. "Pune, Maharashtra").
  const header = ` ${normalise(sections.unsorted)} `;
  const region = INDIAN_REGIONS.find((r) => header.includes(` ${normalise(r.name)} `));
  if (region) found.state = region.name;

  return found;
}

/**
 * A known school from the list wherever it appears in the education section;
 * otherwise the first line that names an institution, exactly as written.
 */
function findSchool(lines: string[]): { value: string; line: number } | null {
  let best: { value: string; line: number; length: number } | null = null;
  for (const [i, line] of lines.entries()) {
    const text = ` ${normalise(line)} `;
    for (const option of SCHOOL_OPTIONS) {
      // Full names, plus distinctive abbreviations such as "IIM Ahmedabad" or "SPJIMR".
      for (const name of [option.label, ...(option.aliases ?? [])].map(normalise)) {
        if (name.length >= 4 && text.includes(` ${name} `) && (!best || name.length > best.length)) {
          best = { value: option.value, line: i, length: name.length };
        }
      }
    }
  }
  if (best) return { value: best.value, line: best.line };

  const index = lines.findIndex((l) => l.trim() && !isBullet(l) && INSTITUTION_RE.test(l));
  if (index === -1) return null;
  // Keep only the institution part of a line like "London Business School, MBA 2024 – 2026".
  const value = lines[index].split(/\s[|–—-]\s|,\s*(?=(?:MBA|PGDM|PGP|BBA|MiM|BSc|BA|BCom|B\.|M\.|19|20))/)[0].trim();
  return value ? { value, line: index } : null;
}
