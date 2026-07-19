import { makeToPdfConverter } from "./libreoffice";

/*
 * Excel to PDF adapter (Section 11.5) — .xlsx/.xls → PDF via LibreOffice (the
 * single soffice spawn point in ./libreoffice). Same lossless-direction
 * converter as Word to PDF; only the slug (output naming) differs. No options.
 */
export const excelToPdf = makeToPdfConverter("excel-to-pdf");
