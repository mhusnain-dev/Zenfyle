import type { ReactNode } from "react";
import Link from "next/link";

/*
 * Shared layout for the auth pages (/login, /signup, /forgot-password,
 * /reset-password) — a centered card on the paper background, matching the
 * homepage surface rhythm (Section 2). Kept minimal: the global Header/Footer
 * already wrap this from the root layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-gradient-to-b from-[#FEFBF7] to-[#FCF4E9] px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 block text-center font-display text-2xl font-semibold text-text"
        >
          Zenfyle
        </Link>
        <div className="rounded-card border border-card-border bg-white p-8 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
          {children}
        </div>
      </div>
    </div>
  );
}
