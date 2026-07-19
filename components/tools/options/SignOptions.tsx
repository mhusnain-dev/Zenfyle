"use client";

import { useEffect, useRef, useState } from "react";
import type { ProcessOptions } from "@/lib/processors/types";
import { usePageCount } from "@/hooks/usePageCount";

/*
 * Sign PDF options (Section 11.6): draw-with-mouse/touch signature only for
 * MVP. A small canvas captures strokes; on each stroke end we export a
 * transparent-background PNG data URL into options.signature (what the
 * processor embeds). Also picks which page to sign (default: last) and which
 * corner to anchor the signature in.
 *
 * The canvas draws at devicePixelRatio scale so the exported PNG is crisp on
 * retina screens; strokes are pure black on a transparent canvas so only the
 * ink is embedded, never a white box over the page.
 */
const CORNERS: { value: string; label: string }[] = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

export function SignOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const pageCount = usePageCount(files[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);

  const corner = (value.corner as string) ?? "bottom-right";
  const page = (value.page as number) ?? 0; // 0 = last page

  useEffect(() => {
    if (value.corner === undefined) onChange({ corner: "bottom-right", page: 0 });
  }, [value.corner, onChange]);

  // Set up the canvas backing store at device pixel ratio for a crisp line.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const set = (patch: ProcessOptions) => onChange({ ...value, ...patch });

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return;
    setEmpty(false);
    // Export the transparent PNG for the processor to embed.
    set({ signature: canvas.toDataURL("image/png") });
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
    set({ signature: undefined });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-body text-[13px] font-medium text-text">
            Draw your signature
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={empty}
            className="font-body text-[12px] text-text-secondary underline-offset-2 hover:underline disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="mt-1.5 h-40 w-full touch-none rounded-card border border-dashed border-border bg-white"
          aria-label="Signature drawing area"
        />
        <p className="mt-1 font-body text-[12px] text-text-secondary">
          {empty
            ? "Draw with your mouse or finger."
            : "Looks good — you can clear and redraw anytime."}
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="sign-page"
            className="block font-body text-[13px] font-medium text-text"
          >
            Page to sign
          </label>
          <select
            id="sign-page"
            value={page}
            onChange={(e) => set({ page: Number(e.target.value) })}
            className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
          >
            <option value={0}>Last page</option>
            {pageCount
              ? Array.from({ length: pageCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Page {i + 1}
                  </option>
                ))
              : null}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="sign-corner"
            className="block font-body text-[13px] font-medium text-text"
          >
            Position
          </label>
          <select
            id="sign-corner"
            value={corner}
            onChange={(e) => set({ corner: e.target.value })}
            className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
          >
            {CORNERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
