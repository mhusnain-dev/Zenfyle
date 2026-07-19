import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/*
 * Route protection (Section 13.5 dashboard is authed-only). This is Next 16's
 * `proxy` convention (the renamed `middleware`). Runs on the Edge runtime, so it
 * uses the edge-safe authConfig WITHOUT the Credentials provider (which pulls in
 * Prisma + bcryptjs, Node-only). The `authorized` callback in auth.config.ts
 * decides access; the matcher scopes the proxy to /dashboard so public pages and
 * static assets skip auth entirely.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*"],
};
