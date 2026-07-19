"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Protect PDF options (Section 11.6): a single password to set, with a confirm
 * field so a typo doesn't lock the user out of their own file. No permission
 * granularity for MVP — one password becomes both user and owner password
 * (see lib/server/tools/qpdf.ts). The password is reported up via onChange as
 * `password`; the API strips it out of options before persisting so it's never
 * stored (v1.4.1). Options reset per file (Section 13.6), so local confirm
 * state starts empty on each mount.
 */
export function ProtectOptions({
  value,
  onChange,
}: {
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const password = (value.password as string) ?? "";
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label
          htmlFor="protect-password"
          className="block font-body text-[13px] font-medium text-text"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="protect-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => onChange({ password: e.target.value })}
            autoComplete="new-password"
            placeholder="Choose a password"
            className="w-full rounded-card border border-border bg-white px-3 py-2 pr-10 font-body text-[13px] text-text outline-none focus:border-signal"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary hover:text-text"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="protect-confirm"
          className="block font-body text-[13px] font-medium text-text"
        >
          Confirm password
        </label>
        <input
          id="protect-confirm"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Re-enter the password"
          aria-invalid={mismatch}
          className={`w-full rounded-card border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal ${
            mismatch ? "border-error" : "border-border"
          }`}
        />
        {mismatch && (
          <p className="font-body text-[12px] text-error" role="alert">
            Passwords don&apos;t match.
          </p>
        )}
      </div>

      <p className="font-body text-[12px] text-text-secondary">
        You&apos;ll need this password to open the PDF. We never store it — keep
        it somewhere safe, because it can&apos;t be recovered.
      </p>
    </div>
  );
}
