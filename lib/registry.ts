/*
 * Tool registry — specs.md Section 4. Single source of truth for every tool.
 * The header dropdown, homepage grid, and tool pages all render from this
 * array; tool metadata may not be duplicated anywhere else (Section 12).
 * Immutable at runtime; validated at startup by lib/registry.validate.ts.
 */

export type ToolCategory =
  | "organize"
  | "convert"
  | "compress"
  | "edit-sign"
  | "security";

export type ToolStatus = "active" | "comingSoon" | "beta" | "disabled";

export type Tool = {
  slug: string;
  name: string;
  category: ToolCategory;
  badge: string;
  icon: string; // Lucide icon name (Section 11.7) — resolved via lib/icons.ts
  description: string; // one line; reused for dropdown, homepage card, meta description
  processing: "client" | "server";
  requiresJobQueue: boolean; // always mirrors processing === 'server' (Section 4)
  acceptedTypes: string[];
  maxFileSizeMb: number; // Section 13.2
  searchKeywords: string[];
  featured: boolean; // false until real usage data exists (Section 4)
  homepageOrder: number;
  status: ToolStatus; // 'comingSoon' until the tool's build phase ships it (Section 9)
  acceptsMultipleFiles: boolean;
  outputExtension: string; // "" = output keeps the input file's extension (image tools)
  optionsComponent: string; // Section 4.3 lookup-map key
  relatedTools: string[];
};

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  organize: "Merge & Organize",
  convert: "Convert",
  compress: "Compress & Optimize",
  "edit-sign": "Edit & Sign",
  security: "Security",
};

export const CATEGORY_ORDER: ToolCategory[] = [
  "organize",
  "convert",
  "compress",
  "edit-sign",
  "security",
];

export const TOOLS: readonly Tool[] = [
  // ── Organize ────────────────────────────────────────────────────────────
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    category: "organize",
    badge: "MULTI -> 1",
    icon: "layers",
    description: "Combine multiple PDFs into one file",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["combine", "join"],
    featured: false,
    homepageOrder: 1,
    status: "active",
    acceptsMultipleFiles: true,
    outputExtension: ".pdf",
    optionsComponent: "MergeOptions",
    relatedTools: ["split-pdf", "organize-pages"],
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    category: "organize",
    badge: "1 -> MULTI",
    icon: "scissors",
    description: "Extract pages into separate files",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["separate", "divide"],
    featured: false,
    homepageOrder: 2,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "SplitOptions",
    relatedTools: ["merge-pdf", "extract-pages"],
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    category: "organize",
    badge: "PDF (rotate)",
    icon: "rotate-cw",
    description: "Fix sideways or upside-down pages",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["turn", "flip", "orientation"],
    featured: false,
    homepageOrder: 3,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "RotateOptions",
    relatedTools: ["organize-pages", "merge-pdf"],
  },
  {
    slug: "organize-pages",
    name: "Organize Pages",
    category: "organize",
    badge: "PDF",
    icon: "list-ordered",
    description: "Reorder, delete, or duplicate pages",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["reorder", "rearrange", "sort"],
    featured: false,
    homepageOrder: 4,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "OrganizeOptions",
    relatedTools: ["rotate-pdf", "remove-pages"],
  },
  {
    slug: "remove-pages",
    name: "Remove Pages",
    category: "organize",
    badge: "PDF",
    icon: "file-minus",
    description: "Delete specific pages from a document",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["delete", "cut"],
    featured: false,
    homepageOrder: 5,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "RemovePagesOptions",
    relatedTools: ["organize-pages", "extract-pages"],
  },
  {
    slug: "extract-pages",
    name: "Extract Pages",
    category: "organize",
    badge: "PDF",
    icon: "file-output",
    description: "Pull selected pages into a new PDF",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["select", "pick", "pages"],
    featured: false,
    homepageOrder: 6,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "ExtractPagesOptions",
    relatedTools: ["split-pdf", "remove-pages"],
  },

  // ── Convert ─────────────────────────────────────────────────────────────
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    category: "convert",
    badge: "PDF -> DOCX",
    icon: "word",
    description: "Turn PDFs into editable Word documents",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 30,
    searchKeywords: ["docx", "word", "editable"],
    featured: false,
    homepageOrder: 1,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".docx",
    optionsComponent: "NoOptions",
    relatedTools: ["word-to-pdf", "pdf-to-excel"],
  },
  {
    slug: "word-to-pdf",
    name: "Word to PDF",
    category: "convert",
    badge: "DOCX -> PDF",
    icon: "word",
    description: "Convert Word documents to PDF",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".docx", ".doc"],
    maxFileSizeMb: 30,
    searchKeywords: ["docx", "word"],
    featured: false,
    homepageOrder: 2,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-word", "excel-to-pdf"],
  },
  {
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    category: "convert",
    badge: "PDF -> XLSX",
    icon: "excel",
    description: "Extract tables into Excel spreadsheets",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 30,
    searchKeywords: ["xlsx", "spreadsheet", "table"],
    featured: false,
    homepageOrder: 3,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".xlsx",
    optionsComponent: "NoOptions",
    relatedTools: ["excel-to-pdf", "pdf-to-word"],
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    category: "convert",
    badge: "XLSX -> PDF",
    icon: "excel",
    description: "Convert spreadsheets to PDF",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".xlsx", ".xls"],
    maxFileSizeMb: 30,
    searchKeywords: ["xlsx", "spreadsheet"],
    featured: false,
    homepageOrder: 4,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-excel", "word-to-pdf"],
  },
  {
    slug: "pdf-to-ppt",
    name: "PDF to PPT",
    category: "convert",
    badge: "PDF -> PPTX",
    icon: "powerpoint",
    description: "Turn PDFs into PowerPoint slides",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 30,
    searchKeywords: ["pptx", "powerpoint", "slides"],
    featured: false,
    homepageOrder: 5,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pptx",
    optionsComponent: "NoOptions",
    relatedTools: ["ppt-to-pdf", "pdf-to-word"],
  },
  {
    slug: "ppt-to-pdf",
    name: "PPT to PDF",
    category: "convert",
    badge: "PPTX -> PDF",
    icon: "powerpoint",
    description: "Convert presentations to PDF",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pptx", ".ppt"],
    maxFileSizeMb: 30,
    searchKeywords: ["pptx", "powerpoint"],
    featured: false,
    homepageOrder: 6,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-ppt", "word-to-pdf"],
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    category: "convert",
    badge: "PDF -> JPG",
    icon: "image-file",
    description: "Save PDF pages as JPG images",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 20,
    searchKeywords: ["jpeg", "image", "picture"],
    featured: false,
    homepageOrder: 7,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".jpg",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-png", "jpg-to-pdf"],
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "convert",
    badge: "JPG -> PDF",
    icon: "image-file",
    description: "Wrap JPG images into a PDF",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".jpg", ".jpeg"],
    maxFileSizeMb: 20,
    searchKeywords: ["jpeg", "image", "photo"],
    featured: false,
    homepageOrder: 8,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-jpg", "compress-image"],
  },
  {
    slug: "pdf-to-png",
    name: "PDF to PNG",
    category: "convert",
    badge: "PDF -> PNG",
    icon: "image-file",
    description: "Save PDF pages as PNG images",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 20,
    searchKeywords: ["image", "transparent"],
    featured: false,
    homepageOrder: 9,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".png",
    optionsComponent: "NoOptions",
    relatedTools: ["pdf-to-jpg", "jpg-to-pdf"],
  },

  // ── Compress & Optimize ─────────────────────────────────────────────────
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    category: "compress",
    badge: "PDF (shrink)",
    icon: "minimize-2",
    description: "Shrink PDF file size without wrecking quality",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 100,
    searchKeywords: ["shrink", "reduce", "smaller", "size"],
    featured: false,
    homepageOrder: 1,
    status: "active", // Phase 6: server-side Ghostscript compression is live
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "CompressOptions",
    relatedTools: ["compress-image", "optimize-for-web"],
  },
  {
    slug: "compress-image",
    name: "Compress Image",
    category: "compress",
    badge: "IMG (shrink)",
    icon: "minimize-2",
    description: "Reduce image file size for sharing",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp"],
    maxFileSizeMb: 20,
    searchKeywords: ["shrink", "reduce", "photo", "size"],
    featured: false,
    homepageOrder: 2,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: "",
    optionsComponent: "CompressOptions",
    relatedTools: ["optimize-for-web", "compress-pdf"],
  },
  {
    slug: "optimize-for-web",
    name: "Optimize for Web",
    category: "compress",
    badge: "IMG -> WEB",
    icon: "minimize-2",
    description: "Convert and compress images for fast websites",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp"],
    maxFileSizeMb: 20,
    searchKeywords: ["webp", "website", "fast"],
    featured: false,
    homepageOrder: 3,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".webp",
    optionsComponent: "CompressOptions",
    relatedTools: ["compress-image", "compress-pdf"],
  },

  // ── Edit & Sign ─────────────────────────────────────────────────────────
  {
    slug: "add-page-numbers",
    name: "Add Page Numbers",
    category: "edit-sign",
    badge: "PDF +N",
    icon: "hash",
    description: "Stamp page numbers onto every page",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["numbering", "pagination"],
    featured: false,
    homepageOrder: 1,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "PageNumbersOptions",
    relatedTools: ["add-watermark", "edit-pdf"],
  },
  {
    slug: "add-watermark",
    name: "Add Watermark",
    category: "edit-sign",
    badge: "PDF +WM",
    icon: "stamp",
    description: "Overlay a text watermark on your PDF",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["stamp", "brand", "overlay"],
    featured: false,
    homepageOrder: 2,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "WatermarkOptions",
    relatedTools: ["add-page-numbers", "sign-pdf"],
  },
  {
    // Display name is "Annotate PDF"; slug stays edit-pdf (Section 4.1c).
    // Scope: markup on top of pages only — never implies editing original text.
    slug: "edit-pdf",
    name: "Annotate PDF",
    category: "edit-sign",
    badge: "PDF (markup)",
    icon: "highlighter",
    description: "Highlight, draw, and add notes on top of a PDF",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["annotate", "highlight", "draw", "markup", "edit"],
    featured: false,
    homepageOrder: 3,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "AnnotateOptions",
    relatedTools: ["sign-pdf", "add-watermark"],
  },
  {
    slug: "sign-pdf",
    name: "Sign PDF",
    category: "edit-sign",
    badge: "PDF (sign)",
    icon: "pen-line",
    description: "Draw and place your signature on a PDF",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["signature", "esign"],
    featured: false,
    homepageOrder: 4,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "SignOptions",
    relatedTools: ["fill-pdf-form", "edit-pdf"],
  },
  {
    slug: "fill-pdf-form",
    name: "Fill PDF Form",
    category: "edit-sign",
    badge: "PDF (form)",
    icon: "edit-3",
    description: "Fill out interactive PDF form fields",
    processing: "client",
    requiresJobQueue: false,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["form", "fields", "fill"],
    featured: false,
    homepageOrder: 5,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "FillFormOptions",
    relatedTools: ["sign-pdf", "edit-pdf"],
  },

  // ── Security ────────────────────────────────────────────────────────────
  {
    slug: "protect-pdf",
    name: "Protect PDF",
    category: "security",
    badge: "PDF +LOCK",
    icon: "lock",
    description: "Add password protection to a PDF",
    processing: "server", // qpdf — Section 11.5 agreed fix
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["password", "encrypt", "secure"],
    featured: false,
    homepageOrder: 1,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "ProtectOptions",
    relatedTools: ["unlock-pdf", "redact-pdf"],
  },
  {
    slug: "unlock-pdf",
    name: "Unlock PDF",
    category: "security",
    badge: "PDF -LOCK",
    icon: "unlock",
    description: "Remove a password you know from a PDF",
    processing: "server", // qpdf — Section 11.5 agreed fix
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["password", "decrypt", "remove"],
    featured: false,
    homepageOrder: 2,
    status: "active",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "UnlockOptions",
    relatedTools: ["protect-pdf", "redact-pdf"],
  },
  {
    // Section 4.1c: permanent content removal, never a cosmetic overlay.
    slug: "redact-pdf",
    name: "Redact PDF",
    category: "security",
    badge: "PDF (redact)",
    icon: "eye-off",
    description: "Permanently remove sensitive content from a PDF",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["black out", "censor", "remove", "sensitive"],
    featured: false,
    homepageOrder: 3,
    status: "comingSoon",
    acceptsMultipleFiles: false,
    outputExtension: ".pdf",
    optionsComponent: "RedactOptions",
    relatedTools: ["protect-pdf", "compare-pdf"],
  },
  {
    // Section 4.1c: text-level diff only; no visual diff, no scanned PDFs.
    slug: "compare-pdf",
    name: "Compare PDF",
    category: "security",
    badge: "PDF <> PDF",
    icon: "git-compare",
    description: "See text differences between two PDFs",
    processing: "server",
    requiresJobQueue: true,
    acceptedTypes: [".pdf"],
    maxFileSizeMb: 50,
    searchKeywords: ["diff", "difference", "versions"],
    featured: false,
    homepageOrder: 4,
    status: "comingSoon",
    acceptsMultipleFiles: true,
    outputExtension: ".pdf",
    optionsComponent: "CompareOptions",
    relatedTools: ["redact-pdf", "protect-pdf"],
  },
];

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category).sort(
    (a, b) => a.homepageOrder - b.homepageOrder,
  );
}

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/*
 * Resolve a tool's relatedTools slugs to Tool objects, preserving order and
 * dropping any that don't exist (registry validation already guarantees they
 * do, but this keeps callers total). Used by tool pages in Phase 5+.
 */
export function getRelatedTools(slug: string): Tool[] {
  const tool = getTool(slug);
  if (!tool) return [];
  return tool.relatedTools
    .map(getTool)
    .filter((t): t is Tool => t !== undefined);
}

/*
 * Registry-backed search — matches name, description, and searchKeywords
 * (Section 13.1 search overlay, Phase 4). Case-insensitive substring match;
 * name matches rank above keyword/description matches. Single source of truth:
 * search reads the registry, never a separate index.
 */
export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { tool: Tool; score: number }[] = [];
  for (const tool of TOOLS) {
    const name = tool.name.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (tool.searchKeywords.some((k) => k.toLowerCase().startsWith(q)))
      score = 1;
    else if (
      tool.description
        .toLowerCase()
        .split(/\W+/)
        .some((w) => w.startsWith(q))
    )
      score = 0.5;
    if (score > 0) scored.push({ tool, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map((s) => s.tool);
}

/** Featured tools for "Popular" placements — empty until usage data exists. */
export function getFeaturedTools(): Tool[] {
  return TOOLS.filter((t) => t.featured);
}
