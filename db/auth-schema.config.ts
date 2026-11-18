/**
 * Config for Better Auth's CLI only (`npm run db:generate`). It builds the same
 * schema options the app uses (src/lib/auth/options.ts), without the server-only
 * hooks the CLI can't load.
 *
 * The CLI compares this config with the database in DATABASE_URL and writes the
 * difference as SQL. Run it ONLY against an empty throwaway local Postgres,
 * never Neon (docs/AUTH.md).
 */
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { authSchemaOptions } from "../src/lib/auth/options";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function localDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL to an empty throwaway local Postgres before running db:generate.");
  const { hostname } = new URL(raw);
  if (!LOCAL_HOSTS.has(hostname))
    throw new Error(`db:generate only runs against a local Postgres, not ${hostname}. Never point it at Neon.`);
  return raw;
}

export const auth = betterAuth(authSchemaOptions(new Pool({ connectionString: localDatabaseUrl() })));
