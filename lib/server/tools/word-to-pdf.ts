import { makeToPdfConverter } from "./libreoffice";

/*
 * Word to PDF adapter (Section 11.5) — .docx/.doc → PDF via LibreOffice (the
 * single soffice spawn point in ./libreoffice). This direction is lossless and
 * reliable, unlike the PDF→Word reverse. No options (NoOptions in the registry).
 */
export const wordToPdf = makeToPdfConverter("word-to-pdf");
