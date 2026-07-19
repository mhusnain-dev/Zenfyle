"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Redact PDF options (§4.1c: PERMANENT removal, never a cosmetic overlay). The
 * person draws rectangles over the areas to remove; the server-side redact-pdf
 * adapter rasterizes each page, burns those regions to solid black, and rebuilds
 * a searchable text layer with OCR MINUS the redacted areas — so the original
 * text is gone from both the pixels and the extractable text, not hidden under a
 * box. This panel only captures the regions.
 *
 * Boxes are stored in NORMALIZED page coordinates (0–1, top-left origin) as
 * options.redactions, so they're independent of render zoom/DPI — the server
 * scales them to whatever resolution it rasterizes at. Mirrors the pdf.js render
 * approach in AnnotateOptions (worker resolved via import.meta.url).
 */

export type RedactBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rendered = { canvas: HTMLCanvasElement; width: number; height: number };

export function RedactOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const file = files[0];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<{
    numPages: number;
    getPage: (n: number) => Promise<unknown>;
  } | null>(null);

  const [pageNum, setPageNum] = useState(1);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [load, setLoad] = useState<
    { file: File; numPages: number } | { file: File; error: true } | null
  >(null);

  const boxes = useMemo(
    () => (value.redactions as RedactBox[]) ?? [],
    [value.redactions],
  );
  const setBoxes = useCallback(
    (next: RedactBox[]) => onChange({ ...value, redactions: next }),
    [onChange, value],
  );

  const status: "loading" | "ready" | "error" =
    !load || load.file !== file
      ? "loading"
      : "error" in load
        ? "error"
        : "ready";
  const numPages = load && !("error" in load) ? load.numPages : 0;

  // Load the PDF once per file.
  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const data = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        docRef.current = doc as never;
        setPageNum(1);
        setLoad({ file, numPages: doc.numPages });
      } catch {
        if (!cancelled) setLoad({ file, error: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render the current page to an offscreen canvas whenever it changes.
  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    if (!doc || status !== "ready") return;

    (async () => {
      const page = (await doc.getPage(pageNum)) as {
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: {
          canvasContext: CanvasRenderingContext2D;
          viewport: unknown;
        }) => { promise: Promise<void> };
      };
      const maxW = containerRef.current?.clientWidth ?? 640;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(maxW / base.width, 2);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      setRendered({ canvas, width: canvas.width, height: canvas.height });
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNum, status]);

  // Composite the rendered page + this page's redaction boxes onto the overlay.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !rendered) return;
    overlay.width = rendered.width;
    overlay.height = rendered.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(rendered.canvas, 0, 0);
    // Draw committed boxes for this page as solid black with a thin outline so
    // they read as "this content is removed" (matching the permanent result).
    for (const b of boxes) {
      if (b.page !== pageNum) continue;
      ctx.fillStyle = "#000000";
      ctx.fillRect(
        b.x * overlay.width,
        b.y * overlay.height,
        b.width * overlay.width,
        b.height * overlay.height,
      );
    }
  }, [rendered, boxes, pageNum]);

  // --- draw interaction: drag a rectangle ---
  const drag = useRef<null | { x0: number; y0: number }>(null);

  const norm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rendered) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = norm(e);
    drag.current = { x0: p.x, y0: p.y };
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !rendered) return;
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!ctx || !overlay) return;
    const p = norm(e);
    // Repaint base + committed boxes, then a live preview of the drag.
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(rendered.canvas, 0, 0);
    for (const b of boxes) {
      if (b.page !== pageNum) continue;
      ctx.fillStyle = "#000000";
      ctx.fillRect(
        b.x * overlay.width,
        b.y * overlay.height,
        b.width * overlay.width,
        b.height * overlay.height,
      );
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(
      Math.min(d.x0, p.x) * overlay.width,
      Math.min(d.y0, p.y) * overlay.height,
      Math.abs(p.x - d.x0) * overlay.width,
      Math.abs(p.y - d.y0) * overlay.height,
    );
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !rendered) return;
    const p = norm(e);
    const x = Math.min(d.x0, p.x);
    const y = Math.min(d.y0, p.y);
    const width = Math.abs(p.x - d.x0);
    const height = Math.abs(p.y - d.y0);
    // Ignore accidental taps (too small to be a real selection).
    if (width < 0.01 || height < 0.01) return;
    setBoxes([...boxes, { page: pageNum, x, y, width, height }]);
  };

  const removeLastOnPage = () => {
    for (let i = boxes.length - 1; i >= 0; i--) {
      if (boxes[i].page === pageNum) {
        setBoxes(boxes.filter((_, idx) => idx !== i));
        return;
      }
    }
  };

  const pageBoxCount = boxes.filter((b) => b.page === pageNum).length;

  if (status === "error") {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        This PDF couldn&apos;t be opened for redaction. It may be damaged or
        password-protected — try Unlock PDF first.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="text-sm text-[var(--text-secondary)]">Loading page…</p>
    );
  }

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <p className="text-sm text-[var(--text-secondary)]">
        Drag to draw a box over anything you want gone. The content underneath
        is <strong>permanently removed</strong> — it can&apos;t be recovered
        from the result.
      </p>

      <canvas
        ref={overlayRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="w-full cursor-crosshair rounded-md border border-[var(--border)] touch-none"
        aria-label={`Redaction editor, page ${pageNum} of ${numPages}. Drag to mark areas for permanent removal.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPageNum((n) => Math.max(1, n - 1))}
          disabled={pageNum <= 1}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-[var(--text-secondary)]">
          Page {pageNum} / {numPages}
        </span>
        <button
          type="button"
          onClick={() => setPageNum((n) => Math.min(numPages, n + 1))}
          disabled={pageNum >= numPages}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          onClick={removeLastOnPage}
          disabled={pageBoxCount === 0}
          className="ml-auto rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Undo box on this page
        </button>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        {boxes.length === 0
          ? "No areas marked yet."
          : `${boxes.length} area${boxes.length === 1 ? "" : "s"} marked across the document.`}
      </p>
    </div>
  );
}
