import { Download } from "lucide-react";

/*
 * Job-history list (Section 13.5). Read-only server-rendered table of the
 * account's recent jobs: tool name, date, status, and a download link ONLY when
 * the job is still available (success + not expired). Expired jobs show a greyed
 * "Expired" label instead of a broken link (§13.5). Empty state when the account
 * has run nothing yet.
 */
export type JobHistoryRow = {
  id: string;
  toolName: string;
  status: string;
  filename: string;
  createdAt: string;
  downloadUrl: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  success: "bg-[#E7F5EC] text-[#1E7A46]",
  error: "bg-[#FBEBEB] text-error",
  cancelled: "bg-paper-alt text-text-secondary",
  expired: "bg-paper-alt text-text-secondary",
  queued: "bg-icon-bg text-signal",
  processing: "bg-icon-bg text-signal",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Done",
  error: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  queued: "Queued",
  processing: "Processing",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JobHistory({ rows }: { rows: JobHistoryRow[] }) {
  return (
    <section aria-labelledby="job-history-heading">
      <h2
        id="job-history-heading"
        className="font-display text-lg font-medium text-text"
      >
        Recent jobs
      </h2>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-card border border-border bg-paper-alt p-8 text-center">
          <p className="font-body text-sm text-text">No jobs yet</p>
          <p className="mt-1 font-body text-[13px] text-text-secondary">
            Server-processed files you create will show up here for 2 hours.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-card border border-border bg-white">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-body text-sm font-medium text-text">
                  {row.toolName}
                </p>
                <p className="truncate font-body text-[12px] text-text-secondary">
                  {row.filename} · {formatDate(row.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-badge px-2.5 py-1 font-mono text-[11px] font-medium ${
                    STATUS_STYLE[row.status] ?? "bg-paper-alt text-text-secondary"
                  }`}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                {row.downloadUrl && (
                  <a
                    href={row.downloadUrl}
                    className="flex items-center gap-1 font-body text-[13px] font-medium text-signal hover:underline"
                  >
                    <Download size={15} />
                    Download
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
