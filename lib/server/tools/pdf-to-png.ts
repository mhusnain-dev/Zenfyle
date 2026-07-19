import { makePdfToImageConverter } from "./pdf-to-image";

/*
 * PDF to PNG adapter (Section 11.5) — one PNG per page via Ghostscript (the
 * shared pdf-to-image spawn point). Multi-output: the pipeline ZIPs the pages
 * into a single download. No options (NoOptions in the registry).
 */
export const pdfToPng = makePdfToImageConverter("pdf-to-png", "png");
