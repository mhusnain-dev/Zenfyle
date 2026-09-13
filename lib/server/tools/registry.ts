/*
 * Server-tool slug registry. Deliberately lightweight: this file MUST NOT
 * import the tool adapters. The tools barrel (index.ts) pulls in adapters that
 * touch the filesystem with runtime paths (e.g. redact-pdf reads/writes under
 * a per-job workDir), which makes Next.js's file tracer treat the whole project
 * as reachable and trace files like next.config.ts into route bundles. Route
 * handlers only need to know which slugs are implemented, so they import this
 * registry instead of the barrel. Adding a server tool = one adapter file +
 * one slug here + one entry in index.ts (which derives its keys from here, so
 * they can't drift apart).
 */

export const SERVER_TOOL_SLUGS = [
  "compress-pdf",
  "protect-pdf",
  "unlock-pdf",
  "word-to-pdf",
  "excel-to-pdf",
  "ppt-to-pdf",
  "pdf-to-jpg",
  "pdf-to-png",
  "pdf-to-word",
  "pdf-to-ppt",
  "pdf-to-excel",
  "compare-pdf",
  "redact-pdf",
  "ocr-pdf",
] as const;

export function isServerToolImplemented(slug: string): boolean {
  return (SERVER_TOOL_SLUGS as readonly string[]).includes(slug);
}