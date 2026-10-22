/*
 * Splits an employer's plain-text description into the parts the details panel shows:
 * responsibilities and requirements, using the employer's own headings. Wording is unchanged;
 * when no headings are recognised, the panel shows the full description instead.
 */

const RESPONSIBILITIES = /(responsibilit|what you('|’)?ll do|what you will do|what you('|’)?ll be doing|you will|your role|the role|role overview|about the role|key (result|area|deliverable)|day[ -]to[ -]day|duties|what the job involves|job description|in this role)/i;
const REQUIREMENTS = /(requirement|qualification|what you('|’)?ll need|what we('|’)?re looking for|who you are|you have|you bring|must[ -]have|nice[ -]to[ -]have|skills|experience|eligibility|criteria|preferred|about you|what you bring|we('|’)?d love)/i;

export type JobSections = { responsibilities: string[]; requirements: string[] };

const isHeading = (line: string) => {
  const t = line.trim();
  return t.length > 2 && t.length <= 80 && !/^[•\-–*]/.test(t) && (!/[.!?;,]$/.test(t) || /:$/.test(t));
};

export function jobSections(description: string): JobSections {
  const out: JobSections = { responsibilities: [], requirements: [] };
  let current: keyof JobSections | null = null;
  for (const raw of description.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line)) {
      // Requirements headings often also mention the role ("What you'll need for the role"), so check them first.
      current = REQUIREMENTS.test(line) ? "requirements" : RESPONSIBILITIES.test(line) ? "responsibilities" : null;
      continue;
    }
    if (current) {
      const item = line.replace(/^[•\-–*]\s*/, "").trim();
      if (item.length > 3 && out[current].length < 14) out[current].push(item);
    }
  }
  return out;
}
