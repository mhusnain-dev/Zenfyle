"use client";

import { useActionState, useState } from "react";
import { signOut } from "next-auth/react";
import {
  changePassword,
  deleteAccount,
  type ActionResult,
} from "@/lib/server/auth-actions";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

/*
 * Account section of the dashboard (Section 13.5): shows the email, a
 * change-password form (via the changePassword server action), sign-out, and
 * delete-account. Delete nulls user_id on the person's jobs rather than
 * cascade-deleting history (§623) and is gated behind an explicit confirm so a
 * stray click can't wipe an account.
 */
export function AccountSection({ email }: { email: string }) {
  const [pwState, changePasswordAction] = useActionState<
    ActionResult | null,
    FormData
  >(changePassword, null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <aside className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-medium text-text">Account</h2>
        <p className="mt-2 font-body text-[13px] text-text-secondary">
          Signed in as
        </p>
        <p className="font-body text-sm font-medium text-text">{email}</p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-4 rounded-card border border-border bg-white px-4 py-2 font-body text-[13px] font-medium text-text transition-colors hover:border-signal"
        >
          Sign out
        </button>
      </section>

      <section className="rounded-card border border-border bg-paper-alt p-4">
        <h3 className="font-body text-sm font-medium text-text">
          Change password
        </h3>
        <form action={changePasswordAction} className="mt-3 space-y-3" noValidate>
          <AuthField
            id="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
          />
          <AuthField
            id="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {pwState?.error && (
            <p className="font-body text-[13px] text-error" role="alert">
              {pwState.error}
            </p>
          )}
          {pwState?.ok && (
            <p className="font-body text-[13px] text-text-secondary" role="status">
              Password updated.
            </p>
          )}
          <AuthSubmit>Update password</AuthSubmit>
        </form>
      </section>

      <section className="rounded-card border border-error/30 bg-[#FBEBEB] p-4">
        <h3 className="font-body text-sm font-medium text-text">
          Delete account
        </h3>
        <p className="mt-1 font-body text-[12px] leading-4 text-text-secondary">
          Removes your account permanently. Your past jobs stay in the system
          anonymously but are no longer tied to you. This can&apos;t be undone.
        </p>
        {confirmingDelete ? (
          <div className="mt-3 flex gap-2">
            <form action={deleteAccount}>
              <button
                type="submit"
                className="rounded-card bg-error px-4 py-2 font-body text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Yes, delete my account
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-card border border-border bg-white px-4 py-2 font-body text-[13px] font-medium text-text transition-colors hover:border-signal"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 rounded-card border border-error/40 bg-white px-4 py-2 font-body text-[13px] font-medium text-error transition-colors hover:bg-error/5"
          >
            Delete account
          </button>
        )}
      </section>
    </aside>
  );
}
