import type { ResumeSections } from "@/lib/application";

/*
 * Rule-based resume splitter. It does not rewrite anything: every line in the
 * output is copied from the input, sorted into a section by its nearest heading.
 */

type SectionKey = "education" | "experience" | "skills" | "additional";

const HEADINGS: [SectionKey, RegExp][] = [
  ["education", /^(education|academic background|academics|academic qualifications|qualifications|education (and|&) qualifications)$/],
  ["experience", /^((relevant |work |professional |entrepreneurial |industry )?experience|employment( history)?|internships?|projects|ventures|(ventures|projects) (and|&) (projects|ventures)|work history|professional background)$/],
  ["skills", /^((technical |core |key )?skills|skills (and|&) (interests|tools|languages)|tools|competencies|languages (and|&) skills)$/],
  ["additional", /^(achievements|awards|awards (and|&) achievements|achievements (and|&) awards|additional( information)?|extra-?curricular( activities)?|leadership( experience)?|positions? of responsibility|responsibilities|activities|certifications?|interests|volunteering|volunteer experience|honou?rs( (and|&) awards)?|publications)$/],
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

function headingKey(line: string): SectionKey | null {
  const normalised = line
    .trim()
    .replace(/[:|]+$/, "")
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
    unsorted: tidy(unsorted),
  };
}

function tidy(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- Shared line helpers ---------- */

const BULLET_RE = /^\s*([•●▪◦‣∙·*–-]|\d+[.)])\s+/;

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
