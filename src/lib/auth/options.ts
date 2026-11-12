import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";

/** Password length limits; the signup form and its messages use these too. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

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
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      autoSignIn: true,
    },
    // Renamed so they don't collide with teaching sessions or the reserved word `user`.
    user: { modelName: "users" },
    session: { modelName: "auth_session" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
  } satisfies BetterAuthOptions;
}
