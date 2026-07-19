/*
 * Shared annotation model for Annotate PDF (slug `edit-pdf`, scope per §4.1c:
 * highlights, text boxes/callouts, and freehand ink ONLY — never editing or
 * deleting the original page text). The editor UI produces these; the
 * edit-pdf processor bakes them onto the pages with pdf-lib.
 *
 * All geometry is stored in a NORMALIZED coordinate space: x/y/width/height
 * and every ink point are fractions (0..1) of the page's width/height, with
 * the ORIGIN AT THE TOP-LEFT (matching how the browser renders and how the
 * user points at the page). The processor flips y to pdf-lib's bottom-left
 * origin once, centrally, so the editor never has to think about PDF space.
 */
export type PageRef = { page: number }; // 1-based page index

export type HighlightAnnotation = PageRef & {
  type: "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  /** hex color, e.g. "#ffd54a" */
  color: string;
};

export type TextAnnotation = PageRef & {
  type: "text";
  x: number;
  y: number;
  text: string;
  /** font size in points (page space, not normalized) */
  size: number;
  color: string;
};

export type InkAnnotation = PageRef & {
  type: "ink";
  /** stroke as normalized points; a stroke needs >= 2 points to draw */
  points: { x: number; y: number }[];
  color: string;
  /** line width in points */
  width: number;
};

export type Annotation =
  | HighlightAnnotation
  | TextAnnotation
  | InkAnnotation;
