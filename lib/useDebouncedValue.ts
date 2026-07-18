"use client";

import { useEffect, useState } from "react";

/*
 * Returns `value` delayed by `delayMs` — used to debounce the homepage search
 * input (Section 13.1: ~150ms before filtering). Resets the timer on every
 * change so filtering only runs once typing pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
