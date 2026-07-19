"use client";

import { useEffect, useRef, useState } from "react";
import type { ProcessOptions } from "@/lib/processors/types";
import type { FormFieldDescriptor } from "@/lib/processors/pdf-form";
import { loadPdf } from "@/lib/processors/load-pdf";
import { readFormFields } from "@/lib/processors/pdf-form";

/*
 * Fill PDF Form options (Section 11.6): read the uploaded PDF's AcroForm fields
 * and render one control per field, pre-filled with any value already in the
 * PDF. Collected values go up as options.values (name -> value) for the
 * processor. Flat PDFs (no fields) show an honest message — pdf-lib can only
 * fill existing form fields, it can't invent them (§4.1c / anti-hallucination).
 */
type Loaded =
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; fields: FormFieldDescriptor[] };

export function FillFormOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const file = files[0];
  // Result stored paired with the file it was computed for (usePageCount
  // pattern): switching files reads as "loading" until the new read lands —
  // no synchronous setState reset inside the effect.
  const [entry, setEntry] = useState<{ file: File; result: Loaded } | null>(null);
  // Guard so we only seed defaults once per file load.
  const seededFor = useRef<File | null>(null);

  const values = (value.values as Record<string, unknown>) ?? {};

  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    (async () => {
      try {
        const doc = await loadPdf(file);
        const fields = await readFormFields(doc);
        if (cancelled) return;
        if (fields.length === 0) {
          setEntry({ file, result: { status: "empty" } });
          return;
        }
        setEntry({ file, result: { status: "ready", fields } });
        // Seed options.values from the PDF's existing values, once.
        if (seededFor.current !== file) {
          seededFor.current = file;
          const seed: Record<string, unknown> = {};
          for (const f of fields) seed[f.name] = f.current;
          onChange({ values: seed });
        }
      } catch {
        if (!cancelled) setEntry({ file, result: { status: "error" } });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, onChange]);

  const state: Loaded | { status: "loading" } =
    entry && entry.file === file ? entry.result : { status: "loading" };

  const setField = (name: string, v: unknown) =>
    onChange({ values: { ...values, [name]: v } });

  if (state.status === "loading")
    return (
      <p className="font-body text-[13px] text-text-secondary">
        Reading form fields…
      </p>
    );

  if (state.status === "error")
    return (
      <p className="font-body text-[13px] text-text-secondary">
        Couldn&rsquo;t read this PDF&rsquo;s form fields. It may be corrupted.
      </p>
    );

  if (state.status === "empty")
    return (
      <p className="font-body text-[13px] text-text-secondary">
        This PDF has no fillable form fields. Try the Annotate or Sign tool to
        add text or a signature instead.
      </p>
    );

  return (
    <div className="space-y-3">
      {state.fields.map((f) => {
        const v = values[f.name];
        const id = `ff-${f.name}`;
        return (
          <div key={f.name}>
            <label
              htmlFor={id}
              className="block font-body text-[13px] font-medium text-text"
            >
              {f.name}
            </label>

            {f.kind === "text" && (
              <input
                id={id}
                type="text"
                value={(v as string) ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
              />
            )}

            {f.kind === "checkbox" && (
              <label className="mt-1 flex cursor-pointer items-center gap-2.5">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) => setField(f.name, e.target.checked)}
                  className="accent-signal"
                />
                <span className="font-body text-[13px] text-text-secondary">
                  Checked
                </span>
              </label>
            )}

            {f.kind === "dropdown" && (
              <select
                id={id}
                value={(v as string) ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
              >
                <option value="">— none —</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}

            {f.kind === "radio" && (
              <div className="mt-1.5 flex flex-wrap gap-3">
                {f.options?.map((o) => (
                  <label
                    key={o}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="radio"
                      name={id}
                      checked={v === o}
                      onChange={() => setField(f.name, o)}
                      className="accent-signal"
                    />
                    <span className="font-body text-[13px] text-text">{o}</span>
                  </label>
                ))}
              </div>
            )}

            {f.kind === "optionlist" && (
              <select
                id={id}
                multiple
                value={(v as string[]) ?? []}
                onChange={(e) =>
                  setField(
                    f.name,
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  )
                }
                className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
              >
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
