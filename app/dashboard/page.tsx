import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTool } from "@/lib/registry";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSection } from "@/components/dashboard/AccountSection";
import { JobHistory, type JobHistoryRow } from "@/components/dashboard/JobHistory";

/*
 * Dashboard (Section 13.5). Two sections only for MVP: Account (email,
 * change-password, sign-out, delete-account) and Job history (the account's
 * past jobs; a download link only while the job hasn't expired, otherwise a
 * greyed "Expired" label). Server component: it's behind the middleware's
 * /dashboard gate, but we re-check the session here too (defence in depth) and
 * scope every query to the logged-in user id.
 */
export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

/*
 * Map a job row to its history view model. A plain module-level function (not
 * inside the component) so the `Date.now()` expiry check doesn't trip the
 * react-hooks purity rule — render stays pure, this helper owns the clock read.
 */
type JobRow = {
  id: string;
  toolSlug: string;
  status: string;
  originalFilename: string;
  createdAt: Date;
  expiresAt: Date | null;
  outputFileRef: string | null;
};

function toHistoryRow(j: JobRow): JobHistoryRow {
  const notExpired = j.expiresAt ? j.expiresAt.getTime() > Date.now() : false;
  return {
    id: j.id,
    toolName: getTool(j.toolSlug)?.name ?? j.toolSlug,
    status: j.status,
    filename: j.originalFilename,
    createdAt: j.createdAt.toISOString(),
    // A download is offered only for a still-available successful result
    // (§13.5): success + not expired + an output still on record. The link is
    // the same token the download route enforces (base64url of the output
    // key); the route re-checks status/expiry, so a stale link can't leak.
    downloadUrl:
      j.status === "success" && notExpired && j.outputFileRef
        ? `/api/download/${Buffer.from(j.outputFileRef, "utf8").toString("base64url")}`
        : null,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      toolSlug: true,
      status: true,
      originalFilename: true,
      createdAt: true,
      expiresAt: true,
      outputFileRef: true,
    },
  });

  const rows: JobHistoryRow[] = jobs.map(toHistoryRow);

  return (
    <PageContainer>
      <div className="py-12">
        <h1 className="font-display text-3xl font-semibold text-text">
          Your dashboard
        </h1>
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
          <AccountSection email={user.email} />
          <JobHistory rows={rows} />
        </div>
      </div>
    </PageContainer>
  );
}
