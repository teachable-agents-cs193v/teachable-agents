/**
 * `npm run dev:local`: the app with a throwaway Postgres, for trying it out locally
 * (e.g. on-device Pip) without a dev database. Everything in it is deleted when this stops.
 *   1. a throwaway Postgres (test/throwawayPostgres.ts) with the auth and teaching_sessions tables;
 *   2. `next dev` on 127.0.0.1, with .env.local's LLM_* settings (Next reads .env.local itself).
 * Sign up with any email.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";

const PORT = process.env.PORT ?? "3000";
const repo = (p: string) => new URL(`../${p}`, import.meta.url).href;
const { findPgBin, startThrowawayPostgres } = await import(repo("test/throwawayPostgres.ts"));

const bin = findPgBin();
if (!bin) throw new Error("Postgres server binaries (initdb, postgres) not found.");
const pg = await startThrowawayPostgres(bin, "teachable-dev-pg-");
const { authSchemaOptions } = await import(repo("src/lib/auth/options.ts"));
const { getMigrations } = await import("better-auth/db/migration");
const { applyAppMigrations } = await import(repo("test/appMigrations.ts"));
const { Pool } = (await import("pg")).default;
const pool = new Pool({ connectionString: pg.url });
try {
  await (await getMigrations(authSchemaOptions(pool))).runMigrations();
  await applyAppMigrations(pool);
} finally {
  await pool.end();
}

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  next.kill("SIGTERM");
  await pg.stop();
  process.exit(0);
};
const next: ChildProcess = spawn(new URL(repo("node_modules/.bin/next")).pathname, ["dev", "-H", "127.0.0.1", "-p", PORT], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: pg.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
    BETTER_AUTH_URL: `http://localhost:${PORT}`,
    // The throwaway database is encrypted too (#50); a throwaway key is fine for it.
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY ?? randomBytes(32).toString("base64"),
  },
});
next.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log(`Throwaway database ready. Open http://localhost:${PORT} once Next is up, and sign up with any email.`);
