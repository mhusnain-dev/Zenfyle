import { PDFDocument } from "pdf-lib";

/*
 * Shared PDF load with a consistent, user-facing error (used by every pdf-lib
 * tool). ignoreEncryption lets us surface a clear message rather than throwing
 * deep inside pdf-lib; a genuinely encrypted file still can't be edited and the
 * caller's operation will fail with its own message.
 */
export async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error(
      `"${file.name}" couldn't be read as a PDF. It may be corrupted or not a real PDF.`,
    );
  }
}

/** Serialize a pdf-lib doc to a PDF Blob (fresh ArrayBuffer, see merge note). */
export async function toPdfBlob(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save();
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}
