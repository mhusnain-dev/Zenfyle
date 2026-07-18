import {
  Edit3,
  EyeOff,
  FileMinus,
  FileOutput,
  FileText,
  GitCompare,
  Hash,
  Highlighter,
  Image,
  Layers,
  ListOrdered,
  Lock,
  Minimize2,
  PenLine,
  Presentation,
  RotateCw,
  Scissors,
  Sheet,
  Stamp,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import {
  FaFileExcel,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

/*
 * Section 11.7 icon mapping. Registry entries store the icon as a string;
 * this resolves it to a component. Two icon sets are in play (Section 5,
 * v1.4.0): Lucide stroke icons for actions/UI, and Font Awesome file-type
 * glyphs for file formats. Registry validation fails startup on any unmapped
 * name (Section 12), so both sets must be registered here.
 */

// Lucide action/UI icons — every name verified against installed lucide-react.
const LUCIDE_ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  scissors: Scissors,
  "rotate-cw": RotateCw,
  "list-ordered": ListOrdered,
  "file-minus": FileMinus,
  "file-output": FileOutput,
  "minimize-2": Minimize2,
  "file-text": FileText,
  sheet: Sheet,
  presentation: Presentation,
  image: Image,
  hash: Hash,
  stamp: Stamp,
  highlighter: Highlighter,
  "pen-line": PenLine,
  "edit-3": Edit3,
  lock: Lock,
  unlock: Unlock,
  "eye-off": EyeOff,
  "git-compare": GitCompare,
};

/*
 * File-format icons — Font Awesome file glyphs, each with its format's brand
 * color (v1.4.0). These override the category accent on the card: a colored
 * format icon reads as "the Word icon", "the PDF icon", etc. `tint` is a
 * neutral container so the brand color stays true. NOTE: these are generic
 * file-type glyphs, NOT the trademarked MS/Adobe logos (Section 5 note).
 */
export type FormatIconMeta = { icon: IconType; brand: string; tint: string };

export const FORMAT_ICONS: Record<string, FormatIconMeta> = {
  word: { icon: FaFileWord, brand: "#2B579A", tint: "#EEF2F9" }, // Word blue
  excel: { icon: FaFileExcel, brand: "#217346", tint: "#EAF5EF" }, // Excel green
  powerpoint: { icon: FaFilePowerpoint, brand: "#C43E1C", tint: "#FBEEEA" }, // PPT orange-red
  pdf: { icon: FaFilePdf, brand: "#D0342C", tint: "#FCECEB" }, // PDF red
  "image-file": { icon: FaFileImage, brand: "#0891B2", tint: "#E6F6FA" }, // cyan
};

/** True when the icon name is a brand-colored file-format glyph. */
export function isFormatIcon(name: string): boolean {
  return name in FORMAT_ICONS;
}

// Map a file extension to its format-icon key (Section 11.7, v1.4.0).
const EXT_TO_FORMAT: Record<string, string> = {
  ".pdf": "pdf",
  ".doc": "word",
  ".docx": "word",
  ".xls": "excel",
  ".xlsx": "excel",
  ".ppt": "powerpoint",
  ".pptx": "powerpoint",
  ".jpg": "image-file",
  ".jpeg": "image-file",
  ".png": "image-file",
  ".webp": "image-file",
};

/*
 * Pick the format icon that best represents a tool, from the file types it
 * accepts and produces. Prefers the distinctive non-PDF format (Word, Excel,
 * PPT, image) when one is involved — so "PDF to Word" shows the Word icon and
 * "Word to PDF" does too — falling back to PDF for pure-PDF tools. Priority is
 * fixed and deterministic so the same tool always resolves the same icon.
 */
const FORMAT_PRIORITY = ["word", "excel", "powerpoint", "image-file", "pdf"];

export function formatIconForTool(tool: {
  acceptedTypes: string[];
  outputExtension: string;
  icon: string;
}): FormatIconMeta {
  // An explicit format icon on the registry entry wins (e.g. convert tools).
  if (tool.icon in FORMAT_ICONS) return FORMAT_ICONS[tool.icon];

  const exts = [...tool.acceptedTypes, tool.outputExtension];
  const found = new Set<string>();
  for (const ext of exts) {
    const fmt = EXT_TO_FORMAT[ext.toLowerCase()];
    if (fmt) found.add(fmt);
  }
  for (const fmt of FORMAT_PRIORITY) {
    if (found.has(fmt)) return FORMAT_ICONS[fmt];
  }
  return FORMAT_ICONS.pdf; // every tool in this app touches PDFs
}

/** All resolvable icon names (both sets) — used by registry validation. */
export const KNOWN_ICON_NAMES = new Set<string>([
  ...Object.keys(LUCIDE_ICONS),
  ...Object.keys(FORMAT_ICONS),
]);

/** Resolve a Lucide action icon by name (undefined if it's a format icon). */
export const TOOL_ICONS = LUCIDE_ICONS;
