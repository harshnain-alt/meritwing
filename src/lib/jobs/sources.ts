import employersData from "@/data/employers.json";

/*
 * Reads public employer job boards (Greenhouse Job Board API, Lever Postings API). Both are
 * documented public read-only endpoints that need no key. Only published openings are listed
 * by these APIs. Server-side only; nothing about the student is sent to them.
 */

export type Employer = {
  name: string;
  ats: "greenhouse" | "lever";
  token: string;
  sector: string;
  enabled: boolean;
  checked: string;
  disabledReason?: string;
};

export const EMPLOYERS = employersData.employers as Employer[];

/** A listing as read from a board, before filtering. */
export type RawListing = {
  id: string;
  title: string;
  company: string;
  locations: string[];
  /** Employer's employment type wording ("" when the board has none). */
  commitment: string;
  /** Team or department names, used for function matching. */
  team: string;
  workplaceRaw?: string;
  postedAt: string | null;
  /** Pay exactly as the board states it, or null. */
  salary: string | null;
  /** Greenhouse application deadline, if set (ISO). */
  deadline: string | null;
  url: string;
  applyUrl: string;
  description: string;
  /** Greenhouse lists don't include descriptions; this is the URL to fetch one. */
  detailUrl?: string;
  platform: "Greenhouse" | "Lever";
  boardUrl: string;
};

export type BoardResult =
  | { employer: Employer; ok: true; listings: RawListing[] }
  | { employer: Employer; ok: false; reason: "failed" | "timed-out"; note: string };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// Lever boards with full descriptions can take 15–20 seconds; the route's limit is 60.
const BOARD_TIMEOUT_MS = 25_000;
const CACHE_MS = 20 * 60_000;
const cache = new Map<string, { at: number; listings: RawListing[] }>();

/** Plain text from board HTML. Greenhouse content is HTML that has itself been entity-encoded. */
export function htmlToText(html: string): string {
  const decode = (s: string) =>
    s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&amp;/g, "&");
  return decode(
    decode(html)
      .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const INTERVAL: Record<string, string> = {
  "per-year-salary": "per year",
  "per-month-salary": "per month",
  "per-week-salary": "per week",
  "per-day-wage": "per day",
  "per-hour-wage": "per hour",
  "one-time": "one-time",
};

/** A pay range in the board's own currency and interval, e.g. "US$200,000 – US$230,000 per year". */
export function formatPay(min: number | undefined, max: number | undefined, currency: string | undefined, interval: string): string | null {
  if (!currency || (min === undefined && max === undefined)) return null;
  let fmt: (n: number) => string;
  try {
    const nf = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 });
    fmt = (n) => nf.format(n);
  } catch {
    fmt = (n) => `${currency} ${n.toLocaleString("en-IN")}`;
  }
  const range = min !== undefined && max !== undefined && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max)!);
  return interval ? `${range} ${interval}` : range;
}

type LeverPosting = {
  id: string;
  text: string;
  categories?: { commitment?: string; department?: string; team?: string; location?: string; allLocations?: string[] };
  workplaceType?: string;
  country?: string;
  createdAt?: number;
  hostedUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

type GreenhouseJob = {
  id: number;
  title: string;
  company_name?: string;
  location?: { name?: string };
  absolute_url: string;
  first_published?: string | null;
  updated_at?: string;
  application_deadline?: string | null;
  departments?: { name: string }[];
  content?: string;
  metadata?: { name: string; value: unknown }[] | null;
  pay_input_ranges?: { min_cents?: number; max_cents?: number; currency_type?: string }[];
};

export function fromLever(employer: Employer, postings: LeverPosting[]): RawListing[] {
  const boardUrl = `https://jobs.lever.co/${employer.token}`;
  return postings.map((p) => {
    const c = p.categories ?? {};
    const lists = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    return {
      id: `lever:${employer.token}:${p.id}`,
      title: p.text.trim(),
      company: employer.name,
      locations: c.allLocations?.length ? c.allLocations : c.location ? [c.location] : [],
      commitment: c.commitment ?? "",
      team: [c.department, c.team].filter(Boolean).join(" · "),
      workplaceRaw: p.workplaceType,
      postedAt: typeof p.createdAt === "number" ? new Date(p.createdAt).toISOString() : null,
      salary: p.salaryRange ? formatPay(p.salaryRange.min, p.salaryRange.max, p.salaryRange.currency, INTERVAL[p.salaryRange.interval ?? ""] ?? "") : null,
      deadline: null,
      url: p.hostedUrl,
      applyUrl: p.applyUrl ?? p.hostedUrl,
      description: [p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n\n").trim(),
      platform: "Lever",
      boardUrl,
    };
  });
}

export function fromGreenhouse(employer: Employer, jobs: GreenhouseJob[]): RawListing[] {
  const boardUrl = `https://boards.greenhouse.io/${employer.token}`;
  return jobs.map((j) => {
    // Some employers record the employment type as a custom field.
    const typeField = (j.metadata ?? []).find((m) => /employment type/i.test(m.name))?.value;
    const pay = j.pay_input_ranges?.[0];
    return {
      id: `greenhouse:${employer.token}:${j.id}`,
      title: j.title.trim(),
      company: employer.name,
      locations: j.location?.name ? j.location.name.split(/\s*;\s*/) : [],
      commitment: typeof typeField === "string" ? typeField : "",
      team: (j.departments ?? []).map((d) => d.name).join(" · "),
      postedAt: j.first_published ?? null,
      salary: pay
        ? formatPay(pay.min_cents !== undefined ? pay.min_cents / 100 : undefined, pay.max_cents !== undefined ? pay.max_cents / 100 : undefined, pay.currency_type, "")
        : null,
      deadline: j.application_deadline ?? null,
      url: j.absolute_url,
      // Greenhouse applications are made on the job page itself.
      applyUrl: j.absolute_url,
      description: j.content ? htmlToText(j.content) : "",
      detailUrl: `https://boards-api.greenhouse.io/v1/boards/${employer.token}/jobs/${j.id}`,
      platform: "Greenhouse" as const,
      boardUrl,
    };
  });
}

async function getJson(url: string, fetcher: Fetcher, timeoutMs: number): Promise<unknown> {
  const res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Reads one employer's board. Results are cached briefly so repeated searches don't re-download boards. */
export async function readBoard(employer: Employer, fetcher: Fetcher = fetch, now = Date.now()): Promise<BoardResult> {
  const key = `${employer.ats}:${employer.token}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return { employer, ok: true, listings: hit.listings };
  try {
    const listings =
      employer.ats === "lever"
        ? fromLever(employer, (await getJson(`https://api.lever.co/v0/postings/${employer.token}?mode=json`, fetcher, BOARD_TIMEOUT_MS)) as LeverPosting[])
        : fromGreenhouse(
            employer,
            ((await getJson(`https://boards-api.greenhouse.io/v1/boards/${employer.token}/jobs?pay_transparency=true`, fetcher, BOARD_TIMEOUT_MS)) as { jobs: GreenhouseJob[] }).jobs,
          );
    cache.set(key, { at: now, listings });
    return { employer, ok: true, listings };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      employer,
      ok: false,
      reason: timedOut ? "timed-out" : "failed",
      note: timedOut ? `No answer within ${BOARD_TIMEOUT_MS / 1000} seconds.` : `The board couldn't be read (${err instanceof Error ? err.message : "error"}).`,
    };
  }
}

/** Fetches full descriptions for Greenhouse listings, whose board lists leave them out. */
export async function withDescriptions(listings: RawListing[], fetcher: Fetcher = fetch): Promise<RawListing[]> {
  return Promise.all(
    listings.map(async (l) => {
      if (l.description || !l.detailUrl) return l;
      try {
        const job = (await getJson(l.detailUrl, fetcher, 8_000)) as GreenhouseJob;
        return { ...l, description: job.content ? htmlToText(job.content) : "", team: l.team || (job.departments ?? []).map((d) => d.name).join(" · ") };
      } catch {
        return l;
      }
    }),
  );
}
