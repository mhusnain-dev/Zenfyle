"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type ActionResult } from "@/lib/server/auth-actions";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

/*
 * Reset-password form (Section 6.4 §376). Consumes the single-use token from the
 * emailed link (carried in a hidden field) plus a new password. On success it
 * shows a confirmation with a link to log in; the token is invalidated
 * server-side so the link can't be reused.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    resetPassword,
    null,
  );

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="font-body text-sm text-text">
          Your password has been changed. You can now log in with it.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-card bg-signal px-6 py-3 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <AuthField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {state?.error && (
        <p className="font-body text-[13px] text-error" role="alert">
          {state.error}
        </p>
      )}
      <AuthSubmit>Set new password</AuthSubmit>
    </form>
  );
}
