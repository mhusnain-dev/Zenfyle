import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/server/password";

/*
 * Full Auth.js 5 instance (Section 6.4 / §295 pinned library). Runs in the Node
 * runtime: it spreads the edge-safe authConfig (session strategy, pages,
 * callbacks) and adds the Credentials provider, which needs Prisma + bcryptjs
 * and therefore can't live in the Edge middleware bundle (see auth.config.ts).
 *
 * Email + password only — no social login for MVP (§374). The signup and
 * password-reset WRITE paths live in their own route handlers (they create /
 * update the user row); this file only VERIFIES an existing credential.
 */

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A well-formed bcrypt hash that no password matches — used to keep login
// timing roughly constant when the email doesn't exist (avoids user enumeration
// via response time), rather than returning early.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3f5.9pQ2h1yQ0m9y0m9y0m9y0m9y0mC";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user?.passwordHash) {
          // Constant-ish time: compare against a dummy hash so a missing account
          // and a wrong password take a similar amount of work.
          await verifyPassword(password, DUMMY_HASH);
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
