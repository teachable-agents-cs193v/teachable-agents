/**
 * Starts a throwaway Postgres for the tests and deletes it afterwards, so tests
 * never touch Neon or any shared database. Without Postgres's server binaries,
 * database tests are skipped locally with a warning, but fail in CI.
 */
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { authSchemaOptions } from "../src/lib/auth/options";
import { findPgBin, startThrowawayPostgres } from "./throwawayPostgres";

export default async function setup() {
  const bin = findPgBin();
  if (!bin) {
    if (process.env.CI) throw new Error("Postgres server binaries not found; database tests can't run.");
    console.warn("\n[tests] Postgres not found: database tests will be SKIPPED. Install Postgres to run them.\n");
    // Never let a DATABASE_URL (e.g. Neon) or a stray flag from the shell reach the tests.
    delete process.env.DATABASE_URL;
    delete process.env.TEST_THROWAWAY_DB;
    return;
  }

  const pg = await startThrowawayPostgres(bin);
  try {
    process.env.DATABASE_URL = pg.url;
    // Database tests run only when this flag is set, i.e. only against this throwaway cluster.
    process.env.TEST_THROWAWAY_DB = "1";
    // Create the auth tables with Better Auth's own migration runner.
    const pool = new Pool({ connectionString: pg.url });
    try {
      await (await getMigrations(authSchemaOptions(pool))).runMigrations();
    } finally {
      await pool.end();
    }
  } catch (e) {
    await pg.stop();
    throw e;
  }
  return pg.stop;
}
