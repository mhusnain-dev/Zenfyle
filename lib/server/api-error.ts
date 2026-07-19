import { NextResponse } from "next/server";

/*
 * Error contract (Section 6.2): every server-side endpoint returns errors as
 * `{ error: { code, message } }` — never a raw stack trace or library text. The
 * codes are the fixed enum from Section 13.7. `message` is the human-facing
 * string; the real underlying error is logged server-side (never sent) so
 * UNKNOWN_ERROR responses stay debuggable.
 */
export type ErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_CORRUPTED"
  | "FILE_ENCRYPTED"
  | "INVALID_PASSWORD"
  | "TOOL_UNAVAILABLE"
  | "QUEUE_FULL"
  | "QUEUE_TIMEOUT"
  | "WORKER_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "UNKNOWN_ERROR";

const STATUS: Record<ErrorCode, number> = {
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  FILE_CORRUPTED: 400,
  FILE_ENCRYPTED: 400,
  INVALID_PASSWORD: 400,
  TOOL_UNAVAILABLE: 404,
  QUEUE_FULL: 429,
  QUEUE_TIMEOUT: 504,
  WORKER_ERROR: 500,
  RATE_LIMIT_EXCEEDED: 429,
  UNKNOWN_ERROR: 500,
};

export function apiError(
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS[code], headers: extra?.headers as HeadersInit | undefined },
  );
}
