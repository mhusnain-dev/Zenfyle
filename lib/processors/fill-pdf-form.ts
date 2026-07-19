import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { applyFormValues } from "@/lib/processors/pdf-form";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Fill PDF Form — Section 11.5 (client, pdf-lib form field API). The
 * FillFormOptions component reads the AcroForm fields from the uploaded PDF and
 * collects a value per field into options.values (name -> value). Here we load
 * the PDF, apply those values, and save. Only PDFs that actually carry form
 * fields are fillable; the options UI shows a clear "no fields" message for
 * flat PDFs, and the processor guards the same case so a direct run can't
 * silently produce an unchanged file.
 */
const SLUG = "fill-pdf-form";

export const fillPdfForm: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF form.");

  const values = (input.options.values as Record<string, unknown>) ?? {};

  onProgress(20, "Reading form");
  const pdf = await loadPdf(file);
  if (signal.aborted) throw new Error("cancelled");

  const fieldCount = pdf.getForm().getFields().length;
  if (fieldCount === 0) {
    throw new Error(
      "This PDF has no fillable form fields. Use Annotate or Sign to add text or a signature instead.",
    );
  }

  onProgress(55, "Filling fields");
  const changed = applyFormValues(pdf, values);
  if (signal.aborted) throw new Error("cancelled");

  onProgress(85, "Saving");
  const blob = await toPdfBlob(pdf);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary:
      changed > 0
        ? `Filled ${changed} field${changed === 1 ? "" : "s"}`
        : "Saved the form (no fields changed)",
  };
};
