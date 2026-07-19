import { makeFromPdfConverter } from "./libreoffice";

/*
 * PDF to Word adapter (Section 11.5) — LibreOffice reverse conversion via the
 * writer_pdf_import filter. Lossy by nature (see makeFromPdfConverter): text is
 * recovered as editable content but the original layout is approximated, so the
 * result carries an honest note. NoOptions in the registry.
 */
export const pdfToWord = makeFromPdfConverter(
  "pdf-to-word",
  "docx",
  "writer_pdf_import",
  "PDF to Word is a best-effort conversion: the text becomes editable, but complex layouts, columns, and exact fonts may shift. Review the result before relying on it.",
);
