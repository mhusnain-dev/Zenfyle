"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Unlock PDF options (Section 11.6): the one password the user already knows.
 * Reported up via onChange as `password`; the API strips it out of options
 * before persisting (v1.4.1) and the worker hands it to qpdf over stdin. A
 * wrong password comes back as INVALID_PASSWORD so the error screen tells the
 * user to check it and try again (the file stays loaded for a retry).
 */
export function UnlockOptions({
  value,
  onChange,
}: {
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const password = (value.password as string) ?? "";
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor="unlock-password"
        className="block font-body text-[13px] font-medium text-text"
      >
        Current password
      </label>
      <div className="relative">
        <input
          id="unlock-password"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => onChange({ password: e.target.value })}
          autoComplete="off"
          placeholder="Enter the PDF's password"
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
      <p className="font-body text-[12px] text-text-secondary">
        Enter the password this PDF currently asks for. We only use it to remove
        the protection and never store it.
      </p>
    </div>
  );
}
