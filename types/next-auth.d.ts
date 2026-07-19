import type { DefaultSession } from "next-auth";

/*
 * Augment Auth.js's Session so `session.user.id` (set by the session callback
 * in auth.ts from the JWT) is typed — Credentials + JWT strategy doesn't add it
 * by default. Keeps server code that reads the user id off strict-mode `any`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
