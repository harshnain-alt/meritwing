import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { emptyApplication, validateExperience, type ExperienceData } from "@/lib/application";
import { answersKey, bulletText, draftVentureEntry, entryForResume, unsupportedDetails, ventureWork } from "@/lib/ventureEntry";

/* "Your venture" → an Experience entry, from the three answers only. All data is fictional. */

const ANSWERS = {
  projectName: "Campus Chai Cart",
  about: "a tea and snacks cart near the hostel that sells to students in the evenings",
  personal:
    "I collected price quotes from three local wholesalers every month and chose which one to order from.\nI placed orders by phone and kept a log of orders and delivery dates.\nWe had no stock-outs in the last eight weeks of the term.",
};

describe("draftVentureEntry", () => {
  const entry = draftVentureEntry(ANSWERS);

  test("uses the venture name as the heading and the description as written", () => {
    assert.equal(entry.heading, "Campus Chai Cart");
    assert.equal(entry.description, "A tea and snacks cart near the hostel that sells to students in the evenings.");
  });

  test("turns each sentence of what the student did into a bullet in their words", () => {
    assert.deepEqual(entry.bullets, [
      { text: "Collected price quotes from three local wholesalers every month and chose which one to order from", kind: "own" },
      { text: "Placed orders by phone and kept a log of orders and delivery dates", kind: "own" },
      { text: "We had no stock-outs in the last eight weeks of the term", kind: "team" },
    ]);
  });

  test("marks team results on the resume so they're never read as the student's own", () => {
    assert.equal(bulletText(entry.bullets[2]), "Team result: we had no stock-outs in the last eight weeks of the term");
    assert.deepEqual(entryForResume(entry).bullets.slice(0, 1), ["Collected price quotes from three local wholesalers every month and chose which one to order from"]);
  });

  test("adds no title, dates, numbers, tools or leadership", () => {
    const all = [entry.heading, entry.description, ...entry.bullets.map((b) => b.text)].join(" ");
    assert.deepEqual(unsupportedDetails(all, ANSWERS), []);
    assert.doesNotMatch(all, /\b(intern|manager|founder|led|managed|20\d\d)\b/i);
  });

  test("handles lists, 'responsible for' and lines without 'I'", () => {
    const e = draftVentureEntry({ ...ANSWERS, personal: "- I was responsible for the menu board\n• Designed the price list\nOur team sold out on Fridays" });
    assert.deepEqual(e.bullets, [
      { text: "Responsible for the menu board", kind: "own" },
      { text: "Designed the price list", kind: "own" },
      { text: "Our team sold out on Fridays", kind: "team" },
    ]);
  });
});

describe("unsupportedDetails", () => {
  test("flags numbers, leadership words and names that aren't in the answers", () => {
    assert.deepEqual(unsupportedDetails("Led a team of 5 using Zoho to place orders", ANSWERS), ["5", "Led", "Zoho"]);
  });

  test("accepts details the student wrote themselves", () => {
    assert.deepEqual(unsupportedDetails("Compared quotes from three wholesalers every month for Campus Chai Cart", ANSWERS), []);
  });
});

describe("ventureWork", () => {
  test("keeps the student's own work and team results apart", () => {
    const work = ventureWork({ ...emptyApplication.experience, ...ANSWERS });
    assert.match(work.personal, /^Collected price quotes/);
    assert.doesNotMatch(work.personal, /stock-outs/);
    assert.equal(work.results, "We had no stock-outs in the last eight weeks of the term");
    assert.equal(work.resultsAttribution, "shared");
  });

  test("uses the entry the student added and edited", () => {
    const entry = { heading: "Campus Chai Cart", description: "A tea cart.", bullets: [{ text: "Kept the order log", kind: "own" as const }] };
    const work = ventureWork({ ...emptyApplication.experience, ...ANSWERS, entry, draft: null });
    assert.deepEqual(work, { personal: "Kept the order log", results: "", resultsAttribution: "" });
  });
});

describe("validateExperience", () => {
  const base: ExperienceData = { ...emptyApplication.experience, ...ANSWERS };

  test("asks only for the three answers, then for the reviewed entry", () => {
    assert.deepEqual(Object.keys(validateExperience({ ...emptyApplication.experience })).sort(), ["about", "personal", "projectName"]);
    assert.deepEqual(Object.keys(validateExperience(base)), ["entry"]);
    const draft = { ...draftVentureEntry(ANSWERS), from: answersKey(ANSWERS) };
    assert.match(validateExperience({ ...base, draft }).entry ?? "", /add it to your resume/);
  });

  test("passes once the entry is added, and asks again after unsaved edits", () => {
    const entry = draftVentureEntry(ANSWERS);
    const draft = { ...entry, from: answersKey(ANSWERS) };
    assert.deepEqual(validateExperience({ ...base, draft, entry }), {});
    assert.match(validateExperience({ ...base, draft: { ...draft, heading: "Chai Cart" }, entry }).entry ?? "", /Update it in your resume/);
  });
});
