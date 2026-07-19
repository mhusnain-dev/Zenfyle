import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/*
 * Prisma 7 config. As of v7 the connection URL lives here (used by the migrate
 * and introspection CLI) rather than in schema.prisma's datasource block, and
 * the runtime PrismaClient is built with a driver adapter (see lib/db.ts).
 * Swapping to Postgres later = change DATABASE_URL + the schema provider.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
