import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fixture from "@/lib/jobs/__fixtures__/bengaluru-listings-2026-10-22.json";
import { jobEvidence, profileMonths, requiredYears, workText } from "@/lib/jobs/evidence";
import { rankJobs } from "@/lib/jobs/rank";
import type { JobListing } from "@/lib/jobs/types";
import type { ProfileFact } from "@/lib/profile";

/*
 * Evidence ranking on real Bengaluru listings recorded on 22 Oct 2026 (test fixture only; the
 * app never shows it), for two fictional candidates. No network or AI requests.
 */

const NOW = new Date("2026-10-22T12:00:00Z");
const JOBS = fixture.jobs as JobListing[];
const fact = (id: string, text: string, kind: ProfileFact["kind"] = "experience", basis: ProfileFact["basis"] = "own"): ProfileFact => ({
  id, text, evidence: text, source: "venture", kind, basis,
});

const OPERATIONS = [
  fact("F1", "Operations Trainee, Example Logistics, Jun 2023 - Apr 2024"),
  fact("F2", "Tracked daily shipments in a dispatch register and followed up on delayed deliveries"),
  fact("F3", "Collected price quotes from three local wholesalers every month and chose which one to order from"),
  fact("F4", "Placed orders by phone and kept a log of orders and delivery dates"),
  fact("F5", "A tea and snacks cart for students near the hostel, run by a team of three", "experience", "context"),
  fact("F6", "Excel, Tally", "skill"),
];
const MARKETING = [
  fact("F1", "Ran the club's Instagram page and wrote weekly posts"),
  fact("F2", "Planned two campaigns to get students to sign up"),
  fact("F3", "Interviewed 20 students to understand which notes they needed"),
  fact("F4", "Wrote the monthly email newsletter for members"),
  fact("F5", "A campus club where students share and sell lecture notes", "experience", "context"),
  fact("F6", "Canva", "skill"),
];
const titlesFor = (facts: ProfileFact[]) => rankJobs(JOBS, facts, {}, NOW).map((r) => r.job.title.replace(/\s+/g, " ").trim());
const rankOf = (facts: ProfileFact[], title: RegExp) => rankJobs(JOBS, facts, {}, NOW).find((r) => title.test(r.job.title))!;

describe("two candidates on the same real listings", () => {
  const ops = titlesFor(OPERATIONS);
  const mkt = titlesFor(MARKETING);

  test("rank differently", () => {
    assert.notDeepEqual(ops, mkt);
  });
  test("the operations candidate gets operations roles first", () => {
    assert.ok(ops.slice(0, 3).every((t) => /fulfilment|logistics|operations|procurement/i.test(t)), ops.slice(0, 3).join(" | "));
    assert.ok(ops.indexOf("Procurement Specialist") < ops.indexOf("Manager - Social Media"));
  });
  test("the marketing candidate gets marketing roles first", () => {
    assert.match(mkt[0], /branding|social media|content/i);
    assert.ok(mkt.indexOf("Manager - Social Media") < mkt.indexOf("Procurement Specialist"));
  });
  test("roles with limited evidence are exploratory", () => {
    assert.equal(rankOf(OPERATIONS, /social media/i).exploratory, true);
    assert.equal(rankOf(MARKETING, /procurement specialist/i).exploratory, true);
    assert.equal(rankOf(MARKETING, /employer branding/i).exploratory, false);
  });
  test("a stated experience requirement above the profile ranks lower and is explained", () => {
    const procurement = rankOf(OPERATIONS, /deputy manager- procurement/i);
    assert.equal(procurement.experienceGap, true);
    assert.deepEqual(procurement.evidence.experience, { requiredYears: 4, profileMonths: 11, gap: true });
    assert.ok(ops.indexOf("Deputy Manager- Procurement") > ops.indexOf("Procurement Specialist"));
  });
});

describe("evidence rules", () => {
  const listing = "Manage suppliers and procurement. Track inventory and stock levels. Experience with SQL and Excel. 2+ years of experience in supply chain.";

  test("venture context alone never counts", () => {
    const e = jobEvidence(listing, [fact("F1", "An e-commerce startup handling suppliers and inventory", "experience", "context")], NOW);
    assert.equal(e.linked.length, 0);
  });
  test("a listed skill isn't evidence; it's reported as listed but not shown in use", () => {
    const e = jobEvidence(listing, [fact("F1", "Excel, SQL", "skill")], NOW);
    assert.equal(e.linked.length, 0);
    assert.deepEqual(e.listedOnly, ["Excel or spreadsheets", "SQL"]);
  });
  test("shared generic words alone don't link an item", () => {
    const e = jobEvidence("Prepare weekly reports and coordinate with teams.", [fact("F1", "Tracked weekly reports and coordinated with the team")], NOW);
    assert.equal(e.linked.length, 0);
  });
  test("an employer's name in a job line isn't read as the student's work", () => {
    assert.equal(workText(fact("F1", "Operations Trainee, Example Logistics, Jun 2023 - Apr 2024")), "Operations Trainee");
    assert.equal(workText(fact("F1", "Worked as Analyst at Example Logistics from Jun 2023 to Apr 2024")), "Worked as Analyst");
  });
  test("experience requirements and dated experience are read from the text", () => {
    assert.equal(requiredYears("We need 3-5 years of relevant experience."), 3);
    assert.equal(requiredYears("Minimum 2+ years experience in procurement"), 2);
    assert.equal(requiredYears("A 5 year plan for our brand"), null);
    assert.equal(profileMonths([fact("F1", "Intern, Example Co, Jun 2023 - Apr 2024")], NOW), 11);
  });
  test("AI fit notes add linked items to the ranking", () => {
    const job = JOBS.find((j) => /social media/i.test(j.title))!;
    const without = rankJobs([job], OPERATIONS, {}, NOW)[0];
    const fits = ["F2", "F4"].map((factId) => ({ reason: "r", factId, factText: "t", jobQuote: "q" }));
    const withNotes = rankJobs([job], OPERATIONS, { [job.id]: { fits, gaps: [], removed: 0, noDescription: false } }, NOW)[0];
    assert.equal(withNotes.linkedCount, without.linkedCount + 2);
    assert.equal(withNotes.exploratory, false);
  });
});
