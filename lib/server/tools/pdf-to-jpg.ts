import { makePdfToImageConverter } from "./pdf-to-image";

/*
 * PDF to JPG adapter (Section 11.5) — one JPG per page via Ghostscript (the
 * shared pdf-to-image spawn point). Multi-output: the pipeline ZIPs the pages
 * into a single download. No options (NoOptions in the registry).
 */
export const pdfToJpg = makePdfToImageConverter("pdf-to-jpg", "jpg");
