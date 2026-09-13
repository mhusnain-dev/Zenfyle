import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/*
 * Prisma client singleton (Section 6). Prisma 7 requires a driver adapter at
 * runtime; Zenfyle targets Postgres everywhere (Supabase/Neon in prod; local
 * dev points DATABASE_URL at the same Supabase Postgres or a local one), so
 * the adapter is always @prisma/adapter-pg. There is deliberately NO SQLite
 * path: Prisma 7 rejects a driver adapter whose dialect differs from the
 * schema provider, so schema.provider must stay "postgresql".
 *
 * DATABASE_URL must be a postgres:// or postgresql:// URL. It is only needed
 * at RUNTIME: the client is created lazily on first use, so `next build` and
 * `prisma generate` (postinstall, Railway build) succeed with no env vars set.
 * A missing/non-Postgres URL throws a clear error on first query instead.
 *
 * The REAL client is kept on globalThis so dev HMR re-imports (which re-run
 * this module) reuse the same pool instead of exhausting connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function postgresUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
    return url;
  }
  throw new Error(
    "DATABASE_URL must be a postgres:// or postgresql:// URL (e.g. your Supabase " +
      "connection string). It is only required at runtime — Railway injects it " +
      "as a service variable. See .env.example."
  );
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: postgresUrl() });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/*
 * Lazy Proxy: PrismaClient construction (and the DATABASE_URL check) happens
 * on first property access, keeping `next build` / postinstall green without
 * env vars. Methods are bound so `this` stays correct when called via the
 * proxy (e.g. prisma.$transaction(...) or prisma.user.findMany(...)).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (typeof prop === "symbol") return undefined;
    const client = getPrisma();
    const value = (client as unknown as Record<string, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = getPrisma();
}