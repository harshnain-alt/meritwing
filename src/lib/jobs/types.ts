/*
 * Shared between the browser and the job routes: the student's job preferences, a retrieved
 * opening, and the report of which sources were searched. Every listing comes from a live
 * request to a source; nothing here is generated.
 */

export type EmploymentPreference = "internship" | "full-time" | "either";
/** "onsite": on-site or hybrid roles; "remote": remote roles only; "any": both. */
export type WorkplacePreference = "onsite" | "remote" | "any";

export type JobPreferences = {
  employmentType: EmploymentPreference | "";
  /** Function ids from FUNCTIONS. */
  roles: string[];
  /** City ids from CITIES, or "anywhere" for anywhere in India. */
  locations: string[];
  workplace: WorkplacePreference | "";
  /** Also show India-based roles whose listing names no city. Off unless the student turns it on. */
  includeCityNotStated: boolean;
};

export type EmploymentType = "internship" | "full-time" | "not-stated";
export type Workplace = "onsite" | "hybrid" | "remote" | "not-stated";

/** One preference the opening met, and the listing text that met it. */
export type MatchCriterion = { label: string; detail: string };

export type JobListing = {
  /** Stable id: platform, board token and the board's own job id. */
  id: string;
  title: string;
  company: string;
  locations: string[];
  employmentType: EmploymentType;
  /** The employer's own wording, e.g. "Full Time Employee", or "" when the board gives none. */
  employmentTypeText: string;
  workplace: Workplace;
  /** ISO date the board says the opening was first published or created, or null if not given. */
  postedAt: string | null;
  /** The employer's own page for the opening. */
  url: string;
  applyUrl: string;
  source: { platform: "Greenhouse" | "Lever"; employer: string; boardUrl: string };
  retrievedAt: string;
  /** Plain-text description from the employer's board, capped in length. */
  description: string;
  /** Why it passed the filters: one entry per preference it met. */
  criteria: MatchCriterion[];
  /** Whether the student's role interest appears in the title (ranked first) or only in the team/department. */
  roleInTitle: boolean;
};

export type SourceStatus = "ok" | "failed" | "timed-out" | "disabled";

export type SourceReport = {
  employer: string;
  platform: "Greenhouse" | "Lever";
  boardUrl: string;
  status: SourceStatus;
  /** Open listings on the board. */
  found: number;
  /** Of those, India-based. */
  inIndia: number;
  /** Of those, matching every preference. */
  matched: number;
  note?: string;
};

/** How many listings each filter removed, so the student can see why results are few. */
export type FilterCounts = {
  fetched: number;
  outsideIndia: number;
  closed: number;
  wrongType: number;
  otherFunctions: number;
  otherLocations: number;
  cityNotStated: number;
  workplace: number;
  /** Technical or specialist titles (engineer, designer, editor…). */
  specialist: number;
  tooSenior: number;
  duplicates: number;
  shown: number;
};

export type JobSearchResult = {
  jobs: JobListing[];
  sources: SourceReport[];
  counts: FilterCounts;
  searchedAt: string;
};

/** Sources that were considered but aren't connected, and what they need. Shown to the student. */
export const NOT_CONNECTED = [
  { name: "Adzuna", reason: "Needs an Adzuna developer key, and India support isn't confirmed in Adzuna's documentation." },
  {
    name: "LinkedIn (via Apify)",
    reason: "Needs an Apify API token on the server and a spending limit; LinkedIn's terms restrict automated collection.",
  },
  { name: "Naukri, Internshala, Unstop, Indeed", reason: "No permitted public API." },
] as const;
