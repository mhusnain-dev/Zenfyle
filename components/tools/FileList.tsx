"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";

/*
 * Selected-file list (Section 4.2 step 2). Shows filename (mono) + size, lets
 * the person remove/replace before processing. For multi-file tools (Merge,
 * Section 11.6) it's reorderable — drag to reorder on the desktop, plus up/down
 * buttons so touch and keyboard users can reorder too (no hover on touch,
 * Section 7). pdf.js page-count preview is a Phase-5 nicety added separately;
 * a failed preview must never block processing (Section 4.2 step 2), so the
 * list works from File metadata alone.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({
  files,
  reorderable,
  onReorder,
  onRemove,
}: {
  files: File[];
  reorderable: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <ul className="space-y-2">
      {files.map((file, i) => (
        <li
          key={`${file.name}-${i}`}
          draggable={reorderable}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => reorderable && e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
            setDragIndex(null);
          }}
          className={`flex items-center gap-3 rounded-card border border-border bg-white px-3 py-2.5 ${
            reorderable ? "cursor-grab active:cursor-grabbing" : ""
          } ${dragIndex === i ? "opacity-50" : ""}`}
        >
          {reorderable && (
            <GripVertical
              size={16}
              className="shrink-0 text-text-secondary"
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[13px] text-text">
              {file.name}
            </span>
            <span className="font-mono text-[11px] text-text-secondary">
              {formatSize(file.size)}
            </span>
          </span>

          {reorderable && (
            <span className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => i > 0 && onReorder(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move ${file.name} up`}
                className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:text-signal disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => i < files.length - 1 && onReorder(i, i + 1)}
                disabled={i === files.length - 1}
                aria-label={`Move ${file.name} down`}
                className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:text-signal disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${file.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:text-error"
          >
            <X size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}
