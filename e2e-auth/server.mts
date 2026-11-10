/**
 * Started by playwright.auth.config.ts (`npm run test:e2e:auth`). Runs:
 *   1. a throwaway Postgres on 127.0.0.1 with the auth tables, created the same
 *      way the unit tests do (Better Auth's migration runner);
 *   2. a mock Pwned Passwords API that records every request it gets;
 *   3. `next dev` pointed at both, with test-only env values.
 * Everything is deleted when Playwright stops this process. Never touches Neon.
 * Node runs this file directly (TypeScript types are stripped).
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set by playwright.auth.config.ts`);
  return v;
};
const APP_PORT = env("E2E_APP_PORT");
const MOCK_PORT = Number(env("E2E_MOCK_PORT"));
const BREACHED_PREFIX = env("E2E_BREACHED_PREFIX");
const UNAVAILABLE_PREFIX = env("E2E_UNAVAILABLE_PREFIX");
const SERVER_LOG = env("E2E_SERVER_LOG");

const children: ChildProcess[] = [];
const dir = mkdtempSync(path.join(os.tmpdir(), "teachable-e2e-pg-"));
let mock: http.Server | undefined;
// One shared cleanup: every caller (signal, next exiting, a startup error) waits
// for the same run, so nobody exits the process halfway through it.
let cleaning: Promise<void> | undefined;
const cleanup = () => (cleaning ??= runCleanup());
async function runCleanup() {
  mock?.close();
  // Stop next dev and Postgres, and wait for them, before deleting the data directory.
  await Promise.all(
    children.map(
      (c) =>
        new Promise<void>((resolve) => {
          if (c.exitCode !== null || c.signalCode !== null) return resolve();
          // Force-stop anything that ignores the polite signal, so cleanup always finishes.
          const force = setTimeout(() => c.kill("SIGKILL"), 5_000);
          c.once("exit", () => {
            clearTimeout(force);
            resolve();
          });
          c.kill("SIGTERM");
        }),
    ),
  );
  rmSync(dir, { recursive: true, force: true });
}
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await cleanup();
    process.exit(0);
  });
}

function findPgBin(): string {
  const onPath = (process.env.PATH ?? "").split(path.delimiter).find((d) => existsSync(path.join(d, "initdb")));
  if (onPath) return onPath;
  const root = "/usr/lib/postgresql";
  if (existsSync(root)) {
    for (const v of readdirSync(root).sort((a, b) => Number(b) - Number(a))) {
      const bin = path.join(root, v, "bin");
      if (existsSync(path.join(bin, "initdb"))) return bin;
    }
  }
  throw new Error("Postgres server binaries (initdb, postgres) not found; the auth e2e tests need them.");
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

try {
  // 1. Throwaway Postgres.
  const bin = findPgBin();
  const pgPort = await freePort();
  execFileSync(path.join(bin, "initdb"), ["-D", path.join(dir, "data"), "-U", "postgres", "--auth=trust", "-E", "UTF8"], {
    stdio: "ignore",
  });
  children.push(
    spawn(path.join(bin, "postgres"), ["-D", path.join(dir, "data"), "-p", String(pgPort), "-h", "127.0.0.1", "-k", dir], {
      stdio: "ignore",
    }),
  );
  for (let i = 0; ; i++) {
    try {
      execFileSync(path.join(bin, "pg_isready"), ["-q", "-h", "127.0.0.1", "-p", String(pgPort)]);
      break;
    } catch {
      if (i > 100) throw new Error("Throwaway Postgres didn't start.");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const DATABASE_URL = `postgres://postgres@127.0.0.1:${pgPort}/postgres`;

  // Same schema setup as test/postgres.globalSetup.ts. Loaded by URL so tsc doesn't
  // need .ts import extensions; Node strips the types.
  const { authSchemaOptions } = await import(new URL("../src/lib/auth/options.ts", import.meta.url).href);
  const { getMigrations } = await import("better-auth/db/migration");
  const { Pool } = (await import("pg")).default;
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await (await getMigrations(authSchemaOptions(pool))).runMigrations();
  } finally {
    await pool.end();
  }

  // 2. Mock Pwned Passwords range API. Breached prefix: a matching suffix.
  // Unavailable prefix: 503. Anything else: a clean padded response.
  const received: { url: string; padding: string | undefined }[] = [];
  mock = http.createServer((req, res) => {
    if (req.url === "/__requests") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(received));
      return;
    }
    received.push({ url: req.url ?? "", padding: req.headers["add-padding"] as string | undefined });
    const prefix = (req.url ?? "").replace("/range/", "");
    if (prefix === UNAVAILABLE_PREFIX) return void res.writeHead(503).end("unavailable");
    const lines = ["0018A45C4D1DEF81644B54AB7F969B88D65:3", "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0"];
    if (prefix === BREACHED_PREFIX) lines.push(`${process.env.E2E_BREACHED_SUFFIX}:42`);
    res.writeHead(200, { "content-type": "text/plain" }).end(lines.join("\r\n"));
  });
  mock.listen(MOCK_PORT, "127.0.0.1");

  // 3. The app.
  const log = createWriteStream(SERVER_LOG);
  // Run Next's own binary rather than `npx`, whose wrapper doesn't pass signals on.
  const nextBin = new URL("../node_modules/.bin/next", import.meta.url).pathname;
  const next = spawn(nextBin, ["dev", "-p", APP_PORT], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL,
      BETTER_AUTH_SECRET: "test-only-e2e-secret-not-used-anywhere-else-0123",
      BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
      PWNED_PASSWORDS_API_URL: `http://127.0.0.1:${MOCK_PORT}/range/`,
    },
  });
  next.stdout.pipe(log);
  next.stderr.pipe(log);
  next.on("exit", async (code) => {
    await cleanup();
    process.exit(code ?? 1);
  });
  children.push(next);
} catch (e) {
  await cleanup();
  throw e;
}
