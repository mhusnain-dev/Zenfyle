"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import type { Tool } from "@/lib/registry";

/*
 * Entry-state upload zone (Section 4.2 step 1 / 11.4). Dashed border, fills
 * with a signal-tinted background on drag-over, always shows a "Browse files"
 * button alongside drag-and-drop. Accepted types and max size come from the
 * tool's registry fields (never hardcoded per page). Uses react-dropzone per
 * the pinned drag-and-drop library rule (Section 5).
 */
export function UploadZone({
  tool,
  onFiles,
  onReject,
}: {
  tool: Tool;
  onFiles: (files: File[]) => void;
  onReject: (message: string) => void;
}) {
  const accept = tool.acceptedTypes.reduce<Record<string, string[]>>(
    (acc, ext) => {
      // Map each accepted extension to a MIME bucket react-dropzone understands.
      const mime =
        ext === ".pdf"
          ? "application/pdf"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream";
      acc[mime] = [...(acc[mime] ?? []), ext];
      return acc;
    },
    {},
  );

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const bad = rejections[0].errors[0];
        onReject(
          bad?.code === "file-too-large"
            ? `That file is over the ${tool.maxFileSizeMb} MB limit for this tool.`
            : bad?.code === "file-invalid-type"
              ? `This tool only accepts ${tool.acceptedTypes.join(", ")}.`
              : (bad?.message ?? "That file couldn't be added."),
        );
      }
      if (accepted.length > 0) onFiles(accepted);
    },
    [onFiles, onReject, tool.acceptedTypes, tool.maxFileSizeMb],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept,
    multiple: tool.acceptsMultipleFiles,
    maxSize: tool.maxFileSizeMb * 1024 * 1024,
    noClick: true, // the explicit Browse button owns click-to-open
    noKeyboard: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`rounded-card border-2 border-dashed p-10 text-center transition-colors ${
        isDragActive
          ? "border-signal bg-icon-bg"
          : "border-border bg-white hover:border-signal/60"
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud
        size={40}
        strokeWidth={1.5}
        className="mx-auto text-signal"
        aria-hidden
      />
      <p className="mt-4 font-display text-lg font-medium text-text">
        {isDragActive
          ? "Drop to add"
          : tool.acceptsMultipleFiles
            ? "Drop your PDFs here"
            : "Drop your file here"}
      </p>
      <button
        type="button"
        onClick={open}
        className="mt-4 rounded-card bg-signal px-5 py-2.5 font-body text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover"
      >
        Browse files
      </button>
      <p className="mt-4 font-mono text-[11px] tracking-wide text-text-secondary">
        {tool.acceptedTypes.join(" · ").toUpperCase()} · up to{" "}
        {tool.maxFileSizeMb} MB{tool.acceptsMultipleFiles ? " each" : ""}
      </p>
    </div>
  );
}
