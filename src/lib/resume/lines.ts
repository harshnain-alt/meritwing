/*
 * Rules for resume lines read from a student's resume, shared by the preview, the copied
 * text and the PDF. Nothing is reworded: a trailing date is only marked so the layout can
 * align it to the right, and a bullet that a PDF extractor broke across lines is joined back.
 */

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// "December’24", "Sept 2023", "Jun. 2023", "2025", "’24"
const POINT = `(?:${MONTH}\\.?\\s*[’'‘]?\\s*\\d{2,4}|\\d{4})`;
const OPEN_END = "(?:present|current|now|till date|to date|ongoing)";
const RANGE = new RegExp(`(${POINT}\\s*(?:[-–—]|to)\\s*(?:${POINT}|${OPEN_END}))\\s*$`, "i");
// A single month and year at the end ("May 2024"); a bare year is not enough ("Report 2023").
const SINGLE = new RegExp(`(${MONTH}\\.?\\s*[’']?\\s*\\d{4})\\s*$`, "i");

/** A line that ends with a date range (or month and year), split into its text and that date. */
export function splitTrailingDate(text: string): { lead: string; date: string } | null {
  const m = text.match(RANGE) ?? text.match(SINGLE);
  if (!m) return null;
  const date = m[1].trim();
  const lead = text.slice(0, text.length - m[0].length).replace(/[\s,|·•:;–—-]+$/, "").trim();
  if (lead.length < 2 || date.length > 32) return null;
  return { lead, date };
}

const TERMINAL = /[.!?:;)\]]$/;
const isCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

/**
 * Whether a plain line is the rest of the bullet above it, broken by PDF text extraction:
 * it starts in lower case, or it is a short fragment after a bullet with no closing punctuation.
 * Lines with dates, headings in capitals and labels ending in a colon always stay separate.
 */
export function continuesBullet(bullet: string, line: string): boolean {
  const t = line.trim();
  if (!t || splitTrailingDate(t) || isCaps(t) || /:$/.test(t)) return false;
  if (/^[a-z]/.test(t)) return true;
  return !TERMINAL.test(bullet.trim()) && t.split(/\s+/).length <= 3 && !t.includes(",");
}
