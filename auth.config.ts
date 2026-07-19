import type { NextAuthConfig } from "next-auth";

/*
 * Edge-safe Auth.js config (Section 6.4). This half holds ONLY things that run
 * in the Edge middleware bundle — session strategy, custom pages, and the
 * jwt/session callbacks that thread the user id through. It must NOT import
 * Prisma, bcryptjs, or any Node-only module; the Credentials provider (which
 * does) is added in auth.ts, which runs in the Node runtime. middleware.ts
 * builds a NextAuth instance from THIS config so it can read the JWT session
 * cookie without pulling Node deps into Edge.
 */
export const authConfig = {
  // JWT session strategy (Section 6.4 §377 — no custom session handling).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  // No providers here — the Node-only Credentials provider lives in auth.ts.
  // The Edge instance only needs the secret + callbacks to verify the cookie.
  providers: [],
  callbacks: {
    // Called by the middleware wrapper for matched routes. Returning false (or
    // a redirect) blocks access; Auth.js redirects unauthenticated users to the
    // signIn page above with a callbackUrl back to where they were headed.
    authorized({ auth: session, request }) {
      const isDashboard =
        request.nextUrl.pathname.startsWith("/dashboard");
      if (isDashboard) return Boolean(session?.user);
      return true;
    },
    // Persist the user id onto the token at sign-in so the session exposes it.
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    // Surface the id on session.user so server components/actions can scope
    // queries (job history, account) to the logged-in user.
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
