import assert from "node:assert/strict";
import { describe, test } from "node:test";
import groww from "@/lib/jobs/__fixtures__/greenhouse-groww-2026-10-22.json";
import meesho from "@/lib/jobs/__fixtures__/lever-meesho-2026-10-22.json";
import { filterListings, searchJobs } from "@/lib/jobs/search";
import { fromGreenhouse, fromLever, htmlToText, type Employer } from "@/lib/jobs/sources";
import { employmentTypeOf, FUNCTIONS, functionKeyword, specialistTitle, tooSenior } from "@/lib/jobs/taxonomy";
import type { JobPreferences } from "@/lib/jobs/types";

/*
 * Job search rules, run on real board responses recorded on 22 Oct 2026 (test fixtures only;
 * the app never shows them). No network requests.
 */

const GROWW: Employer = { name: "Groww", ats: "greenhouse", token: "groww", sector: "Fintech", enabled: true, checked: "2026-10-22" };
const MEESHO: Employer = { name: "Meesho", ats: "lever", token: "meesho", sector: "E-commerce", enabled: true, checked: "2026-10-22" };
const NOW = new Date("2026-10-22T12:00:00Z");
const listings = () => [...fromGreenhouse(GROWW, groww.jobs), ...fromLever(MEESHO, meesho.postings as Parameters<typeof fromLever>[1])];
const prefs = (p: Partial<JobPreferences>): JobPreferences => ({
  employmentType: "full-time",
  roles: ["supply-chain", "marketing"],
  locations: ["bengaluru"],
  workplace: "any",
  includeCityNotStated: false,
  ...p,
});
const titles = (kept: ReturnType<typeof filterListings>["kept"]) => kept.map((k) => k.listing.title.trim());

describe("matching rules", () => {
  test("function keywords match whole words and skip excluded phrases", () => {
    const ops = FUNCTIONS.find((f) => f.id === "operations")!;
    assert.equal(functionKeyword(ops, "Global People Operations - Systems Administrator"), null);
    assert.equal(functionKeyword(ops, "Risk Operations Manager"), "operations");
    assert.equal(functionKeyword(FUNCTIONS.find((f) => f.id === "marketing")!, "PRocurement"), null);
  });
  test("employment type comes from the title or the employer's wording", () => {
    assert.equal(employmentTypeOf("Video Editor Intern", ""), "internship");
    assert.equal(employmentTypeOf("Procurement Specialist", ""), "not-stated");
    assert.equal(employmentTypeOf("Deputy Manager", "Full Time Employee"), "full-time");
  });
  test("senior and specialist titles are recognised; Chief of Staff is kept", () => {
    assert.equal(tooSenior("Cluster Head- Last Mile"), "Cluster Head");
    assert.equal(tooSenior("Chief of Staff"), null);
    assert.equal(specialistTitle("Creative Illustrator"), "Illustrator");
  });
  test("Greenhouse's entity-encoded HTML becomes plain text", () => {
    assert.equal(htmlToText("&lt;p&gt;Own &amp;amp; run&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Vendors&lt;/li&gt;&lt;/ul&gt;"), "Own & run\n\n• Vendors");
  });
});

describe("filterListings on recorded Groww and Meesho boards", () => {
  test("keeps only India-based openings in the chosen functions, type and city", () => {
    const { kept, counts } = filterListings(listings(), prefs({}), NOW);
    const t = titles(kept);
    assert.ok(t.includes("Procurement Specialist"));
    assert.ok(t.includes("Finance Content Creator"));
    assert.ok(t.every((x) => !/intern/i.test(x)), "the internship is left out of a full-time search");
    assert.ok(!t.includes("Creative Illustrator"));
    assert.ok(counts.wrongType >= 1);
    for (const k of kept) assert.equal(k.criteria.length, 4);
  });

  test("does not widen the location: a Mumbai-only search shows no Bengaluru roles", () => {
    const { kept, counts } = filterListings(listings(), prefs({ locations: ["mumbai"] }), NOW);
    assert.ok(kept.every((k) => !/bengaluru|bangalore/i.test(k.listing.locations.join(" "))));
    assert.ok(counts.otherLocations > 0);
  });

  test("roles with no city are counted, and shown only when the student opts in", () => {
    const sales = prefs({ roles: ["sales"] });
    const off = filterListings(listings(), sales, NOW);
    assert.ok(!titles(off.kept).includes("Relationship Manager"));
    assert.equal(off.counts.cityNotStated, 1);
    const on = filterListings(listings(), { ...sales, includeCityNotStated: true }, NOW);
    assert.ok(titles(on.kept).includes("Relationship Manager"));
  });

  test("leaves out senior roles, duplicates and openings past their deadline", () => {
    const raw = listings();
    const ops = prefs({ roles: ["operations", "supply-chain"], locations: ["anywhere"] });
    const senior = filterListings(raw, ops, NOW);
    assert.ok(senior.counts.tooSenior >= 1);
    assert.ok(!titles(senior.kept).some((x) => /cluster head/i.test(x)));

    const procurement = raw.find((l) => l.title === "Procurement Specialist")!;
    const dup = filterListings([...raw, { ...procurement, id: "copy" }], ops, NOW);
    assert.equal(dup.counts.duplicates, 1);

    const closed = filterListings(raw.map((l) => (l === procurement ? { ...l, deadline: "2026-10-01T00:00:00Z" } : l)), ops, NOW);
    assert.equal(closed.counts.closed, 1);
    assert.ok(!titles(closed.kept).includes("Procurement Specialist"));
  });

  test("an internship search with no matching internships returns none rather than other roles", () => {
    const { kept } = filterListings(listings(), prefs({ employmentType: "internship", roles: ["operations", "supply-chain", "growth"], locations: ["anywhere"] }), NOW);
    assert.equal(kept.length, 0);
  });
});

describe("searchJobs", () => {
  test("reports each source's status and fetches Greenhouse descriptions", async () => {
    const broken: Employer = { name: "Broken Co", ats: "lever", token: "broken-co-test", sector: "Test", enabled: true, checked: "2026-10-22" };
    const off: Employer = { name: "Off Co", ats: "lever", token: "off-co-test", sector: "Test", enabled: false, checked: "2026-10-22", disabledReason: "Too slow." };
    const growwTest: Employer = { ...GROWW, token: "groww-search-test" };
    const fetcher = async (url: string) => {
      if (url.endsWith("/boards/groww-search-test/jobs")) return Response.json(groww);
      if (url.includes("/boards/groww-search-test/jobs/")) return Response.json({ content: "&lt;p&gt;Compare vendor quotes.&lt;/p&gt;" });
      return new Response("nope", { status: 500 });
    };
    const result = await searchJobs(prefs({}), { fetcher, now: NOW, employers: [growwTest, broken, off] });
    const status = Object.fromEntries(result.sources.map((s) => [s.employer, s.status]));
    assert.deepEqual(status, { Groww: "ok", "Broken Co": "failed", "Off Co": "disabled" });
    const procurement = result.jobs.find((j) => j.title === "Procurement Specialist")!;
    assert.equal(procurement.description, "Compare vendor quotes.");
    assert.equal(procurement.retrievedAt, NOW.toISOString());
    assert.ok(procurement.url.startsWith("https://"));
  });
});
