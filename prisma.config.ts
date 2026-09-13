import "dotenv/config";
import { defineConfig } from "prisma/config";

/*
 * Prisma 7 config. As of v7 the connection URL lives here (used by the migrate
 * and introspection CLI) rather than in schema.prisma's datasource block, and
 * the runtime PrismaClient is built with a driver adapter (see lib/db.ts).
 * The schema provider is "postgresql"; DATABASE_URL is a postgres:// URL.
 *
 * The datasource block is intentionally CONDITIONAL: Railway and similar build
 * platforms run `npm install` / `npm run build` *before* environment variables
 * are populated, and the postinstall step runs `prisma generate`. Generation
 * needs no URL (only migrate/studio/db-push do), so when DATABASE_URL is unset
 * we simply omit datasource instead of letting `env()` throw and kill the build.
 * Runtime still works because lib/db.ts reads DATABASE_URL itself.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(process.env.DATABASE_URL
    ? {
        datasource: {
          url: process.env.DATABASE_URL,
        },
      }
    : {}),
});