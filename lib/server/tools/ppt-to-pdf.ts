import { makeToPdfConverter } from "./libreoffice";

/*
 * PPT to PDF adapter (Section 11.5) — .pptx/.ppt → PDF via LibreOffice (the
 * single soffice spawn point in ./libreoffice). Same lossless-direction
 * converter as Word/Excel to PDF; only the slug (output naming) differs. No
 * options.
 */
export const pptToPdf = makeToPdfConverter("ppt-to-pdf");
