import type { ResumeSections } from "@/lib/application";

/*
 * Rule-based resume splitter. It does not rewrite anything: every line in the
 * output is copied from the input, sorted into a section by its nearest heading.
 */

// "summary" holds profile or objective text: kept, but listed with the lines we couldn't place.
type SectionKey = "education" | "experience" | "skills" | "additional" | "summary";

// Matched against the lower-cased heading with "&" written as "and".
const HEADINGS: [SectionKey, RegExp][] = [
  ["education", /^(education|educational (background|qualifications?|details)|academic (background|qualifications?|details|profile)|academics|qualifications|education and qualifications)$/],
  ["experience", /^((relevant |work |professional |entrepreneurial |industry |internship |corporate )?experience|employment( history)?|internships?( and projects)?|projects( and internships)?|(academic|key|major|live|selected) projects|ventures( and projects)?|projects and ventures|work history|professional background|work experience and internships)$/],
  ["skills", /^((technical |core |key |relevant |it )?skills( and (interests|tools|languages|competencies|certifications))?|tools( and technologies)?|(core )?competencies|languages and skills)$/],
  ["additional", /^(((scholastic|academic|key|other) )?achievements( and awards)?|awards( and (achievements|recognition|honou?rs))?|honou?rs( and awards)?|recognition|additional( information)?|extra-?curricular( activities)?|extra-?curriculars|co-?curricular( activities)?|leadership( (experience|roles|and extra-?curriculars?))?|positions? of responsibility|responsibilities|activities|certifications?( and courses)?|courses|interests|hobbies( and interests)?|volunteering|volunteer (experience|work)|social work|publications|languages)$/],
  ["summary", /^((professional |career )?summary|(professional )?profile|(career )?objective|about me)$/],
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

function headingKey(line: string): SectionKey | null {
  const normalised = line
    .trim()
    .replace(/[:|]+$/, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!normalised || normalised.length > 45) return null;
  for (const [key, re] of HEADINGS) if (re.test(normalised)) return key;
  return null;
}

function findPhone(text: string): string {
  for (const line of text.split("\n")) {
    const match = line.match(PHONE_RE);
    if (!match) continue;
    const digits = match[0].replace(/\D/g, "");
    // Skip year ranges such as "2019 - 2023".
    if (digits.length >= 7 && digits.length <= 15 && !/^(19|20)\d{2}\D+(19|20)\d{2}$/.test(match[0].trim())) {
      return match[0].trim();
    }
  }
  return "";
}

function looksLikeName(line: string): boolean {
  const words = line.trim().split(/\s+/);
  return (
    words.length >= 1 &&
    words.length <= 5 &&
    line.length <= 50 &&
    !/[@\d|/:]/.test(line) &&
    headingKey(line) === null
  );
}

export function parseResumeText(raw: string): ResumeSections {
  const text = raw.replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));

  const sections: Record<SectionKey, string[]> = {
    education: [],
    experience: [],
    skills: [],
    additional: [],
    summary: [],
  };
  const header: string[] = [];
  let current: SectionKey | null = null;

  for (const line of lines) {
    const key = headingKey(line);
    if (key) {
      current = key;
      if (sections[key].length) sections[key].push("");
      continue;
    }
    if (current) sections[current].push(line);
    else header.push(line);
  }

  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const phone = findPhone(header.join("\n")) || findPhone(text);

  const firstContent = header.findIndex((l) => l.trim());
  const name = firstContent >= 0 && looksLikeName(header[firstContent]) ? header[firstContent].trim() : "";

  // Header lines that aren't the name and aren't only contact details.
  const unsorted = header
    .filter((line, i) => i !== firstContent || !name)
    .map((line) => {
      let rest = line;
      if (email) rest = rest.replace(email, "");
      if (phone) rest = rest.replace(phone, "");
      return rest.replace(/^[\s|•·,]+|[\s|•·,]+$/g, "").trim() ? line : "";
    });

  return {
    name,
    email,
    phone,
    education: tidy(sections.education),
    experience: tidy(sections.experience),
    skills: tidy(sections.skills),
    additional: tidy(sections.additional),
    unsorted: tidy([...unsorted, ...(sections.summary.length ? ["", ...sections.summary] : [])]),
  };
}

function tidy(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- Shared line helpers ---------- */

// Bullet symbols, including Wingdings/Symbol glyphs that PDFs extract as private-use
// characters (U+F0B7, U+F0A7, U+F076, U+F0D8, U+F0FC). Hyphens, asterisks and numbers
// need a following space so values like "-5" aren't treated as bullets.
const BULLET_RE = /^\s*(?:[•●▪◦‣∙·–➢►▸■□❖✓✔→⇒]\s*|[*-]\s+|\d+[.)]\s+)(?=\S)/;

export function isBullet(line: string): boolean {
  return BULLET_RE.test(line);
}

export function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "").trim();
}

/**
 * Finds the entry block around a line: the heading line(s) of an entry and the
 * bullets that follow it. Returns inclusive [start, end] line indexes.
 */
export function findEntryBlock(lines: string[], index: number): [number, number] {
  if (isBullet(lines[index])) return [index, index];

  // An entry's header runs until its first dated line (e.g. "MBA, 2024 – 2026"),
  // then continues through any bullets. This stops it swallowing the next entry.
  let end = index;
  let headerDated = hasYear(lines[index]);
  let seenBullet = false;
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;
    if (isBullet(line)) {
      seenBullet = true;
      end = i;
    } else if (seenBullet || headerDated) {
      break;
    } else {
      headerDated = hasYear(line);
      end = i;
      if (!headerDated && i - index >= 2) break;
    }
  }

  // If the entry has no dates of its own, the dated line just above it
  // (e.g. "Co-founder | 2024 – 2025" above the venture name) belongs to it.
  let start = index;
  const prev = lines[index - 1];
  if (!headerDated && prev?.trim() && !isBullet(prev) && hasYear(prev)) start = index - 1;

  return [start, end];
}

function hasYear(line: string): boolean {
  return /\b(19|20)\d{2}\b/.test(line);
}
