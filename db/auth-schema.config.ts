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

export const auth = betterAuth(authSchemaOptions(new Pool({ connectionString: process.env.DATABASE_URL })));
