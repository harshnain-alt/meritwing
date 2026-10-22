import { hasPhrase, words } from "@/lib/jobs/taxonomy";
import type { ProfileFact } from "@/lib/profile";

/*
 * Transparent, rule-based evidence for ranking: which of the student's confirmed own-work items
 * share responsibility or skill terms with a listing, which skills the listing names that the
 * profile doesn't show, and whether it asks for more experience than the profile's dated roles.
 * Venture context (what the venture was about) and merely listed skills never count as evidence.
 */

/** generic: common in most listings (reporting, coordination…); shown, but not enough on its own to link an item. */
export type Term = { id: string; label: string; kind: "responsibility" | "skill"; phrases: string[]; generic?: boolean };

export const TERMS: Term[] = [
  { id: "inventory", label: "inventory and stock", kind: "responsibility", phrases: ["inventory", "stock", "stocks", "stock outs", "stockouts", "stock levels"] },
  { id: "orders", label: "orders and fulfilment", kind: "responsibility", phrases: ["orders", "fulfilment", "fulfillment", "order management", "order fulfilment"] },
  { id: "logistics", label: "logistics and delivery", kind: "responsibility", phrases: ["logistics", "shipment", "shipments", "shipping", "deliveries", "delivery partners", "delivery dates", "dispatch", "courier", "couriers", "last mile", "pickup", "pickups"] },
  { id: "suppliers", label: "suppliers and procurement", kind: "responsibility", phrases: ["supplier", "suppliers", "vendor", "vendors", "wholesaler", "wholesalers", "sourcing", "procurement", "purchasing", "purchase orders", "quotes", "quotations"] },
  { id: "process", label: "processes", kind: "responsibility", phrases: ["process", "processes", "process improvement", "sop", "sops", "workflow", "workflows"], generic: true },
  { id: "planning", label: "planning and scheduling", kind: "responsibility", phrases: ["planning", "forecast", "forecasting", "scheduling", "schedule", "schedules"], generic: true },
  { id: "campaigns", label: "campaigns", kind: "responsibility", phrases: ["campaign", "campaigns"] },
  { id: "social", label: "social media", kind: "responsibility", phrases: ["social media", "instagram", "linkedin", "youtube", "whatsapp", "influencer", "influencers"] },
  { id: "content", label: "content", kind: "responsibility", phrases: ["content", "posts", "copywriting", "blog", "newsletter", "newsletters"] },
  { id: "brand", label: "brand", kind: "responsibility", phrases: ["brand", "branding"] },
  { id: "research", label: "customer research", kind: "responsibility", phrases: ["customer interviews", "user interviews", "user research", "customer research", "survey", "surveys", "customer feedback", "customer insights", "interviewed"] },
  { id: "community", label: "community and events", kind: "responsibility", phrases: ["community", "events"] },
  { id: "acquisition", label: "acquisition and conversion", kind: "responsibility", phrases: ["performance marketing", "ads", "paid marketing", "acquisition", "conversion", "conversions", "funnel", "sign ups", "signups"] },
  { id: "sales", label: "sales", kind: "responsibility", phrases: ["sales", "selling", "sold", "business development", "leads", "prospects"] },
  { id: "partnerships", label: "partners and stakeholders", kind: "responsibility", phrases: ["partnership", "partnerships", "stakeholder", "stakeholders", "merchants", "merchant"] },
  { id: "negotiation", label: "negotiation", kind: "responsibility", phrases: ["negotiate", "negotiated", "negotiation", "negotiations"] },
  { id: "service", label: "customer service", kind: "responsibility", phrases: ["customer support", "customer service", "customer success", "escalations", "complaints"] },
  { id: "pricing", label: "pricing and costs", kind: "responsibility", phrases: ["pricing", "price", "prices", "cost", "costs", "budget", "budgets", "budgeting"], generic: true },
  { id: "reporting", label: "reporting and tracking", kind: "responsibility", phrases: ["report", "reports", "reporting", "dashboard", "dashboards", "metrics", "kpi", "kpis", "tracked", "tracking", "log", "logs", "register"], generic: true },
  { id: "coordination", label: "coordination", kind: "responsibility", phrases: ["coordinate", "coordinated", "coordinating", "coordination", "cross functional"], generic: true },
  { id: "hiring", label: "hiring and training", kind: "responsibility", phrases: ["hiring", "recruiting", "recruitment", "trained", "training", "onboarding"] },
  { id: "excel", label: "Excel or spreadsheets", kind: "skill", phrases: ["excel", "spreadsheet", "spreadsheets", "google sheets", "google sheet"] },
  { id: "sql", label: "SQL", kind: "skill", phrases: ["sql"] },
  { id: "analysis", label: "data analysis", kind: "skill", phrases: ["data analysis", "analytics", "analysed", "analyzed", "analysing", "analyzing"] },
  { id: "design", label: "design tools", kind: "skill", phrases: ["canva", "figma", "photoshop"] },
  { id: "accounting", label: "accounting", kind: "skill", phrases: ["tally", "accounting", "bookkeeping", "reconciliation"] },
  { id: "presentation", label: "presentations", kind: "skill", phrases: ["presentation", "presentations", "pitch", "pitched", "pitching"] },
];

// Everyday phrases that contain a term word but mean something else.
const NOT_TERMS = ["in order to", "in order for", "stock options", "stock option", "in the event", "process of", "the process"];

export function termsIn(text: string): Set<string> {
  const cleaned = NOT_TERMS.reduce((t, phrase) => words(t).replace(words(phrase), " "), text);
  return new Set(TERMS.filter((t) => t.phrases.some((p) => hasPhrase(cleaned, p))).map((t) => t.id));
}
export const termLabel = (id: string) => TERMS.find((t) => t.id === id)?.label ?? id;

/** The smallest "N years" figure stated near the word experience, or null. */
export function requiredYears(text: string): number | null {
  const found: number[] = [];
  for (const m of text.matchAll(/(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?)?\s*(?:years?|yrs?)\b/gi)) {
    const around = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
    if (/experience/i.test(around)) found.push(Number(m[1]));
  }
  return found.length ? Math.min(...found) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const RANGE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\s*(?:-|–|to)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})|(present|current|now))/gi;

/** Months of dated work in the profile's own-work items ("Jun 2023 - Apr 2024"), or 0. */
export function profileMonths(facts: ProfileFact[], now: Date): number {
  let months = 0;
  for (const f of facts) {
    if (f.basis !== "own" || f.kind === "education") continue;
    // The statement and its quoted words usually repeat the same dates; read one of them.
    const dated = RANGE.test(f.evidence) ? f.evidence : f.text;
    RANGE.lastIndex = 0;
    for (const m of dated.matchAll(RANGE)) {
      const start = Number(m[2]) * 12 + MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
      const end = m[5] ? now.getFullYear() * 12 + now.getMonth() : Number(m[4]) * 12 + MONTHS.indexOf(m[3].toLowerCase().slice(0, 3));
      if (end >= start) months += end - start + 1;
    }
  }
  return months;
}

export type JobEvidence = {
  /** Own-work profile items that share responsibility or skill terms with the listing. */
  linked: { factId: string; factText: string; terms: string[] }[];
  /** Skills the listing names that no own-work item shows. */
  skillsNotShown: string[];
  /** Of those, skills the student lists on their resume without showing them in use. */
  listedOnly: string[];
  experience: { requiredYears: number; profileMonths: number; gap: boolean } | null;
};

/** Profile items that can count as evidence: the student's own work, not venture context or education. */
export const evidenceFacts = (facts: ProfileFact[]) => facts.filter((f) => f.basis === "own" && f.kind !== "education" && f.kind !== "skill");
const listedSkillFacts = (facts: ProfileFact[]) => facts.filter((f) => f.kind === "skill");

/**
 * The words of an item that describe the student's own work. For a dated job line
 * ("Operations Trainee, Example Logistics, Jun 2023 - Apr 2024" or "… at Example Logistics …")
 * only the role counts, so an employer's name or industry is never read as the student's skill.
 */
export function workText(fact: ProfileFact): string {
  RANGE.lastIndex = 0;
  if (!RANGE.test(fact.text)) return fact.text;
  RANGE.lastIndex = 0;
  return fact.text.split(",")[0].replace(/\s+(at|with|for)\s+.*$/i, "");
}

const isGeneric = (id: string) => TERMS.find((t) => t.id === id)?.generic === true;

export function jobEvidence(listingText: string, facts: ProfileFact[], now: Date): JobEvidence {
  const listing = termsIn(listingText);
  const own = evidenceFacts(facts);
  const linked = own
    .map((f) => ({ factId: f.id, factText: f.text, terms: [...termsIn(workText(f))].filter((t) => listing.has(t)) }))
    // Shared generic words alone (reporting, coordination…) don't link an item.
    .filter((l) => l.terms.some((t) => !isGeneric(t)))
    .map((l) => ({ ...l, terms: l.terms.map(termLabel) }));
  const shownTerms = new Set(own.flatMap((f) => [...termsIn(workText(f))]));
  const listedTerms = new Set(listedSkillFacts(facts).flatMap((f) => [...termsIn(f.text)]));
  const missing = TERMS.filter((t) => t.kind === "skill" && listing.has(t.id) && !shownTerms.has(t.id));
  const years = requiredYears(listingText);
  const months = profileMonths(facts, now);
  return {
    linked,
    skillsNotShown: missing.filter((t) => !listedTerms.has(t.id)).map((t) => t.label),
    listedOnly: missing.filter((t) => listedTerms.has(t.id)).map((t) => t.label),
    experience: years === null ? null : { requiredYears: years, profileMonths: months, gap: years * 12 > months },
  };
}
