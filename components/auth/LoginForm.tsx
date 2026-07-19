"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

/*
 * Login form (Section 6.4). Calls Auth.js's Credentials sign-in via the
 * next-auth/react client helper with redirect:false so we can show an inline
 * error on bad credentials rather than bouncing to an error page. On success we
 * push to the callbackUrl (set by the middleware when it bounced an
 * unauthenticated user off /dashboard) or the dashboard by default.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("That email or password doesn't match. Try again.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4" noValidate>
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
        autoComplete="current-password"
        required
      />
      {error && (
        <p className="font-body text-[13px] text-error" role="alert">
          {error}
        </p>
      )}
      <AuthSubmit pending={pending}>Log in</AuthSubmit>
    </form>
  );
}
