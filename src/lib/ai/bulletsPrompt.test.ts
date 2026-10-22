import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groundBullets, meaningChanges, unsupportedDetails } from "@/lib/ai/bulletsPrompt";
import type { BulletsInput } from "@/lib/bullets";

/*
 * Regression checks for the server-side bullet checks. No AI requests: these feed hand-written
 * bullets, including real ones the model produced in testing, through the same functions the
 * /api/bullets route uses. Run with `npm test`.
 */

const chaiCart: BulletsInput = {
  internship: { title: "Supply Chain Intern", company: "Example Foods Pvt Ltd", description: "Compare vendor quotes. Strong Excel skills." },
  project: {
    name: "Campus Chai Cart",
    about: "A tea and snacks cart for students near the hostel, run by a team of three for one term.",
    personal:
      "I handled suppliers: I collected price quotes from three local wholesalers every month and chose which one to order from. I placed orders by phone and kept a log of orders and delivery dates.",
    results: "We had no stock-outs in the last eight weeks of the term.",
    resultsOwnership: "mixed",
  },
  followUps: [{ question: "What did you use to keep your order log?", answer: "A paper register." }],
  resume: "Skills\nExcel, Tally",
};
const chaiFacts = [chaiCart.project.about, chaiCart.project.personal, chaiCart.project.results, chaiCart.followUps[0].answer];
const chaiOwn = [chaiCart.project.personal, chaiCart.followUps[0].answer].join("\n");
const changes = (text: string, facts = chaiFacts, own = chaiOwn) => meaningChanges(text, facts, own);

const snackBox = {
  facts: [
    "A student-run snack delivery service for hostel residents, run by four of us for one semester.",
    "I took orders on WhatsApp every evening and packed them for delivery.",
    "I counted stock each night and wrote down what needed reordering.",
    "Delivered about 40 orders a week by the end of the semester.",
  ],
  own: "I took orders on WhatsApp every evening and packed them for delivery.\nI counted stock each night and wrote down what needed reordering.",
};

describe("meaning is preserved (quantity, frequency, scope, ownership)", () => {
  test("regression: 'quotes from three wholesalers each month' must not become 'three monthly price quotes'", () => {
    assert.deepEqual(changes("Collected three monthly price quotes from local wholesalers and selected suppliers."), [
      "three monthly price quotes",
    ]);
  });

  test("the same facts reworded faithfully are kept", () => {
    for (const ok of [
      "Collected monthly price quotes from three local wholesalers and chose which one to order from.",
      "Collected price quotes from three wholesalers each month and selected a supplier.",
      "Compared quotes from three local suppliers every month before placing orders.",
      "Contributed to a team of three running a tea and snacks cart for one term.",
      "As part of a three-person team, ran a tea and snacks cart for students near the hostel.",
      "As part of the team, maintained operations with no stock-outs in the last eight weeks of the term.",
    ]) {
      assert.deepEqual(changes(ok), [], ok);
    }
  });

  test("a number moved to a different thing is caught", () => {
    assert.deepEqual(changes("Placed three orders a month by phone."), ["three orders"]);
    assert.deepEqual(changes("Kept the order log for eight wholesalers."), ["eight wholesalers"]);
  });

  test("a frequency the facts don't state is caught", () => {
    assert.deepEqual(changes("Collected weekly price quotes from three local wholesalers."), ["every week"]);
    assert.deepEqual(changes("Placed orders by phone daily."), ["every day"]);
  });

  test("a widened scope is caught, unless the facts state it", () => {
    assert.deepEqual(changes("Placed every order by phone and logged delivery dates."), ["every order"]);
    assert.deepEqual(
      changes("Placed every order by phone.", ["I placed every order myself by phone."], "I placed every order myself by phone."),
      [],
    );
  });

  test("an ownership claim needs the student's own words behind it", () => {
    assert.deepEqual(changes("Independently kept a log of orders and delivery dates."), ["Independently"]);
    assert.deepEqual(changes("Solely handled suppliers.", ["I handled suppliers on my own."], "I handled suppliers on my own."), []);
  });

  test("real bullets from the operations test still pass", () => {
    for (const ok of [
      "As part of the student-run team of four, contributed to delivering about 40 orders a week by the end of the semester.",
      "Counted stock each night in a notebook and recorded items needing reordering.",
      "Took orders on WhatsApp every evening and packed them for delivery.",
      "Contributed to a team that delivered about 40 weekly orders by the end of the semester.",
    ]) {
      assert.deepEqual(meaningChanges(ok, snackBox.facts, snackBox.own), [], ok);
    }
    assert.deepEqual(meaningChanges("Took orders on WhatsApp nightly.", snackBox.facts, snackBox.own), []);
    assert.deepEqual(meaningChanges("Took orders on WhatsApp every morning.", snackBox.facts, snackBox.own), ["every morning"]);
  });
});

describe("invented details are caught", () => {
  const facts = chaiFacts.join("\n");
  const check = (text: string) => unsupportedDetails(text, facts, chaiOwn);

  test("invented numbers and percentages", () => {
    assert.deepEqual(check("Cut costs by 30% across suppliers"), ["30", "%"]);
    assert.deepEqual(check("Compared quotes from five wholesalers"), ["five"]);
  });
  test("tools from the resume or job description", () => {
    assert.deepEqual(check("Tracked orders in Excel"), ["Excel"]);
    assert.deepEqual(check("Built a dashboard for deliveries"), ["dashboard"]);
  });
  test("leadership the student didn't claim", () => {
    assert.deepEqual(check("Led a team of three running the cart"), ["Led"]);
  });
});

describe("groundBullets", () => {
  test("drops the regression example, keeps faithful bullets, labels team results", () => {
    const result = groundBullets(
      {
        bullets: [
          { text: "Collected three monthly price quotes from local wholesalers and selected suppliers.", kind: "personal", sources: ["P1"] },
          { text: "Collected monthly price quotes from three local wholesalers and chose which one to order from.", kind: "personal", sources: ["P1"] },
          { text: "Placed orders by phone and kept a log of orders and delivery dates in a paper register.", kind: "personal", sources: ["P2", "A1"] },
          { text: "Maintained no stock-outs in the last eight weeks of the term.", kind: "team", sources: ["R1"] },
        ],
      },
      chaiCart,
    );
    assert.deepEqual(
      result.bullets.map((b) => [b.kind, b.text]),
      [
        ["personal", "Collected monthly price quotes from three local wholesalers and chose which one to order from."],
        ["personal", "Placed orders by phone and kept a log of orders and delivery dates in a paper register."],
        ["team", "Team result: Maintained no stock-outs in the last eight weeks of the term."],
      ],
    );
    assert.equal(result.removed, 1);
    assert.deepEqual(result.removedTerms, ["three monthly price quotes"]);
  });

  test("bullets citing no real fact are dropped", () => {
    const result = groundBullets({ bullets: [{ text: "Kept a log of orders and delivery dates.", kind: "personal", sources: ["Z9"] }] }, chaiCart);
    assert.equal(result.bullets.length, 0);
    assert.equal(result.removed, 1);
  });
});
