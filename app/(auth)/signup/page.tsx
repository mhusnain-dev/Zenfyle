import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupForm } from "@/components/auth/SignupForm";

/*
 * Signup page (Section 6.4 / 13.5). Email + password only, no social login
 * (§374). If already signed in, there's nothing to do here — send to the
 * dashboard. The actual form is a client component (useActionState + signIn).
 */
export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Sign up for a free Zenfyle account for a higher daily limit and job history.",
};

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text">
        Create your account
      </h1>
      <p className="mt-2 font-body text-[13px] leading-5 text-text-secondary">
        Free forever. An account raises your daily limit and keeps your recent
        job history — every tool still works without one.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 font-body text-[13px] text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-signal hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
