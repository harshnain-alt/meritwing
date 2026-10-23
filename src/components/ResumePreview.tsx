"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { layoutResume, SPEC, type LayoutPage } from "@/lib/resume/layout";
import type { ResumePreviewModel } from "@/lib/resumePreview";

/*
 * The resume preview: the shared layout drawn as A4 pages in SVG, so it shows exactly what the
 * PDF will contain, page breaks included. Printing the page (Ctrl+P) prints only these pages.
 */

// Metric-compatible with the PDF's Helvetica, so lines fill the same widths.
const FONT = "Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans', sans-serif";
const noopSubscribe = () => () => {};

export function ResumePreview({ model }: { model: ResumePreviewModel }) {
  const layout = useMemo(() => layoutResume(model), [model]);
  const [actualSize, setActualSize] = useState(false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const pages = layout.pages.length;

  return (
    <div aria-label="Resume preview" role="region">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
        <span>
          A4 · {pages} {pages === 1 ? "page" : "pages"}, exactly as in the PDF
        </span>
        <button
          type="button"
          onClick={() => setActualSize((v) => !v)}
          className="rounded-md px-2 py-1 font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          {actualSize ? "Fit to width" : "Actual size"}
        </button>
      </div>
      <div className={actualSize ? "overflow-x-auto" : ""}>
        <article aria-label="Resume layout preview" className="space-y-4" style={actualSize ? { width: `${(SPEC.page.width * 4) / 3}px` } : undefined}>
          {layout.pages.map((page, i) => (
            <Page key={i} page={page} index={i} total={pages} />
          ))}
        </article>
      </div>
      {mounted &&
        createPortal(
          <div className="resume-print" aria-hidden="true">
            {layout.pages.map((page, i) => (
              <Page key={i} page={page} index={i} total={pages} print />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Page({ page, index, total, print }: { page: LayoutPage; index: number; total: number; print?: boolean }) {
  const { width, height } = SPEC.page;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role={print ? undefined : "img"}
      aria-label={print ? undefined : `Resume page ${index + 1} of ${total}`}
      className={print ? "resume-print-page" : "block h-auto w-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-line"}
      fontFamily={FONT}
    >
      <rect width={width} height={height} fill="#ffffff" />
      {page.items.map((item, i) => {
        if (item.kind === "rule") {
          return <line key={i} x1={item.x1} x2={item.x2} y1={item.y} y2={item.y} stroke={item.color} strokeWidth={item.width} />;
        }
        const t = (
          <text
            key={i}
            x={item.x}
            y={item.y}
            fontSize={item.size}
            fontWeight={item.style === "bold" ? 700 : 400}
            fontStyle={item.style === "italic" ? "italic" : "normal"}
            fill={item.color}
            letterSpacing={item.charSpace}
            textLength={item.width > 0 ? item.width : undefined}
            lengthAdjust="spacing"
            xmlSpace="preserve"
          >
            {item.text}
          </text>
        );
        return item.link ? (
          <a key={i} href={item.link} target={item.link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            {t}
          </a>
        ) : (
          t
        );
      })}
    </svg>
  );
}
