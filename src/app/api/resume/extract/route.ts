import { extractText, getDocumentProxy } from "unpdf";

/*
 * Extracts text from an uploaded PDF resume.
 * The file is processed in memory only: it is never written to disk or storage,
 * and neither the file nor its contents are logged.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_CHARS = 50;
// Allowance for multipart boundaries and headers around the file itself.
const FORM_OVERHEAD = 64 * 1024;

type ErrorCode = "too_large" | "not_pdf" | "missing_file" | "no_text" | "encrypted" | "unreadable";

function error(code: ErrorCode, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES + FORM_OVERHEAD) {
    return error("too_large", "This file is larger than 5 MB. Upload a smaller PDF or paste your resume text instead.", 413);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return error("missing_file", "We couldn't read the upload. Please try again.", 400);
  }
  if (!(file instanceof File) || file.size === 0) {
    return error("missing_file", "Choose a PDF file to upload.", 400);
  }
  if (file.size > MAX_BYTES) {
    return error("too_large", "This file is larger than 5 MB. Upload a smaller PDF or paste your resume text instead.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const declaredPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  // A real PDF starts with "%PDF-" (allowing for a little leading junk, as PDF readers do).
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!declaredPdf || !header.includes("%PDF-")) {
    return error("not_pdf", "This isn't a PDF file. Upload a PDF, or paste your resume text instead.", 415);
  }

  let text: string;
  let pages: number;
  try {
    const pdf = await getDocumentProxy(bytes);
    try {
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
      pages = result.totalPages;
    } finally {
      // Release the parsed document from memory.
      await pdf.loadingTask.destroy();
    }
  } catch (err) {
    if (err instanceof Error && err.name === "PasswordException") {
      return error("encrypted", "This PDF is password-protected. Remove the password, or paste your resume text instead.", 422);
    }
    return error("unreadable", "We couldn't read this PDF. Paste your resume text instead.", 422);
  }

  const cleaned = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (cleaned.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    return error(
      "no_text",
      "We couldn't find readable text in this PDF. It may be a scanned image. Paste your resume text instead.",
      422,
    );
  }

  return Response.json({ text: cleaned, pages }, { headers: { "Cache-Control": "no-store" } });
}
