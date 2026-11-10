/**
 * Starts a throwaway Postgres for the tests and deletes it afterwards, so tests
 * never touch Neon or any shared database.
 *
 * Needs Postgres's server binaries (initdb, postgres, pg_isready): on PATH, or
 * under /usr/lib/postgresql/<version>/bin as on Ubuntu and GitHub's runners.
 * Without them, database tests are skipped locally with a warning, but fail in CI.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { authSchemaOptions } from "../src/lib/auth/options";

function findPgBin(): string | null {
  const onPath = (process.env.PATH ?? "").split(path.delimiter).find((d) => existsSync(path.join(d, "initdb")));
  if (onPath) return onPath;
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
  for (const v of versions) {
    const bin = path.join(root, v, "bin");
    if (existsSync(path.join(bin, "initdb"))) return bin;
  }
  return null;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

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

  const dir = mkdtempSync(path.join(os.tmpdir(), "teachable-pg-"));
  const data = path.join(dir, "data");
  const port = await freePort();
  execFileSync(path.join(bin, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8"], { stdio: "ignore" });
  const server: ChildProcess = spawn(
    path.join(bin, "postgres"),
    ["-D", data, "-p", String(port), "-h", "127.0.0.1", "-k", dir],
    { stdio: "ignore" },
  );
  const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  const teardown = async () => {
    server.kill("SIGINT");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  };

  try {
    for (let i = 0; ; i++) {
      try {
        execFileSync(path.join(bin, "pg_isready"), ["-q", "-h", "127.0.0.1", "-p", String(port)]);
        break;
      } catch {
        if (i > 100) throw new Error("Throwaway Postgres didn't start.");
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // No password: the throwaway cluster trusts local connections and is deleted after the run.
    const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
    process.env.DATABASE_URL = url;
    // Database tests run only when this flag is set, i.e. only against this throwaway cluster.
    process.env.TEST_THROWAWAY_DB = "1";

    // Create the auth tables with Better Auth's own migration runner.
    const pool = new Pool({ connectionString: url });
    try {
      const { runMigrations } = await getMigrations(authSchemaOptions(pool));
      await runMigrations();
    } finally {
      await pool.end();
    }
  } catch (e) {
    // Don't leave a stray server or data directory behind when setup fails.
    await teardown();
    throw e;
  }

  return teardown;
}
