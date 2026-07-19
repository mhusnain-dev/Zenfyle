"use client";

/*
 * Options panel for Compare PDF (§4.3, §251). The comparison itself takes no
 * settings — it's a straight text diff — so this panel is informational: it
 * confirms which file is treated as the original vs the changed version (the
 * first vs second in the list) and states the text-diff scope up front, so the
 * result screen's note isn't the first time a person learns it isn't a visual
 * comparison. Owns no state and reports nothing up.
 */
export function CompareOptions({ files }: { files: File[] }) {
  const [first, second] = files;

  return (
    <div className="space-y-3">
      <p className="font-body text-[13px] leading-5 text-text-secondary">
        The comparison reads the text of both PDFs and highlights what changed —
        removed text in red, added text in green. It compares text, not the
        visual layout, fonts, or images, and can&apos;t read scanned
        (image-only) documents.
      </p>
      {first && second && (
        <dl className="space-y-1.5 rounded-card bg-paper p-3 font-body text-[13px]">
          <div className="flex gap-2">
            <dt className="shrink-0 text-text-secondary">Original:</dt>
            <dd className="truncate text-text">{first.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-text-secondary">Compared to:</dt>
            <dd className="truncate text-text">{second.name}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
