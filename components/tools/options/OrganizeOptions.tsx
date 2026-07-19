"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, X } from "lucide-react";
import type { ProcessOptions } from "@/lib/processors/types";
import { usePageCount } from "@/hooks/usePageCount";

/*
 * Organize Pages options (Section 11.6): reorder, delete, or duplicate pages.
 * We render one chip per page in the current sequence and emit `order` as a
 * list of 0-based source indices (the processor rebuilds the doc in that
 * order). Reorder = move a chip; delete = remove a chip; duplicate = insert a
 * copy of the chip's source index. No thumbnails for MVP — chips show the
 * original page number, matching the FileList approach (Section 4.2 step 2).
 * Move/duplicate/delete are buttons so touch + keyboard work (Section 7).
 */
export function OrganizeOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const pageCount = usePageCount(files[0]);
  const order = (value.order as number[] | undefined) ?? null;

  // Seed the sequence 0..n-1 once the page count is known.
  useEffect(() => {
    if (order === null && pageCount && pageCount > 0) {
      onChange({ order: Array.from({ length: pageCount }, (_, i) => i) });
    }
  }, [order, pageCount, onChange]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (!order) {
    return (
      <p className="font-body text-[13px] text-text-secondary">
        Reading pages…
      </p>
    );
  }

  const update = (next: number[]) => onChange({ order: next });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    update(next);
  };
  const duplicate = (pos: number) => {
    const next = [...order];
    next.splice(pos + 1, 0, order[pos]);
    update(next);
  };
  const remove = (pos: number) => {
    if (order.length <= 1) return; // keep at least one page
    update(order.filter((_, i) => i !== pos));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-body text-[13px] font-medium text-text">
          Arrange pages
        </p>
        <span className="font-body text-[12px] text-text-secondary">
          {order.length} page{order.length === 1 ? "" : "s"} in output
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {order.map((src, pos) => (
          <li
            key={`${src}-${pos}`}
            draggable
            onDragStart={() => setDragIndex(pos)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== pos) move(dragIndex, pos);
              setDragIndex(null);
            }}
            className={`flex cursor-grab flex-col items-center gap-1 rounded-card border border-border bg-white p-2 active:cursor-grabbing ${
              dragIndex === pos ? "opacity-50" : ""
            }`}
          >
            <span className="flex h-12 w-10 items-center justify-center rounded bg-paper-alt font-mono text-[13px] text-text">
              {src + 1}
            </span>
            <span className="flex items-center">
              <button
                type="button"
                onClick={() => move(pos, pos - 1)}
                disabled={pos === 0}
                aria-label={`Move page ${src + 1} earlier`}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-signal disabled:opacity-30"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(pos, pos + 1)}
                disabled={pos === order.length - 1}
                aria-label={`Move page ${src + 1} later`}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-signal disabled:opacity-30"
              >
                <ArrowRight size={13} />
              </button>
            </span>
            <span className="flex items-center">
              <button
                type="button"
                onClick={() => duplicate(pos)}
                aria-label={`Duplicate page ${src + 1}`}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-signal"
              >
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={() => remove(pos)}
                disabled={order.length <= 1}
                aria-label={`Delete page ${src + 1}`}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-error disabled:opacity-30"
              >
                <X size={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="font-body text-[12px] text-text-secondary">
        Drag to reorder, or use the arrows. Copy duplicates a page; × removes it.
      </p>
    </div>
  );
}
