"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ActionResult } from "@/lib/server/auth-actions";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

/*
 * Forgot-password form (Section 6.4). Submits an email to the requestPasswordReset
 * Server Action, which ALWAYS reports success — we never reveal whether an email
 * is registered. On success we show a generic "check your inbox" confirmation
 * instead of the form. Locally the reset link is logged to the server console
 * (ConsoleMailProvider), so the flow is testable with no SMTP.
 */
export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    requestPasswordReset,
    null,
  );

  if (state?.ok) {
    return (
      <div
        className="rounded-card border border-border bg-paper-alt p-4"
        role="status"
      >
        <p className="font-body text-sm font-medium text-text">
          Check your inbox
        </p>
        <p className="mt-1 font-body text-[13px] leading-5 text-text-secondary">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password. The link expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
      />
      <AuthSubmit>Send reset link</AuthSubmit>
    </form>
  );
}
