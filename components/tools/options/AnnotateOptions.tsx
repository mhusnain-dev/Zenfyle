"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProcessOptions } from "@/lib/processors/types";
import type { Annotation } from "@/lib/processors/annotations";

/*
 * Annotate PDF editor (slug `edit-pdf`, scope §4.1c: highlight, text box, and
 * freehand ink ONLY — never editing the original page text). Renders the
 * current page with pdf.js onto a canvas, and captures markup on an overlay in
 * NORMALIZED top-left coordinates (annotations.ts) so it's resolution- and
 * zoom-independent. Collected markup goes up as options.annotations for the
 * edit-pdf processor to bake with pdf-lib.
 *
 * pdf.js is loaded dynamically (client-only) with its worker resolved via
 * import.meta.url so the bundler emits the worker asset — no manual public/
 * copy and no CDN dependency.
 */
type Tool = "move" | "highlight" | "text" | "ink";

const COLORS = ["#ffd54a", "#c0392b", "#1e6fff", "#2ecc71", "#111111"];
const INK_WIDTH = 2;
const TEXT_SIZE = 14;

type Rendered = { canvas: HTMLCanvasElement; width: number; height: number };

export function AnnotateOptions({
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
  // pdf.js document proxy, kept across page switches.
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);

  const [pageNum, setPageNum] = useState(1);
  const [tool, setTool] = useState<Tool>("highlight");
  const [color, setColor] = useState(COLORS[0]);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  // Load result paired with the file it belongs to (usePageCount pattern):
  // a new file reads as "loading" until its own result lands, so no
  // synchronous setState reset is needed inside the effect.
  const [load, setLoad] = useState<
    { file: File; numPages: number } | { file: File; error: true } | null
  >(null);

  const annotations = useMemo(
    () => (value.annotations as Annotation[]) ?? [],
    [value.annotations],
  );
  const setAnnotations = useCallback(
    (next: Annotation[]) => onChange({ ...value, annotations: next }),
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
      // Fit to the container width for a readable page.
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

  // Composite the rendered page + this page's annotations onto the overlay.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !rendered) return;
    overlay.width = rendered.width;
    overlay.height = rendered.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(rendered.canvas, 0, 0);
    drawAnnotations(ctx, annotations, pageNum, overlay.width, overlay.height);
  }, [rendered, annotations, pageNum]);

  // --- drawing interaction ---
  const drag = useRef<
    | null
    | { kind: "highlight"; x0: number; y0: number }
    | { kind: "ink"; points: { x: number; y: number }[] }
    // move: the index (into annotations) being dragged and the last pointer
    // position, so each move applies an incremental delta.
    | { kind: "move"; index: number; last: { x: number; y: number }; moved: boolean }
  >(null);

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
    if (tool === "move") {
      const index = hitTest(annotations, pageNum, p, rendered);
      if (index >= 0) drag.current = { kind: "move", index, last: p, moved: false };
    } else if (tool === "highlight") drag.current = { kind: "highlight", x0: p.x, y0: p.y };
    else if (tool === "ink") drag.current = { kind: "ink", points: [p] };
    else if (tool === "text") {
      const text = window.prompt("Text to add:");
      if (text) {
        setAnnotations([
          ...annotations,
          { type: "text", page: pageNum, x: p.x, y: p.y, text, size: TEXT_SIZE, color },
        ]);
      }
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = norm(e);
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!ctx || !overlay || !rendered) return;

    if (d.kind === "move") {
      // Commit each incremental delta to state so the composite effect repaints;
      // keeps a single source of truth (no separate preview path for move).
      const dx = p.x - d.last.x;
      const dy = p.y - d.last.y;
      d.last = p;
      d.moved = true;
      setAnnotations(
        annotations.map((a, i) => (i === d.index ? translate(a, dx, dy) : a)),
      );
      return;
    }

    // Live preview: repaint page + committed annotations, then the in-progress one.
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(rendered.canvas, 0, 0);
    drawAnnotations(ctx, annotations, pageNum, overlay.width, overlay.height);
    if (d.kind === "highlight") {
      drawAnnotations(
        ctx,
        [{ type: "highlight", page: pageNum, x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), width: Math.abs(p.x - d.x0), height: Math.abs(p.y - d.y0), color }],
        pageNum,
        overlay.width,
        overlay.height,
      );
    } else if (d.kind === "ink") {
      d.points.push(p);
      drawAnnotations(
        ctx,
        [{ type: "ink", page: pageNum, points: d.points, color, width: INK_WIDTH }],
        pageNum,
        overlay.width,
        overlay.height,
      );
    }
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "move") return; // already committed incrementally
    const p = norm(e);
    if (d.kind === "highlight") {
      const w = Math.abs(p.x - d.x0);
      const h = Math.abs(p.y - d.y0);
      if (w > 0.005 && h > 0.005)
        setAnnotations([
          ...annotations,
          { type: "highlight", page: pageNum, x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), width: w, height: h, color },
        ]);
    } else if (d.kind === "ink" && d.points.length >= 2) {
      setAnnotations([
        ...annotations,
        { type: "ink", page: pageNum, points: d.points, color, width: INK_WIDTH },
      ]);
    }
  };

  const undo = () => setAnnotations(annotations.slice(0, -1));
  const clearPage = () =>
    setAnnotations(annotations.filter((a) => a.page !== pageNum));

  const pageCount = annotations.filter((a) => a.page === pageNum).length;

  if (status === "loading")
    return <p className="font-body text-[13px] text-text-secondary">Loading page…</p>;
  if (status === "error")
    return (
      <p className="font-body text-[13px] text-text-secondary">
        Couldn&rsquo;t render this PDF. It may be corrupted or password-protected.
      </p>
    );

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2">
        {(["move", "highlight", "text", "ink"] as Tool[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            className={`rounded-card border px-3 py-1.5 font-body text-[13px] capitalize ${
              tool === t
                ? "border-signal bg-signal/10 text-text"
                : "border-border bg-white text-text-secondary"
            }`}
          >
            {t === "ink"
              ? "Draw"
              : t === "text"
                ? "Text"
                : t === "move"
                  ? "Move"
                  : "Highlight"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={`h-6 w-6 rounded-full border-2 ${
              color === c ? "border-text" : "border-transparent"
            }`}
          />
        ))}
      </div>

      <canvas
        ref={overlayRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{ cursor: tool === "move" ? "move" : "crosshair" }}
        className="w-full touch-none rounded-card border border-border bg-white"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNum((n) => Math.max(1, n - 1))}
            disabled={pageNum <= 1}
            className="rounded-card border border-border px-2.5 py-1 font-body text-[13px] text-text disabled:opacity-40"
          >
            ‹
          </button>
          <span className="font-mono text-[12px] text-text-secondary">
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            onClick={() => setPageNum((n) => Math.min(numPages, n + 1))}
            disabled={pageNum >= numPages}
            className="rounded-card border border-border px-2.5 py-1 font-body text-[13px] text-text disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={annotations.length === 0}
            className="font-body text-[12px] text-text-secondary hover:underline disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={clearPage}
            disabled={pageCount === 0}
            className="font-body text-[12px] text-text-secondary hover:underline disabled:opacity-40"
          >
            Clear page
          </button>
        </div>
      </div>
    </div>
  );
}

/* Paint annotations for one page onto a 2D context, in device pixels. Mirrors
 * the processor's geometry (top-left normalized -> canvas pixels) so what the
 * user sees matches the baked output. */
function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  anns: Annotation[],
  page: number,
  w: number,
  h: number,
) {
  for (const a of anns) {
    if (a.page !== page) continue;
    ctx.save();
    if (a.type === "highlight") {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = a.color;
      ctx.fillRect(a.x * w, a.y * h, a.width * w, a.height * h);
    } else if (a.type === "text") {
      ctx.fillStyle = a.color;
      ctx.font = `${a.size * (h / 792)}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(a.text, a.x * w, a.y * h);
    } else if (a.type === "ink") {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      a.points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h),
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* Return the index of the topmost annotation on `page` under point `p`
 * (normalized), or -1. Iterates back-to-front so the most recently drawn
 * (visually on top) wins. `rendered` gives the pixel aspect used to size the
 * click tolerance for zero-area targets (text baselines, thin ink). */
function hitTest(
  anns: Annotation[],
  page: number,
  p: { x: number; y: number },
  rendered: { width: number; height: number },
): number {
  const padX = 6 / rendered.width; // ~6px grab tolerance
  const padY = 6 / rendered.height;
  for (let i = anns.length - 1; i >= 0; i--) {
    const a = anns[i];
    if (a.page !== page) continue;
    if (a.type === "highlight") {
      if (
        p.x >= a.x - padX &&
        p.x <= a.x + a.width + padX &&
        p.y >= a.y - padY &&
        p.y <= a.y + a.height + padY
      )
        return i;
    } else if (a.type === "text") {
      // Approximate the text box: width from char count, height from size.
      const hNorm = a.size / 792;
      const wNorm = Math.max(0.02, a.text.length * a.size * 0.5) / 612;
      if (
        p.x >= a.x - padX &&
        p.x <= a.x + wNorm + padX &&
        p.y >= a.y - padY &&
        p.y <= a.y + hNorm + padY
      )
        return i;
    } else if (a.type === "ink") {
      // Hit if the point is near any vertex of the stroke.
      if (a.points.some((q) => Math.abs(q.x - p.x) <= padX * 2 && Math.abs(q.y - p.y) <= padY * 2))
        return i;
    }
  }
  return -1;
}

/* Shift an annotation by a normalized delta, returning a new object (state
 * stays immutable). Ink translates every point. */
function translate(a: Annotation, dx: number, dy: number): Annotation {
  if (a.type === "ink")
    return { ...a, points: a.points.map((q) => ({ x: q.x + dx, y: q.y + dy })) };
  return { ...a, x: a.x + dx, y: a.y + dy };
}
