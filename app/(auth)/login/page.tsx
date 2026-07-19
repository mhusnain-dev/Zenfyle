import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/LoginForm";

/*
 * Login page (Section 6.4). Email + password via Auth.js Credentials. Already
 * signed in → dashboard. LoginForm reads the callbackUrl search param, so it's
 * wrapped in Suspense per Next's requirement for useSearchParams.
 */
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Zenfyle account.",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text">
        Welcome back
      </h1>
      <p className="mt-2 font-body text-[13px] leading-5 text-text-secondary">
        Log in to see your job history and higher daily limit.
      </p>
      <div className="mt-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <div className="mt-6 flex items-center justify-between font-body text-[13px] text-text-secondary">
        <Link href="/signup" className="font-medium text-signal hover:underline">
          Create an account
        </Link>
        <Link
          href="/forgot-password"
          className="hover:text-text hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
