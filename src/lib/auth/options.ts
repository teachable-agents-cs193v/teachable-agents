import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";

/**
 * The Better Auth settings that decide the database schema (docs/AUTH.md).
 *
 * Deliberately free of `server-only` imports and hooks: Better Auth's CLI loads
 * this (via db/auth-schema.config.ts) to generate migrations, and it can't
 * resolve `server-only`. Hooks don't affect the schema, so they live in auth.ts.
 */
export function authSchemaOptions(database: Pool) {
  return {
    database,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    // Renamed so they don't collide with teaching sessions or the reserved word `user`.
    user: { modelName: "users" },
    session: { modelName: "auth_session" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
  } satisfies BetterAuthOptions;
}
