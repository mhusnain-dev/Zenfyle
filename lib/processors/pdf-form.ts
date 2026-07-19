import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";
import type { PDFDocument, PDFField } from "pdf-lib";

/*
 * Shared form-field reading for Fill PDF Form (Section 11.5/11.6). pdf-lib's
 * form API (getForm().getFields()) exposes each AcroForm field; we map the
 * subset we support to a serializable descriptor the options UI can render an
 * input for. Fields we can't safely fill (buttons, signatures, unknown types)
 * are dropped from the descriptor list rather than shown as broken inputs.
 *
 * kind maps 1:1 to an input control:
 *   text     -> <input type=text>
 *   checkbox -> <input type=checkbox>
 *   dropdown -> <select> (single)
 *   radio    -> <input type=radio> group
 *   optionlist -> <select multiple>
 */
export type FormFieldKind =
  | "text"
  | "checkbox"
  | "dropdown"
  | "radio"
  | "optionlist";

export type FormFieldDescriptor = {
  name: string;
  kind: FormFieldKind;
  /** Current value(s) already in the PDF, used to pre-fill the inputs. */
  current: string | boolean | string[];
  /** Selectable options for dropdown/radio/optionlist. */
  options?: string[];
};

/** Map a live pdf-lib field to our descriptor, or null if unsupported. */
export function describeField(field: PDFField): FormFieldDescriptor | null {
  const name = field.getName();

  if (field instanceof PDFTextField) {
    return { name, kind: "text", current: field.getText() ?? "" };
  }
  if (field instanceof PDFCheckBox) {
    return { name, kind: "checkbox", current: field.isChecked() };
  }
  if (field instanceof PDFDropdown) {
    return {
      name,
      kind: "dropdown",
      current: field.getSelected()[0] ?? "",
      options: field.getOptions(),
    };
  }
  if (field instanceof PDFRadioGroup) {
    return {
      name,
      kind: "radio",
      current: field.getSelected() ?? "",
      options: field.getOptions(),
    };
  }
  if (field instanceof PDFOptionList) {
    return {
      name,
      kind: "optionlist",
      current: field.getSelected(),
      options: field.getOptions(),
    };
  }
  return null; // buttons, signatures, unknown — not fillable in MVP
}

/** Read all supported form fields from a File (for the options UI). */
export async function readFormFields(
  doc: PDFDocument,
): Promise<FormFieldDescriptor[]> {
  const form = doc.getForm();
  const out: FormFieldDescriptor[] = [];
  for (const field of form.getFields()) {
    const desc = describeField(field);
    if (desc) out.push(desc);
  }
  return out;
}

/*
 * Apply a values map (field name -> value) onto a loaded PDF's form. Silently
 * skips names that no longer exist or whose supplied value doesn't fit the
 * field kind, so a stale option value can never crash the fill. Returns the
 * count of fields actually changed.
 */
export function applyFormValues(
  doc: PDFDocument,
  values: Record<string, unknown>,
): number {
  const form = doc.getForm();
  let changed = 0;

  for (const [name, raw] of Object.entries(values)) {
    let field: PDFField;
    try {
      field = form.getField(name);
    } catch {
      continue; // field vanished — skip
    }

    try {
      if (field instanceof PDFTextField) {
        field.setText(raw == null ? "" : String(raw));
      } else if (field instanceof PDFCheckBox) {
        if (raw) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        if (raw) field.select(String(raw));
        else field.clear();
      } else if (field instanceof PDFRadioGroup) {
        if (raw) field.select(String(raw));
        else field.clear();
      } else if (field instanceof PDFOptionList) {
        const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        if (arr.length && arr[0]) field.select(arr);
        else field.clear();
      } else {
        continue;
      }
      changed++;
    } catch {
      // A value that doesn't match the field's allowed options — skip it
      // rather than failing the whole fill.
    }
  }

  return changed;
}
