import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

/*
 * Forgot-password page (Section 6.4 §376). Requests a reset link; the server
 * action always reports success so we never leak which emails are registered.
 * Locally the link is logged to the server console (ConsoleMailProvider) — see
 * lib/server/mail/. The link lands on /reset-password?token=…
 */
export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your Zenfyle account.",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text">
        Reset your password
      </h1>
      <p className="mt-2 font-body text-[13px] leading-5 text-text-secondary">
        Enter your email and we&apos;ll send a link to set a new password.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 font-body text-[13px] text-text-secondary">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-signal hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
