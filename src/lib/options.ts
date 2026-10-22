import schoolsData from "@/data/business-schools.json";
import { INDIAN_REGIONS } from "@/lib/states";

export type SearchOption = {
  value: string;
  label: string;
  detail?: string;
  /** Normalised text the search matches against: name, location and aliases. */
  search: string;
  aliases?: string[];
};

export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every word of the query must appear; names starting with the query rank first. */
export function filterOptions(options: SearchOption[], query: string): SearchOption[] {
  const q = normalise(query);
  if (!q) return options;
  const tokens = q.split(" ");
  const scored: { option: SearchOption; score: number; index: number }[] = [];
  options.forEach((option, index) => {
    if (!tokens.every((t) => option.search.includes(t))) return;
    const label = normalise(option.label);
    const score = label.startsWith(q)
      ? 0
      : ` ${option.search} `.includes(` ${q}`)
        ? 1
        : 2;
    scored.push({ option, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.option);
}

export const SCHOOL_OPTIONS: SearchOption[] = schoolsData.schools.map((s) => ({
  value: s.value,
  label: s.name,
  detail: `${s.city}, ${s.state}`,
  search: normalise([s.name, s.city, s.state, ...s.aliases].join(" ")),
  aliases: s.aliases,
}));

export const STATE_OPTIONS: SearchOption[] = [...INDIAN_REGIONS]
  .sort((a, b) => a.name.localeCompare(b.name, "en"))
  .map((r) => ({
    value: r.name,
    label: r.name,
    detail: r.kind,
    search: normalise([r.name, ...(r.aliases ?? [])].join(" ")),
  }));
