"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signup, type ActionResult } from "@/lib/server/auth-actions";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

/*
 * Signup form (Section 6.4). Calls the signup Server Action; on success it signs
 * the new credential in via Auth.js's client signIn (no separate login step)
 * and lands on the dashboard. Errors render inline from the action result.
 */
export function SignupForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    signup,
    null,
  );
  const [signingIn, startSignIn] = useTransition();
  const [signInError, setSignInError] = useState<string | null>(null);

  // On a successful account create, sign in with the same credentials. We read
  // them from the submitted form via a hidden mirror rather than re-prompting.
  useEffect(() => {
    if (!state?.ok) return;
    const email = pendingCredentials.email;
    const password = pendingCredentials.password;
    if (!email) return;
    startSignIn(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setSignInError(
          "Account created, but automatic sign-in failed. Please log in.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }, [state, router]);

  return (
    <form
      action={(fd) => {
        // Stash credentials so the post-success effect can sign in with them.
        pendingCredentials.email = String(fd.get("email") ?? "");
        pendingCredentials.password = String(fd.get("password") ?? "");
        setSignInError(null);
        formAction(fd);
      }}
      className="space-y-4"
      noValidate
    >
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
      />
      {(state?.error || signInError) && (
        <p className="font-body text-[13px] text-error" role="alert">
          {signInError ?? state?.error}
        </p>
      )}
      <AuthSubmit pending={signingIn}>Create account</AuthSubmit>
    </form>
  );
}

// Module-scoped scratch for the credentials to sign in with after signup. Fine
// because the form is single-instance per page; avoids threading them through
// the action's return value (which must stay serializable and password-free).
const pendingCredentials: { email: string; password: string } = {
  email: "",
  password: "",
};
