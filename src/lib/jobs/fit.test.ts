import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { jobEvidence } from "@/lib/jobs/evidence";
import { fitBreakdown } from "@/lib/jobs/fit";
import type { ProfileFact } from "@/lib/profile";

/* "Why this fits" on job cards. All data here is fictional. */

const fact = (id: string, text: string, source: ProfileFact["source"], kind: ProfileFact["kind"] = "experience"): ProfileFact => ({
  id,
  text,
  evidence: text,
  source,
  kind,
  basis: "own",
});

const FACTS = [
  fact("v1", "I collected price quotes from three local wholesalers every month and chose which one to order from.", "venture"),
  fact("r1", "Coordinated with two suppliers on delivery schedules", "resume"),
  fact("s1", "Excel, Google Sheets", "resume", "skill"),
];

const LISTING =
  "Procurement Intern. You will compare vendor quotes, work with suppliers on delivery schedules and track purchase orders. Requirements: SQL and Excel; 2+ years of experience.";

describe("fitBreakdown", () => {
  const fit = fitBreakdown(jobEvidence(LISTING, FACTS, new Date("2026-10-23")), FACTS);

  test("lists the student's own matching items in their words, with where they wrote them", () => {
    assert.ok(fit.matched.length >= 1);
    const venture = fit.matched.find((m) => m.factId === "v1");
    assert.ok(venture, "the venture item matches");
    assert.equal(venture.text, FACTS[0].text);
    assert.equal(venture.source, "From your venture details");
    assert.ok(venture.terms.length > 0);
    assert.equal(fit.matched.find((m) => m.factId === "r1")?.source, "From your resume");
  });

  test("lists what the listing asks for that the profile doesn't show", () => {
    assert.ok(fit.missing.some((m) => /^Asks for 2\+ years of experience/.test(m)));
    assert.ok(fit.missing.some((m) => /^SQL is named in the listing/.test(m)));
    assert.ok(fit.missing.some((m) => /^Excel or spreadsheets: you list it, but your profile doesn't show you using it\./.test(m)));
  });

  test("never counts a skills list as matched experience", () => {
    assert.equal(fit.matched.some((m) => m.factId === "s1"), false);
  });

  test("works without the profile items (no sources)", () => {
    const bare = fitBreakdown(jobEvidence(LISTING, FACTS, new Date("2026-10-23")), []);
    assert.ok(bare.matched.every((m) => m.source === null));
    assert.deepEqual(bare.missing, fit.missing);
  });
});
