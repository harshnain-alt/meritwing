/*
 * Suggests the internship title and company from a pasted job description, using simple
 * rules. Suggestions are copied from the text as written and are always editable.
 */

const ROLE_WORDS =
  /\b(intern|internship|trainee|analyst|associate|executive|manager|consultant|specialist|coordinator|lead|officer|engineer|designer|developer|apprentice|fellow)\b/i;

const LABELLED_TITLE = /^\s*(?:job\s*title|position|role|title|designation|opening)\s*[:–—-]\s*(.{2,90})$/im;
const LABELLED_COMPANY = /^\s*(?:company|company name|organi[sz]ation|employer|hiring company)\s*[:–—-]\s*(.{2,80})$/im;
const ABOUT_COMPANY = /^\s*about\s+(?!the\b|us\b|you\b|this\b|our\b|the role|the job|the team)(.{2,60}?)\s*:?\s*$/im;
const IS_HIRING = /\b([A-Z][\w&.'-]*(?:\s+(?:[A-Z][\w&.'-]*|&|of|and)){0,5})\s+is\s+(?:hiring|looking for|seeking|recruiting)\b/;

function tidy(value: string): string {
  return value
    .replace(/\s*\((?:remote|hybrid|on-?site|full[- ]time|part[- ]time|paid|unpaid)[^)]*\)\s*$/i, "")
    .replace(/[\s.,;:|–—-]+$/, "")
    .trim();
}

export function suggestJobDetails(description: string): { title: string; company: string } {
  const text = description.replace(/\r\n?/g, "\n");
  let title = text.match(LABELLED_TITLE)?.[1] ?? "";
  let company = text.match(LABELLED_COMPANY)?.[1] ?? "";

  const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  if (firstLine.length <= 100) {
    // "Supply Chain Intern at Northwind Foods", "Growth Intern | Acme", "Operations Intern – Acme Ltd"
    const split = firstLine.match(/^(.+?)\s+(?:at|@|\||–|—|-)\s+(.+)$/i);
    if (split && ROLE_WORDS.test(split[1])) {
      title ||= split[1];
      company ||= split[2];
    } else if (ROLE_WORDS.test(firstLine) && !/[.!?]$/.test(firstLine) && firstLine.split(/\s+/).length <= 10) {
      title ||= firstLine;
    }
  }

  company ||= text.match(ABOUT_COMPANY)?.[1] ?? text.match(IS_HIRING)?.[1] ?? "";

  return { title: tidy(title), company: tidy(company) };
}
