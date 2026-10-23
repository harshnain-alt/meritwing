import metrics from "@/lib/resume/helvetica-metrics.json";
import type { PreviewLine, ResumePreviewModel } from "@/lib/resumePreview";

/*
 * The one layout definition behind both the on-screen preview and the exported PDF.
 * It places every line of the resume on A4 pages in points, measuring text with Helvetica's
 * own widths, so the preview (SVG) and the PDF (jsPDF) draw the same lines in the same places:
 * the same wrapping, right-aligned dates and page breaks. Nothing is reworded; characters the
 * PDF fonts can't show are substituted in both, and listed.
 */

export type FontStyle = "normal" | "bold" | "italic";

/** Page, type and spacing, in points. */
export const SPEC = {
  page: { width: 595.28, height: 841.89 }, // A4
  margin: { x: 54, top: 50, bottom: 56 },
  lineHeight: 1.32,
  name: { size: 20, style: "bold" as FontStyle },
  contact: { size: 9.5, gap: 4 },
  heading: { size: 9.5, charSpace: 0.6, rule: 0.6, ruleGap: 4.5, spaceBefore: 16, spaceAfter: 6 },
  title: { size: 10.5 },
  body: { size: 10 },
  bullet: { glyphX: 1, indent: 11, gap: 1.5 },
  date: { gap: 14 },
  entryGap: 7,
  footer: { size: 8, fromBottom: 26 },
  colors: { ink: "#1b1c1e", muted: "#3a3d42", faint: "#6b6f76", rule: "#1b1c1e", link: "#1b1c1e" },
} as const;

export type TextItem = {
  kind: "text";
  x: number;
  /** Alphabetic baseline. */
  y: number;
  text: string;
  size: number;
  style: FontStyle;
  color: string;
  /** Measured width, charSpace included. */
  width: number;
  charSpace?: number;
  link?: string;
};
export type RuleItem = { kind: "rule"; x1: number; x2: number; y: number; width: number; color: string };
export type LayoutItem = TextItem | RuleItem;
export type LayoutPage = { items: LayoutItem[] };
export type ResumeLayout = { pages: LayoutPage[]; replaced: { from: string; to: string }[] };

/* ---------- Text the PDF fonts can show ---------- */

const WIDTHS = metrics.fonts as Record<FontStyle, Record<string, number>>;
// Readable substitutes for characters the standard fonts can't show.
const SUBSTITUTES: Record<string, string> = {
  "₹": "Rs.", "→": "->", "⇒": "=>", "←": "<-", "≥": ">=", "≤": "<=", "−": "-", "‐": "-", "‑": "-", "‒": "-", "★": "*", "✓": "", "✔": "",
};
const INVISIBLE = /[​-‍⁠﻿]/g;

function sanitiser(replaced: Map<string, string>) {
  return (text: string) =>
    [...text.normalize("NFC").replace(INVISIBLE, "")]
      .map((ch) => {
        if (ch === "\t" || ch === " ") return " ";
        if (WIDTHS.normal[ch] !== undefined) return ch;
        const to = SUBSTITUTES[ch] ?? "?";
        replaced.set(ch, to);
        return to;
      })
      .join("")
      .replace(/ {2,}/g, " ")
      .trim();
}

export function measure(text: string, size: number, style: FontStyle, charSpace = 0): number {
  const table = WIDTHS[style];
  let units = 0;
  for (const ch of text) units += table[ch] ?? table["?"];
  return (units / 1000) * size + charSpace * text.length;
}

/** Greedy word wrap; a word wider than the line (a long link) is broken between characters. */
export function wrap(text: string, size: number, style: FontStyle, maxWidth: number, charSpace = 0): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, size, style, charSpace) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    let rest = word;
    while (measure(rest, size, style, charSpace) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut), size, style, charSpace) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** A contact detail's link: email, phone or web address. */
export function contactLink(text: string): string | undefined {
  const t = text.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  if (/^\+?[\d\s().-]{8,}$/.test(t) && t.replace(/\D/g, "").length >= 8) return `tel:${t.replace(/[^\d+]/g, "")}`;
  if (/^https?:\/\/\S+$/i.test(t)) return t;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t) && /linkedin|github|\.(com|in|io|me|org|net|dev|run)\b/i.test(t)) return `https://${t}`;
  return undefined;
}

/* ---------- Units and pagination ---------- */

/**
 * Drawn whole on one page; keepWithNext keeps it on the same page as the unit after it.
 * `starts` marks the first unit of an entry (a role, a venture, a degree) or a section heading,
 * so pagination can keep a short entry together instead of splitting it after one bullet.
 */
type Unit = { height: number; spaceBefore: number; keepWithNext: boolean; starts?: "entry" | "heading"; draw: (top: number) => LayoutItem[] };

/** Entries up to this share of the usable page height move to the next page whole rather than split. */
const KEEP_ENTRY_WHOLE = 0.3;

const lh = (size: number) => size * SPEC.lineHeight;
const baseline = (top: number, size: number) => top + size * 0.93;

export function layoutResume(model: ResumePreviewModel): ResumeLayout {
  const replacedMap = new Map<string, string>();
  const clean = sanitiser(replacedMap);
  const { width: pageW, height: pageH } = SPEC.page;
  const left = SPEC.margin.x;
  const right = pageW - SPEC.margin.x;
  const contentW = right - left;
  const { ink, muted, faint, rule } = SPEC.colors;
  const body = SPEC.body.size;
  const units: Unit[] = [];

  const text = (x: number, top: number, t: string, size: number, style: FontStyle, color: string, extra: Partial<TextItem> = {}): TextItem => ({
    kind: "text", x, y: baseline(top, size), text: t, size, style, color, width: measure(t, size, style, extra.charSpace ?? 0), ...extra,
  });
  const lines = (x: number, top: number, ls: string[], size: number, style: FontStyle, color: string) =>
    ls.map((l, i) => text(x, top + i * lh(size), l, size, style, color));

  /* Header: the name, then contact details as centred lines, each detail its own link. */
  {
    const nameLines = wrap(clean(model.name) || "Resume", SPEC.name.size, "bold", contentW);
    const sep = "  ·  ";
    const sepW = measure(sep, SPEC.contact.size, "normal");
    const details = model.contact.map(clean).filter(Boolean);
    const rows: string[][] = [];
    for (const d of details) {
      const row = rows.at(-1);
      const rowW = row ? row.reduce((w, x) => w + measure(x, SPEC.contact.size, "normal"), 0) + sepW * row.length : 0;
      if (row && rowW + measure(d, SPEC.contact.size, "normal") <= contentW) row.push(d);
      else rows.push([d]);
    }
    const nameH = nameLines.length * lh(SPEC.name.size);
    const contactH = rows.length ? SPEC.contact.gap + rows.length * lh(SPEC.contact.size) : 0;
    units.push({
      height: nameH + contactH,
      spaceBefore: 0,
      keepWithNext: true,
      draw: (top) => {
        const out: LayoutItem[] = nameLines.map((l, i) => {
          const w = measure(l, SPEC.name.size, "bold");
          return text((pageW - w) / 2, top + i * lh(SPEC.name.size), l, SPEC.name.size, "bold", ink);
        });
        rows.forEach((row, r) => {
          const rowTop = top + nameH + SPEC.contact.gap + r * lh(SPEC.contact.size);
          const widths = row.map((d) => measure(d, SPEC.contact.size, "normal"));
          let x = (pageW - (widths.reduce((a, b) => a + b, 0) + sepW * (row.length - 1))) / 2;
          row.forEach((d, i) => {
            if (i > 0) {
              out.push(text(x, rowTop, sep, SPEC.contact.size, "normal", faint));
              x += sepW;
            }
            out.push(text(x, rowTop, d, SPEC.contact.size, "normal", muted, { link: contactLink(d) }));
            x += widths[i];
          });
        });
        return out;
      },
    });
  }

  const bulletUnit = (t: string, spaceBefore: number): Unit => {
    const ls = wrap(clean(t), body, "normal", contentW - SPEC.bullet.indent);
    return {
      height: ls.length * lh(body),
      spaceBefore,
      keepWithNext: false,
      draw: (top) => [text(left + SPEC.bullet.glyphX, top, "•", body, "normal", ink), ...lines(left + SPEC.bullet.indent, top, ls, body, "normal", ink)],
    };
  };

  /** A line with text on the left and a date on the right, both on the first baseline. */
  const datedUnit = (lead: string, date: string, size: number, style: FontStyle, spaceBefore: number, keepWithNext: boolean, below: string[][] = []): Unit => {
    const d = clean(date);
    const dateW = measure(d, body, "normal");
    const leadLines = wrap(clean(lead), size, style, contentW - (d ? dateW + SPEC.date.gap : 0));
    const extra = below.map(([t, s]) => [wrap(clean(t), body, s as FontStyle, contentW), s] as const);
    return {
      height: leadLines.length * lh(size) + extra.reduce((h, [ls]) => h + ls.length * lh(body), 0),
      spaceBefore,
      keepWithNext,
      draw: (top) => {
        const out: LayoutItem[] = lines(left, top, leadLines, size, style, ink);
        if (d) out.push({ ...text(right - dateW, top, d, body, "normal", muted), y: baseline(top, size) });
        let y = top + leadLines.length * lh(size);
        for (const [ls, s] of extra) {
          out.push(...lines(left, y, ls, body, s as FontStyle, muted));
          y += ls.length * lh(body);
        }
        return out;
      },
    };
  };

  for (const section of model.sections) {
    const heading = clean(section.heading).toUpperCase();
    const hs = SPEC.heading;
    units.push({
      height: lh(hs.size) + hs.spaceAfter,
      spaceBefore: hs.spaceBefore,
      keepWithNext: true,
      starts: "heading",
      draw: (top) => {
        const t = text(left, top, heading, hs.size, "bold", ink, { charSpace: hs.charSpace });
        return [t, { kind: "rule", x1: left, x2: right, y: t.y + hs.ruleGap, width: hs.rule, color: rule }];
      },
    });

    section.entries.forEach((entry, i) => {
      if (!entry.title) return;
      const below: string[][] = [];
      if (entry.subtitle) below.push([entry.subtitle, "italic"]);
      if (entry.context) below.push([entry.context, "normal"]);
      units.push({ ...datedUnit(entry.title, entry.dates ?? "", SPEC.title.size, "bold", i === 0 ? 0 : SPEC.entryGap, entry.bullets.length > 0 || section.lines.length > 0, below), starts: "entry" });
      entry.bullets.forEach((b) => units.push(bulletUnit(b, SPEC.bullet.gap)));
    });

    section.lines.forEach((line: PreviewLine, i) => {
      const prev = section.lines[i - 1];
      const first = i === 0 && !section.entries.some((e) => e.title);
      if (line.bullet) {
        units.push(bulletUnit(line.text, first ? 0 : SPEC.bullet.gap));
        return;
      }
      // A dated line, or a plain line after a bullet, starts a new entry: room above, kept with what follows.
      const startsEntry = !first && (Boolean(line.date) || Boolean(prev?.bullet));
      const space = first ? 0 : startsEntry ? SPEC.entryGap : 0;
      const next = section.lines[i + 1];
      if (line.date && line.lead) {
        units.push({ ...datedUnit(line.lead, line.date, body, "bold", space, Boolean(next)), starts: "entry" });
        return;
      }
      const ls = wrap(clean(line.text), body, "normal", contentW);
      units.push({
        height: ls.length * lh(body),
        spaceBefore: space,
        keepWithNext: Boolean(next?.bullet),
        starts: startsEntry ? "entry" : undefined,
        draw: (top) => lines(left, top, ls, body, "normal", ink),
      });
    });
  }

  /*
   * Pagination: a unit (with the one it must stay with) moves to a new page when it doesn't fit.
   * A short entry is placed whole, and a heading needs room for its first short entry too.
   */
  const top0 = SPEC.margin.top;
  const bottom = pageH - SPEC.margin.bottom;
  const usable = bottom - top0;
  const entryHeight = (i: number) => {
    let h = units[i].height;
    for (let j = i + 1; j < units.length && !units[j].starts; j++) h += units[j].spaceBefore + units[j].height;
    return h;
  };
  const wholeHeight = (i: number) => {
    if (units[i].starts !== "entry") return null;
    const h = entryHeight(i);
    return h <= usable * KEEP_ENTRY_WHOLE ? h : null;
  };
  const pages: LayoutPage[] = [{ items: [] }];
  let y = top0;
  units.forEach((unit, i) => {
    const atTop = y === top0;
    const next = units[i + 1];
    const whole = wholeHeight(i);
    let need = (atTop ? 0 : unit.spaceBefore) + (whole ?? unit.height);
    if (whole === null && unit.keepWithNext && next) need += next.spaceBefore + (wholeHeight(i + 1) ?? next.height);
    need = Math.min(need, usable);
    if (!atTop && y + need > bottom) {
      pages.push({ items: [] });
      y = top0;
    } else if (!atTop) {
      y += unit.spaceBefore;
    }
    pages.at(-1)!.items.push(...unit.draw(y));
    y += unit.height;
  });

  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = `Page ${i + 1} of ${pages.length}`;
      const w = measure(label, SPEC.footer.size, "normal");
      p.items.push({ kind: "text", x: (pageW - w) / 2, y: pageH - SPEC.footer.fromBottom, text: label, size: SPEC.footer.size, style: "normal", color: faint, width: w });
    });
  }

  return { pages, replaced: [...replacedMap].map(([from, to]) => ({ from, to })) };
}
