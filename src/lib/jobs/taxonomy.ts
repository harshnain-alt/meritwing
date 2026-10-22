import type { EmploymentType, Workplace } from "@/lib/jobs/types";

/*
 * The transparent matching rules: which words in a listing count as each function, city and
 * seniority level. Matching is by whole words in the employer's own title, team and location.
 * Shared by the search route (to filter) and the page (to show the options).
 */

/** exclude: phrases that contain a keyword but belong to another kind of role ("people operations"). */
export type JobFunction = { id: string; label: string; keywords: string[]; exclude?: string[] };

export const FUNCTIONS: JobFunction[] = [
  {
    id: "operations",
    label: "Operations",
    keywords: ["operations", "ops", "fulfilment", "fulfillment", "last mile", "warehouse", "process excellence", "business operations", "central operations"],
    exclude: ["people operations", "security operations", "it operations", "network operations", "devops", "dev ops", "secops"],
  },
  {
    id: "supply-chain",
    label: "Supply chain & procurement",
    keywords: ["supply chain", "procurement", "sourcing", "logistics", "inventory", "demand planning", "supply planning", "vendor management", "category"],
  },
  {
    id: "growth",
    label: "Growth",
    keywords: ["growth", "user acquisition", "acquisition", "retention", "lifecycle", "performance marketing", "monetisation", "monetization"],
  },
  {
    id: "marketing",
    label: "Marketing & brand",
    keywords: ["marketing", "brand", "content", "social media", "communications", "campaign", "pr", "community manager", "community marketing"],
  },
  {
    id: "sales",
    label: "Sales & partnerships",
    keywords: ["sales", "business development", "partnerships", "partnership", "account executive", "account manager", "key account", "relationship manager", "merchant", "alliances"],
  },
  {
    id: "strategy",
    label: "Strategy & business analysis",
    keywords: ["strategy", "strategic", "business analyst", "chief of staff", "consulting", "business finance", "program manager", "programme manager", "planning", "insights"],
  },
  {
    id: "product",
    label: "Product",
    keywords: ["product manager", "product management", "product analyst", "product operations", "product associate", "product marketing"],
  },
  {
    id: "finance",
    label: "Finance",
    keywords: ["finance", "fp&a", "treasury", "audit", "accounting", "controller", "investor relations", "risk"],
  },
  {
    id: "analytics",
    label: "Analytics",
    keywords: ["analytics", "analyst", "business intelligence", "data analyst", "decision science", "insights"],
  },
  {
    id: "people",
    label: "People & HR",
    keywords: ["hr", "human resources", "people", "talent acquisition", "recruiter", "recruiting", "hrbp"],
  },
  {
    id: "customer",
    label: "Customer success & experience",
    keywords: ["customer success", "customer experience", "customer support", "client success", "support operations"],
  },
];

export type City = { id: string; label: string; patterns: string[] };

export const CITIES: City[] = [
  { id: "bengaluru", label: "Bengaluru", patterns: ["bengaluru", "bangalore"] },
  { id: "mumbai", label: "Mumbai", patterns: ["mumbai", "navi mumbai", "thane", "bombay"] },
  { id: "delhi-ncr", label: "Delhi NCR", patterns: ["delhi", "new delhi", "gurgaon", "gurugram", "noida", "ncr", "faridabad", "ghaziabad"] },
  { id: "pune", label: "Pune", patterns: ["pune"] },
  { id: "hyderabad", label: "Hyderabad", patterns: ["hyderabad"] },
  { id: "chennai", label: "Chennai", patterns: ["chennai"] },
  { id: "kolkata", label: "Kolkata", patterns: ["kolkata", "calcutta"] },
  { id: "ahmedabad", label: "Ahmedabad", patterns: ["ahmedabad", "gandhinagar"] },
  { id: "jaipur", label: "Jaipur", patterns: ["jaipur"] },
];
export const ANYWHERE_IN_INDIA = "anywhere";

const INDIA_WORDS = ["india", ...CITIES.flatMap((c) => c.patterns), "karnataka", "maharashtra", "telangana", "tamil nadu", "haryana", "uttar pradesh", "west bengal", "gujarat", "rajasthan", "kerala", "kochi", "coimbatore", "chandigarh", "indore", "lucknow"];

/** Lower-case text with punctuation as spaces, padded so phrases match on word boundaries. */
export const words = (s: string) => ` ${s.toLowerCase().replace(/&/g, " & ").replace(/[^a-z0-9&]+/g, " ").trim()} `;
export const hasPhrase = (text: string, phrase: string) => words(text).includes(words(phrase));

export function isInIndia(location: string): boolean {
  return INDIA_WORDS.some((w) => hasPhrase(location, w));
}
export function cityOf(location: string): City | undefined {
  return CITIES.find((c) => c.patterns.some((p) => hasPhrase(location, p)));
}
export function isRemoteText(location: string): boolean {
  return hasPhrase(location, "remote") || hasPhrase(location, "work from home") || hasPhrase(location, "wfh");
}

/** The first keyword of the function found in the text, or null. Excluded phrases don't count. */
export function functionKeyword(fn: JobFunction, text: string): string | null {
  const cleaned = (fn.exclude ?? []).reduce((t, phrase) => words(t).replace(words(phrase), " ").trim(), text);
  return fn.keywords.find((k) => hasPhrase(cleaned, k)) ?? null;
}

// Technical and specialist titles that business-school candidates aren't hired into through these functions.
const SPECIALIST = /\b(engineer|engineering|developer|sde|programmer|administrator|designer|illustrator|video editor|editor|architect|devops|qa|tester|technician|scientist|counsel|attorney|lawyer|paralegal|nurse|driver|mechanic)\b/i;
export function specialistTitle(title: string): string | null {
  return title.match(SPECIALIST)?.[0] ?? null;
}

/** Internship from the title or the employer's employment type; full-time when the board says so. */
export function employmentTypeOf(title: string, commitment: string): EmploymentType {
  if (/\bintern(ship)?s?\b/i.test(title) || /\bintern(ship)?\b/i.test(commitment)) return "internship";
  if (/full[\s-]?time|permanent|trainee/i.test(commitment) || /\b(management|graduate) trainee\b/i.test(title)) return "full-time";
  return "not-stated";
}

export function workplaceOf(raw: string | undefined, locationText: string): Workplace {
  const w = (raw ?? "").toLowerCase();
  if (w === "remote" || isRemoteText(locationText)) return "remote";
  if (w === "hybrid" || hasPhrase(locationText, "hybrid")) return "hybrid";
  if (w === "onsite" || w === "on-site") return "onsite";
  return "not-stated";
}

// Titles for experienced hires. "Chief of Staff" is kept: business-school graduates are hired into it.
const SENIOR = /\b(senior|sr|lead|leader|head|principal|staff|director|vp|vice president|avp|svp|evp|cxo|cfo|coo|cmo|cto|general manager|gm|cluster head|manager ii|manager iii|manager 2|manager 3)\b/i;
export function tooSenior(title: string): string | null {
  if (/\bchief of staff\b/i.test(title)) return null;
  return title.match(SENIOR)?.[0] ?? null;
}
