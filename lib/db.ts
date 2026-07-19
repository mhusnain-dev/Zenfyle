import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/*
 * Prisma client singleton (Section 6). Prisma 7 requires a driver adapter at
 * runtime; for local dev that's better-sqlite3 pointed at DATABASE_URL. To move
 * to Postgres (Neon), swap this adapter for @prisma/adapter-pg and change the
 * schema provider — no query code changes.
 *
 * The singleton guard avoids exhausting connections under Next.js dev HMR,
 * which re-imports modules on every edit.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
