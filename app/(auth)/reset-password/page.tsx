import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

/*
 * Reset-password page (Section 6.4 §376). Reached from the emailed link, which
 * carries the single-use token as ?token=. If the token is missing we show a
 * dead-end with a path back to request a fresh link rather than an empty form.
 * Token validity/expiry is checked server-side when the form is submitted.
 */
export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text">
        Choose a new password
      </h1>
      {token ? (
        <>
          <p className="mt-2 font-body text-[13px] leading-5 text-text-secondary">
            Enter a new password for your account. This link works once.
          </p>
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 font-body text-[13px] leading-5 text-text-secondary">
            This reset link is missing its token. Request a new one to continue.
          </p>
          <p className="mt-6 font-body text-[13px] text-text-secondary">
            <Link
              href="/forgot-password"
              className="font-medium text-signal hover:underline"
            >
              Request a new reset link
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
