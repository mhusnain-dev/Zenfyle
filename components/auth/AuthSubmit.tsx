"use client";

import { useFormStatus } from "react-dom";

/*
 * Submit button for the auth forms. Reflects both the form's own pending state
 * (useFormStatus, while the Server Action runs) and any extra pending flag the
 * caller passes (e.g. the post-signup signIn transition). Disabled + relabeled
 * while busy so the person can't double-submit.
 */
export function AuthSubmit({
  children,
  pending: extraPending = false,
}: {
  children: React.ReactNode;
  pending?: boolean;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = formPending || extraPending;

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-card bg-signal px-6 py-3 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_20px_rgba(255,107,53,0.36)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    >
      {pending ? "Working…" : children}
    </button>
  );
}
