import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groundMatches } from "@/lib/ai/matchPrompt";
import { groundProfile } from "@/lib/ai/profilePrompt";
import type { ProfileInput } from "@/lib/profile";

/* Server checks on AI profile facts and match explanations. No AI requests. */

const input: ProfileInput = {
  resume: "Education\nMesa School of Business, PGP 2025 - 2026\n\nSkills\nExcel, Tally\n\nLooking for a summer internship in Bengaluru.",
  venture: {
    name: "Campus Chai Cart",
    about: "A tea and snacks cart run by a team of three for one term.",
    personal: "I collected price quotes from three local wholesalers every month and chose which one to order from.",
    results: "We had no stock-outs in the last eight weeks of the term.",
    resultsOwnership: "shared",
  },
};
const none = { employmentType: "none" as const, employmentQuote: "", cities: [], citiesQuote: "", workplace: "none" as const, workplaceQuote: "" };

describe("groundProfile", () => {
  test("keeps facts whose evidence is in the text; drops invented or changed ones", () => {
    const result = groundProfile(
      {
        facts: [
          { text: "Compared monthly price quotes from three local wholesalers", evidence: "I collected price quotes from three local wholesalers every month", source: "venture", kind: "experience" },
          { text: "Collected three monthly price quotes", evidence: "I collected price quotes from three local wholesalers every month", source: "venture", kind: "experience" },
          { text: "Managed a budget of 5 lakh", evidence: "managed a budget of 5 lakh", source: "venture", kind: "achievement" },
          { text: "Used Excel for supplier analysis", evidence: "Excel, Tally", source: "resume", kind: "skill" },
          { text: "No stock-outs in the last eight weeks of the term", evidence: "We had no stock-outs in the last eight weeks of the term.", source: "venture", kind: "achievement" },
        ],
        suggestedRoles: [{ role: "supply-chain", reason: "Compared supplier quotes." }],
        preferences: none,
      },
      input,
    );
    assert.deepEqual(result.facts.map((f) => f.text), [
      "Compared monthly price quotes from three local wholesalers",
      "Team result: No stock-outs in the last eight weeks of the term",
    ]);
    assert.equal(result.removed, 3);
    assert.deepEqual(result.suggestedRoles, [{ id: "supply-chain", reason: "Compared supplier quotes." }]);
  });

  test("uses a stated preference only when its quote is in the student's text", () => {
    const stated = groundProfile(
      { facts: [], suggestedRoles: [], preferences: { ...none, employmentType: "internship", employmentQuote: "Looking for a summer internship", cities: ["bengaluru"], citiesQuote: "internship in Bengaluru" } },
      input,
    );
    assert.deepEqual(stated.found, {
      employmentType: { value: "internship", quote: "Looking for a summer internship" },
      locations: { values: ["bengaluru"], quote: "internship in Bengaluru" },
    });
    const invented = groundProfile({ facts: [], suggestedRoles: [], preferences: { ...none, workplace: "remote", workplaceQuote: "prefers remote work" } }, input);
    assert.deepEqual(invented.found, {});
  });
});

describe("groundMatches", () => {
  const facts = [
    { id: "F1", text: "Compared monthly price quotes from three local wholesalers" },
    { id: "F2", text: "Team result: No stock-outs in the last eight weeks of the term" },
  ];
  const job = { id: "j1", title: "Procurement Specialist", company: "Groww", description: "Compare vendor quotes and shortlist suppliers.\nRequirements: 2+ years in procurement. Advanced Excel." };

  test("keeps reasons that cite a real fact and quote the listing; keeps only quoted gaps", () => {
    const result = groundMatches(
      {
        jobs: [
          {
            id: "j1",
            fits: [
              { reason: "You compared supplier quotes, as this role asks.", factId: "F1", jobQuote: "Compare vendor quotes" },
              { reason: "You negotiated contracts.", factId: "F1", jobQuote: "negotiate contracts" },
              { reason: "Matches supplier work.", factId: "F9", jobQuote: "shortlist suppliers" },
              { reason: "You used SAP for sourcing.", factId: "F1", jobQuote: "shortlist suppliers" },
            ],
            gaps: [{ requirement: "2+ years in procurement" }, { requirement: "MBA from a top school" }, { requirement: "Advanced Excel" }],
          },
        ],
      },
      { facts, jobs: [job] },
    );
    assert.deepEqual(result.j1.fits.map((f) => f.jobQuote), ["Compare vendor quotes"]);
    assert.deepEqual(result.j1.gaps, ["2+ years in procurement", "Advanced Excel"]);
    assert.equal(result.j1.removed, 4);
  });

  test("a listing without a description is marked, not guessed", () => {
    const result = groundMatches({ jobs: [] }, { facts, jobs: [{ ...job, description: "" }] });
    assert.deepEqual(result.j1, { fits: [], gaps: [], removed: 0, noDescription: true });
  });
});
