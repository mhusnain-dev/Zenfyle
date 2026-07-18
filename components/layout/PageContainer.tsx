import type { ReactNode } from "react";

/*
 * Section 2: max content width 1200px, centered, 24px side padding on mobile.
 */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px] px-6">{children}</div>;
}
