import type { ResumePreviewModel } from "@/lib/resumePreview";

/*
 * Builds a resume-only A4 PDF from the preview model, in the browser.
 * Text is real (selectable, searchable) PDF text in the standard Helvetica fonts.
 * Layout keeps a section heading with its first item, an entry's title block with its
 * first bullet, and each bullet together, and wraps every line inside the margins.
 * The content is exactly the preview's: nothing is added or reworded.
 */

export type ResumePdf = {
  blob: Blob;
  fileName: string;
  /** Characters the PDF fonts can't show, and what they were replaced with. */
  replaced: { from: string; to: string }[];
};

// Characters outside printable ASCII and Latin-1 that the standard PDF fonts can show.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
// Readable substitutes for characters the standard fonts can't show.
const SUBSTITUTES: Record<string, string> = {
  "₹": "Rs.",
  "→": "->",
  "⇒": "=>",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "★": "*",
  "✓": "",
  "✔": "",
};
const INVISIBLE = /[​-‍⁠﻿]/g;

function showable(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch);
}

function sanitiser(replaced: Map<string, string>) {
  return (text: string) =>
    [...text.normalize("NFC").replace(INVISIBLE, "")]
      .map((ch) => {
        if (ch === "\t") return " ";
        if (showable(ch)) return ch;
        const to = SUBSTITUTES[ch] ?? "?";
        replaced.set(ch, to);
        return to;
      })
      .join("")
      .replace(/ {2,}/g, " ")
      .trim();
}

type FontStyle = "normal" | "bold" | "italic";

const INK = "#1b1c1e";
const MUTED = "#3a3d42";
const FAINT = "#6b6f76";

export async function createResumePdf(model: ResumePreviewModel): Promise<ResumePdf> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const replacedMap = new Map<string, string>();
  const clean = sanitiser(replacedMap);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  const top = margin;
  const bottom = pageHeight - margin;

  const setFont = (style: FontStyle, size: number, color = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const lineHeight = (size: number) => size * 1.32;
  const wrap = (text: string, style: FontStyle, size: number, width: number): string[] => {
    setFont(style, size);
    return doc.splitTextToSize(text, width) as string[];
  };
  const write = (lines: string[], x: number, y: number, style: FontStyle, size: number, color = INK) => {
    setFont(style, size, color);
    lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight(size), { baseline: "top" }));
    return lines.length * lineHeight(size);
  };

  /* A unit is drawn whole on one page. keepWithNext pulls the next unit onto the same page. */
  type Unit = { height: number; spaceBefore: number; keepWithNext: boolean; draw: (y: number) => void };
  const units: Unit[] = [];

  // Name and contact line.
  {
    const name = wrap(clean(model.name) || "Resume", "bold", 20, contentWidth);
    const contact = model.contact.length ? wrap(model.contact.map(clean).join("  |  "), "normal", 9.5, contentWidth) : [];
    units.push({
      height: name.length * lineHeight(20) + (contact.length ? 4 + contact.length * lineHeight(9.5) : 0),
      spaceBefore: 0,
      keepWithNext: true,
      draw: (y) => {
        setFont("bold", 20);
        name.forEach((l, i) => doc.text(l, pageWidth / 2, y + i * lineHeight(20), { baseline: "top", align: "center" }));
        const cy = y + name.length * lineHeight(20) + 4;
        setFont("normal", 9.5, MUTED);
        contact.forEach((l, i) => doc.text(l, pageWidth / 2, cy + i * lineHeight(9.5), { baseline: "top", align: "center" }));
      },
    });
  }

  const bodySize = 10;
  const bulletIndent = 11;

  const bulletUnit = (text: string): Unit => {
    const lines = wrap(clean(text), "normal", bodySize, contentWidth - bulletIndent);
    return {
      height: lines.length * lineHeight(bodySize) + 1.5,
      spaceBefore: 0,
      keepWithNext: false,
      draw: (y) => {
        setFont("normal", bodySize);
        doc.text("•", margin + 1, y, { baseline: "top" });
        write(lines, margin + bulletIndent, y, "normal", bodySize);
      },
    };
  };

  for (const section of model.sections) {
    const heading = clean(section.heading).toUpperCase();
    units.push({
      height: lineHeight(9.5) + 6,
      spaceBefore: 14,
      keepWithNext: true,
      draw: (y) => {
        setFont("bold", 9.5);
        doc.text(heading, margin, y, { baseline: "top", charSpace: 0.6 });
        doc.setDrawColor(INK);
        doc.setLineWidth(0.6);
        doc.line(margin, y + lineHeight(9.5) + 1.5, margin + contentWidth, y + lineHeight(9.5) + 1.5);
      },
    });

    section.entries.forEach((entry, entryIndex) => {
      if (!entry.title) return;
      const dates = entry.dates ? clean(entry.dates) : "";
      setFont("normal", bodySize);
      const datesWidth = dates ? doc.getTextWidth(dates) + 12 : 0;
      const title = wrap(clean(entry.title), "bold", 10.5, contentWidth - datesWidth);
      const subtitle = entry.subtitle ? wrap(clean(entry.subtitle), "italic", bodySize, contentWidth) : [];
      const context = entry.context ? wrap(clean(entry.context), "normal", bodySize, contentWidth) : [];
      units.push({
        height: title.length * lineHeight(10.5) + subtitle.length * lineHeight(bodySize) + context.length * lineHeight(bodySize) + 2,
        spaceBefore: entryIndex === 0 ? 4 : 8,
        keepWithNext: entry.bullets.length > 0 || section.lines.length > 0,
        draw: (y) => {
          let cy = y + write(title, margin, y, "bold", 10.5);
          if (dates) {
            setFont("normal", bodySize, MUTED);
            doc.text(dates, margin + contentWidth, y + 0.5, { baseline: "top", align: "right" });
          }
          cy += write(subtitle, margin, cy, "italic", bodySize, MUTED);
          write(context, margin, cy, "normal", bodySize, MUTED);
        },
      });
      entry.bullets.forEach((b) => units.push(bulletUnit(b)));
    });

    section.lines.forEach((line, i) => {
      if (line.bullet) {
        units.push(bulletUnit(line.text));
        return;
      }
      const lines = wrap(clean(line.text), "normal", bodySize, contentWidth);
      // A plain line after a bullet usually starts a new entry: give it room and keep it with what follows.
      const startsEntry = i > 0 && section.lines[i - 1].bullet;
      units.push({
        height: lines.length * lineHeight(bodySize),
        spaceBefore: i === 0 ? 4 : startsEntry ? 6 : 0,
        keepWithNext: Boolean(section.lines[i + 1]),
        draw: (y) => write(lines, margin, y, "normal", bodySize),
      });
    });
  }

  // Lay out: a unit (plus any units it must stay with) moves to a new page if it doesn't fit.
  let y = top;
  units.forEach((unit, i) => {
    const atTop = y === top;
    let need = (atTop ? 0 : unit.spaceBefore) + unit.height;
    for (let j = i; units[j]?.keepWithNext && units[j + 1]; j++) need += units[j + 1].spaceBefore + units[j + 1].height;
    // Never push a chain taller than a page; just start it on a fresh page.
    need = Math.min(need, bottom - top);
    if (!atTop && y + need > bottom) {
      doc.addPage();
      y = top;
    } else if (!atTop) {
      y += unit.spaceBefore;
    }
    unit.draw(y);
    y += unit.height;
  });

  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      setFont("normal", 8, FAINT);
      doc.text(`Page ${p} of ${pages}`, pageWidth / 2, pageHeight - 30, { baseline: "top", align: "center" });
    }
  }

  const name = clean(model.name);
  doc.setProperties({ title: name ? `${name} – Resume` : "Resume", creator: "Meritwing" });
  const base = name.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-");
  return {
    blob: doc.output("blob"),
    fileName: `${base || "resume"}-resume.pdf`,
    replaced: [...replacedMap].map(([from, to]) => ({ from, to })),
  };
}
