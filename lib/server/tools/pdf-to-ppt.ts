import { makeFromPdfConverter } from "./libreoffice";

/*
 * PDF to PPT adapter (Section 11.5) — LibreOffice reverse conversion via the
 * impress_pdf_import filter. Each PDF page becomes a slide, imported as a
 * page image rather than editable shapes/text, so this is a "PDF into slides"
 * convenience, not a true de-conversion. Honest note reflects that. NoOptions.
 */
export const pdfToPpt = makeFromPdfConverter(
  "pdf-to-ppt",
  "pptx",
  "impress_pdf_import",
  "PDF to PowerPoint places each page onto a slide as an image, not editable text boxes — handy for presenting a PDF, but the slide content isn't individually editable.",
);
