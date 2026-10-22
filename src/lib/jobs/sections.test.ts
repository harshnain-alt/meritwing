import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fixture from "@/lib/jobs/__fixtures__/bengaluru-listings-2026-10-22.json";
import { jobSections } from "@/lib/jobs/sections";

/* Description sections on real recorded listings (test fixture only). */

describe("jobSections", () => {
  test("splits a description by the employer's own headings, keeping the wording", () => {
    const s = jobSections("About us\nWe sell things.\n\nWhat you'll do\n• Compare vendor quotes\n• Track purchase orders\n\nRequirements:\n• 2+ years in procurement\n• Strong Excel skills\n\nBenefits\n• Health cover");
    assert.deepEqual(s, {
      responsibilities: ["Compare vendor quotes", "Track purchase orders"],
      requirements: ["2+ years in procurement", "Strong Excel skills"],
    });
  });

  // The fixture's descriptions are cut at 3,000 characters, so later requirement sections are often missing there.
  test("finds a section in every real recorded listing, in the employer's own words", () => {
    const parsed = fixture.jobs.map((j) => jobSections(j.description));
    assert.ok(parsed.every((s) => s.responsibilities.length + s.requirements.length > 0));
    for (const [i, s] of parsed.entries()) {
      for (const item of [...s.responsibilities, ...s.requirements]) {
        assert.ok(fixture.jobs[i].description.includes(item), `"${item}" is the employer's own wording`);
      }
    }
  });
});
