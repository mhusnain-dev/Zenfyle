"use client";

import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";

/*
 * Read a PDF's page count for the options UI (Split/Remove/Organize). Uses
 * pdf-lib — already loaded for processing — so no pdf.js web-worker setup is
 * needed just to count pages. A failed read must never block the tool
 * (Section 4.2 step 2): on error we return null and the options fall back to
 * working without a known page count.
 *
 * The count is stored paired with the file it was computed for, so switching
 * files reads as "unknown" (null) until the new count loads — without a
 * synchronous reset inside the effect.
 */
export function usePageCount(file: File | undefined): number | null {
  const [entry, setEntry] = useState<{ file: File; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    (async () => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        if (!cancelled) setEntry({ file, count: doc.getPageCount() });
      } catch {
        // preview failure never blocks processing — leave count unknown
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  return entry && entry.file === file ? entry.count : null;
}
