import { handlers } from "@/auth";

/*
 * Auth.js 5 catch-all route (Section 6.4). Exposes the framework's sign-in/
 * sign-out/session/callback endpoints under /api/auth/*. The configuration
 * (Credentials provider, JWT sessions) lives in the root auth.ts so it can be
 * imported by Server Components and Route Handlers without pulling in the route.
 */
export const runtime = "nodejs"; // Credentials + bcrypt + Prisma need Node, not Edge.

export const { GET, POST } = handlers;
