/**
 * Applies the app's own migrations (db/migrations/0002_*.sql onwards, in order) to a
 * throwaway test database. 0001_auth.sql is skipped: the callers create the auth
 * tables with Better Auth's migration runner first. Tests only; never Neon.
 * Uses only node: built-ins so Node can run it directly (e2e-auth/server.mts).
 */
import { readFileSync, readdirSync } from "node:fs";
import type { Pool } from "pg";

const DIR = new URL("../db/migrations/", import.meta.url);

export async function applyAppMigrations(pool: Pool): Promise<void> {
  const files = readdirSync(DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && !f.startsWith("0001_"))
    .sort();
  for (const file of files) {
    await pool.query(readFileSync(new URL(file, DIR), "utf8"));
  }
}
