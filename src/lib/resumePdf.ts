import { layoutResume, SPEC } from "@/lib/resume/layout";
import type { ResumePreviewModel } from "@/lib/resumePreview";

/*
 * Builds the resume-only A4 PDF in the browser by drawing the shared layout
 * (src/lib/resume/layout.ts) with jsPDF: the same lines, positions and page breaks as the
 * on-screen preview. Text is real, selectable Helvetica; contact details are links. Nothing
 * but the resume is drawn, so no app controls can reach the file.
 */

export type ResumePdf = {
  blob: Blob;
  fileName: string;
  /** Characters the PDF fonts can't show, and what they were replaced with. */
  replaced: { from: string; to: string }[];
};

export async function createResumePdf(model: ResumePreviewModel): Promise<ResumePdf> {
  const { jsPDF } = await import("jspdf");
  const layout = layoutResume(model);
  const doc = new jsPDF({ unit: "pt", format: [SPEC.page.width, SPEC.page.height], compress: true });

  layout.pages.forEach((page, i) => {
    if (i > 0) doc.addPage([SPEC.page.width, SPEC.page.height]);
    for (const item of page.items) {
      if (item.kind === "rule") {
        doc.setDrawColor(item.color);
        doc.setLineWidth(item.width);
        doc.line(item.x1, item.y, item.x2, item.y);
        continue;
      }
      doc.setFont("helvetica", item.style);
      doc.setFontSize(item.size);
      doc.setTextColor(item.color);
      doc.text(item.text, item.x, item.y, item.charSpace ? { charSpace: item.charSpace } : undefined);
      if (item.link) doc.link(item.x, item.y - item.size * 0.8, item.width, item.size * 1.05, { url: item.link });
    }
  });

  const name = model.name.trim();
  doc.setProperties({ title: name ? `${name} – Resume` : "Resume", creator: "Meritwing" });
  const base = name.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-");
  return { blob: doc.output("blob"), fileName: `${base || "resume"}-resume.pdf`, replaced: layout.replaced };
}
