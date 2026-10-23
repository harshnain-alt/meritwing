import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { layoutResume, measure, SPEC, type TextItem } from "@/lib/resume/layout";
import { continuesBullet, splitTrailingDate } from "@/lib/resume/lines";
import type { ResumePreviewModel } from "@/lib/resumePreview";

/* The shared resume layout that both the preview and the PDF draw. All data here is fictional. */

const RIGHT = SPEC.page.width - SPEC.margin.x;
const BULLET_X = SPEC.margin.x + SPEC.bullet.indent;
const texts = (model: ResumePreviewModel) => layoutResume(model).pages.flatMap((p) => p.items.filter((i): i is TextItem => i.kind === "text"));

const LONG =
  "Designed and ran a twelve-week pilot with three regional distributors to replace paper dispatch logs with a shared digital tracker, trained 40 warehouse staff across two shifts, and handed it over to the operations team";

const model = (over: Partial<ResumePreviewModel> = {}): ResumePreviewModel => ({
  name: "Riya Test Sharma",
  contact: ["riya@example.com", "+91 90000 00011", "Karnataka"],
  sections: [
    {
      heading: "Experience",
      entries: [],
      lines: [
        { text: "Northwind Labs – India December’24 – Present", bullet: false, lead: "Northwind Labs – India", date: "December’24 – Present" },
        { text: "Associate Product Manager", bullet: false },
        { text: LONG, bullet: true },
      ],
    },
  ],
  ...over,
});

describe("splitTrailingDate", () => {
  test("splits ranges and single dates written in common resume styles", () => {
    assert.deepEqual(splitTrailingDate("Northwind Labs – India December’24 – Present"), { lead: "Northwind Labs – India", date: "December’24 – Present" });
    assert.deepEqual(splitTrailingDate("Bluepeak Capital - India September'24 – December'24"), { lead: "Bluepeak Capital - India", date: "September'24 – December'24" });
    assert.deepEqual(splitTrailingDate("Example Retail, Pune | Jun 2023 - May 2024"), { lead: "Example Retail, Pune", date: "Jun 2023 - May 2024" });
    assert.deepEqual(splitTrailingDate("Sample College, BCom 2019 – 2022"), { lead: "Sample College, BCom", date: "2019 – 2022" });
  });

  test("leaves lines without a trailing date alone", () => {
    assert.equal(splitTrailingDate("Associate Product Manager"), null);
    assert.equal(splitTrailingDate("Grew orders 40% in 2023 with a referral offer"), null);
  });
});

describe("continuesBullet", () => {
  test("joins lines that PDF extraction broke off a bullet", () => {
    assert.equal(continuesBullet("Ran weekly reviews with operations, sales and engineering", "teams"), true);
    assert.equal(continuesBullet("Wrote first-pass notes for three", "seed deals"), true);
    assert.equal(continuesBullet("Published the findings in the Annual", "Report 2023"), true);
  });

  test("keeps new entries, roles and headings as their own lines", () => {
    assert.equal(continuesBullet("Built market maps for D2C home goods", "Bluepeak Capital - India September'24 – December'24"), false);
    assert.equal(continuesBullet("Launched supplier scorecards.", "Investment Intern"), false);
    assert.equal(continuesBullet("Ran the stock register", "SKILLS"), false);
    assert.equal(continuesBullet("Ran the stock register", "Key achievements:"), false);
  });
});

describe("layoutResume", () => {
  test("right-aligns dates to the right margin on the entry's first baseline", () => {
    const t = texts(model());
    const date = t.find((i) => i.text === "December’24 – Present")!;
    const lead = t.find((i) => i.text === "Northwind Labs – India")!;
    assert.ok(Math.abs(date.x + date.width - RIGHT) < 0.01);
    assert.equal(date.y, lead.y);
    assert.equal(lead.x, SPEC.margin.x);
  });

  test("wraps long bullets with a hanging indent and keeps every line inside the margins", () => {
    const t = texts(model());
    const bulletLines = t.filter((i) => i.x === BULLET_X);
    assert.ok(bulletLines.length >= 2, "the long bullet wraps");
    assert.equal(bulletLines.map((l) => l.text).join(" "), LONG);
    for (const i of t) assert.ok(i.x >= SPEC.margin.x - 0.01 && i.x + i.width <= RIGHT + 0.01, `inside margins: ${i.text}`);
  });

  test("breaks a word longer than the line instead of letting it run off the page", () => {
    const url = `https://example.com/${"a".repeat(200)}`;
    const t = texts(model({ sections: [{ heading: "Projects", entries: [], lines: [{ text: url, bullet: true }] }] }));
    assert.ok(t.filter((i) => i.x === BULLET_X).length >= 2);
    for (const i of t) assert.ok(i.x + i.width <= RIGHT + 0.01);
  });

  test("centres the header and wraps a long name instead of shrinking it", () => {
    const name = "Venkata Subrahmanya Lakshminarayana Test Chidambaram Iyer";
    const t = texts(model({ name }));
    const nameLines = t.filter((i) => i.size === SPEC.name.size);
    assert.equal(nameLines.length, 2);
    for (const l of nameLines) assert.ok(Math.abs(l.x + l.width / 2 - SPEC.page.width / 2) < 0.01);
  });

  test("links contact details", () => {
    const t = texts(model({ contact: ["riya@example.com", "+91 90000 00011", "linkedin.com/in/riya-test", "Karnataka"] }));
    assert.equal(t.find((i) => i.text === "riya@example.com")?.link, "mailto:riya@example.com");
    assert.equal(t.find((i) => i.text === "+91 90000 00011")?.link, "tel:+919000000011");
    assert.equal(t.find((i) => i.text === "linkedin.com/in/riya-test")?.link, "https://linkedin.com/in/riya-test");
    assert.equal(t.find((i) => i.text === "Karnataka")?.link, undefined);
  });

  test("draws only what is there: no contact row, no empty sections", () => {
    const t = texts(model({ contact: [], sections: [] }));
    assert.deepEqual(t.map((i) => i.text), ["Riya Test Sharma"]);
  });

  test("adds pages for long content, numbers them and keeps short entries whole", () => {
    const entry = (n: number) => [
      { text: `Company ${n} Jun 2023 - May 2024`, bullet: false, lead: `Company ${n}`, date: "Jun 2023 - May 2024" },
      { text: LONG, bullet: true },
      { text: LONG, bullet: true },
    ];
    const layout = layoutResume(model({ sections: [{ heading: "Experience", entries: [], lines: Array.from({ length: 12 }, (_, n) => entry(n + 1)).flat() }] }));
    assert.ok(layout.pages.length >= 2);
    layout.pages.forEach((p, i) => {
      const t = p.items.filter((x): x is TextItem => x.kind === "text");
      assert.ok(t.some((x) => x.text === `Page ${i + 1} of ${layout.pages.length}`));
      for (const x of t) assert.ok(x.y <= SPEC.page.height - SPEC.margin.bottom || x.size === SPEC.footer.size, "body text stays above the bottom margin");
      // Each page starts with an entry's company line, never in the middle of an entry.
      if (i > 0) assert.match(t[0].text, /^Company \d+$/);
      for (const x of t) assert.ok(x.size >= SPEC.footer.size, "no text is shrunk");
    });
  });

  test("measures with the PDF font's metrics", () => {
    // jsPDF's Helvetica table gives 'W' 940/1000 em.
    assert.ok(Math.abs(measure("W", 10, "normal") - 9.4) < 1e-9);
    assert.ok(measure("Bold", 10, "bold") > measure("Bold", 10, "normal"));
  });
});
