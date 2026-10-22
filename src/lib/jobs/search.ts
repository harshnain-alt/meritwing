import { EMPLOYERS, readBoard, withDescriptions, type Employer, type Fetcher, type RawListing } from "@/lib/jobs/sources";
import {
  ANYWHERE_IN_INDIA,
  CITIES,
  FUNCTIONS,
  cityOf,
  employmentTypeOf,
  functionKeyword,
  isInIndia,
  specialistTitle,
  tooSenior,
  workplaceOf,
} from "@/lib/jobs/taxonomy";
import type { FilterCounts, JobListing, JobPreferences, JobSearchResult, MatchCriterion, SourceReport } from "@/lib/jobs/types";

/*
 * Turns raw board listings into the openings shown to the student. Every rule is a plain
 * check on the employer's own words, applied in a fixed order, and each removal is counted
 * so the page can say why results are few. Preferences are never widened automatically.
 */

export const MAX_SHOWN = 40;
const DESCRIPTION_MAX = 8_000;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const WORKPLACE_LABEL = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote", "not-stated": "Not stated by the employer" } as const;

type Kept = { listing: RawListing; criteria: MatchCriterion[]; roleInTitle: boolean; employmentType: JobListing["employmentType"]; workplace: JobListing["workplace"] };

export function filterListings(raw: RawListing[], prefs: JobPreferences, now: Date) {
  const counts: FilterCounts = {
    fetched: raw.length, outsideIndia: 0, closed: 0, wrongType: 0, otherFunctions: 0, otherLocations: 0,
    cityNotStated: 0, workplace: 0, specialist: 0, tooSenior: 0, duplicates: 0, shown: 0,
  };
  const chosenFunctions = FUNCTIONS.filter((f) => prefs.roles.includes(f.id));
  const anywhere = prefs.locations.includes(ANYWHERE_IN_INDIA);
  const chosenCities = CITIES.filter((c) => prefs.locations.includes(c.id));
  const seen = new Set<string>();
  const kept: Kept[] = [];

  for (const l of raw) {
    const indian = l.locations.filter(isInIndia);
    if (!indian.length) { counts.outsideIndia++; continue; }
    if (l.deadline && new Date(l.deadline).getTime() < now.getTime()) { counts.closed++; continue; }

    const type = employmentTypeOf(l.title, l.commitment);
    if ((prefs.employmentType === "internship" && type !== "internship") || (prefs.employmentType === "full-time" && type === "internship")) {
      counts.wrongType++;
      continue;
    }

    let fnMatch: { label: string; keyword: string; inTitle: boolean } | null = null;
    for (const fn of chosenFunctions) {
      const inTitle = functionKeyword(fn, l.title);
      if (inTitle) { fnMatch = { label: fn.label, keyword: inTitle, inTitle: true }; break; }
      const inTeam = functionKeyword(fn, l.team);
      if (inTeam && !fnMatch) fnMatch = { label: fn.label, keyword: inTeam, inTitle: false };
    }
    if (!fnMatch) { counts.otherFunctions++; continue; }

    const workplace = workplaceOf(l.workplaceRaw, indian.join(" "));
    if ((prefs.workplace === "remote" && workplace !== "remote") || (prefs.workplace === "onsite" && workplace === "remote")) {
      counts.workplace++;
      continue;
    }

    let locationDetail: string | null = null;
    if (workplace === "remote" && prefs.workplace === "remote") locationDetail = `${indian.join("; ")} (remote, India-based)`;
    else if (anywhere) locationDetail = `${indian.join("; ")} (you chose anywhere in India)`;
    else {
      const city = indian.map((loc) => ({ loc, city: cityOf(loc) })).find((x) => x.city && chosenCities.includes(x.city));
      if (city) locationDetail = `${city.loc} (matches ${city.city!.label})`;
      else if (indian.every((loc) => !cityOf(loc))) {
        if (!prefs.includeCityNotStated) { counts.cityNotStated++; continue; }
        locationDetail = `${indian.join("; ")} (no city stated; you chose to include these)`;
      }
    }
    if (!locationDetail) { counts.otherLocations++; continue; }

    if (specialistTitle(l.title)) { counts.specialist++; continue; }
    const senior = tooSenior(l.title);
    if (senior) { counts.tooSenior++; continue; }

    const key = `${norm(l.company)}|${norm(l.title)}|${indian.map(norm).sort().join(",")}`;
    if (seen.has(key) || seen.has(l.url)) { counts.duplicates++; continue; }
    seen.add(key);
    seen.add(l.url);

    kept.push({
      listing: l,
      roleInTitle: fnMatch.inTitle,
      employmentType: type,
      workplace,
      criteria: [
        { label: "Function", detail: `“${fnMatch.keyword}” in the ${fnMatch.inTitle ? "job title" : "team name"} (${fnMatch.label})` },
        { label: "Location", detail: locationDetail },
        {
          label: "Type",
          detail:
            type === "internship"
              ? `Internship${l.commitment ? ` (“${l.commitment}”)` : " (from the title)"}`
              : type === "full-time"
                ? `Full-time (“${l.commitment || l.title}”)`
                : "Not stated by the employer",
        },
        { label: "Workplace", detail: WORKPLACE_LABEL[workplace] },
      ],
    });
  }

  // Openings whose title names the student's interest first, then the newest.
  kept.sort((a, b) => Number(b.roleInTitle) - Number(a.roleInTitle) || (b.listing.postedAt ?? "").localeCompare(a.listing.postedAt ?? ""));
  return { kept, counts };
}

export async function searchJobs(
  prefs: JobPreferences,
  { fetcher = fetch, now = new Date(), employers = EMPLOYERS }: { fetcher?: Fetcher; now?: Date; employers?: Employer[] } = {},
): Promise<JobSearchResult> {
  const enabled = employers.filter((e) => e.enabled);
  const boards = await Promise.all(enabled.map((e) => readBoard(e, fetcher, now.getTime())));
  const raw = boards.flatMap((b) => (b.ok ? b.listings : []));
  const { kept, counts } = filterListings(raw, prefs, now);
  const shown = kept.slice(0, MAX_SHOWN);
  counts.shown = shown.length;

  const described = await withDescriptions(shown.map((k) => k.listing), fetcher);
  const retrievedAt = now.toISOString();
  const jobs: JobListing[] = shown.map((k, i) => ({
    id: k.listing.id,
    title: k.listing.title,
    company: k.listing.company,
    locations: k.listing.locations,
    employmentType: k.employmentType,
    employmentTypeText: k.listing.commitment,
    workplace: k.workplace,
    postedAt: k.listing.postedAt,
    url: k.listing.url,
    applyUrl: k.listing.applyUrl,
    source: { platform: k.listing.platform, employer: k.listing.company, boardUrl: k.listing.boardUrl },
    retrievedAt,
    description: described[i].description.slice(0, DESCRIPTION_MAX),
    criteria: k.criteria,
    roleInTitle: k.roleInTitle,
  }));

  const keptBy = (name: string) => kept.filter((k) => k.listing.company === name).length;
  const sources: SourceReport[] = employers.map((e) => {
    const platform = e.ats === "lever" ? "Lever" : "Greenhouse";
    const boardUrl = e.ats === "lever" ? `https://jobs.lever.co/${e.token}` : `https://boards.greenhouse.io/${e.token}`;
    if (!e.enabled) return { employer: e.name, platform, boardUrl, status: "disabled", found: 0, inIndia: 0, matched: 0, note: e.disabledReason };
    const b = boards.find((x) => x.employer === e)!;
    if (!b.ok) return { employer: e.name, platform, boardUrl, status: b.reason, found: 0, inIndia: 0, matched: 0, note: b.note };
    return {
      employer: e.name,
      platform,
      boardUrl,
      status: "ok",
      found: b.listings.length,
      inIndia: b.listings.filter((l) => l.locations.some(isInIndia)).length,
      matched: keptBy(e.name),
    };
  });

  return { jobs, sources, counts, searchedAt: retrievedAt };
}
