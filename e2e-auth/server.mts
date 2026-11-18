/**
 * Started through e2e-auth/webServer.ts by playwright.auth.config.ts
 * (`npm run test:e2e:auth`) and playwright.config.ts (`npm run test:e2e`). Runs:
 *   1. a throwaway Postgres (test/throwawayPostgres.ts) with the auth and
 *      teaching_sessions tables, created the same way the unit tests do;
 *   2. a mock Pwned Passwords API that records every request it gets;
 *   3. Next pointed at both, with test-only env values: `next dev`, or with
 *      E2E_PRODUCTION_BUILD=1 `next build` then `next start` (no on-demand
 *      compiling or live reload, which made the student flow flaky; #30).
 * Everything is deleted when Playwright stops this process. Never touches Neon.
 * Node runs this file directly (TypeScript types are stripped). Repo modules are
 * loaded by URL so tsc doesn't need `.ts` import extensions.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import http from "node:http";

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
const BREACHED_SUFFIX = env("E2E_BREACHED_SUFFIX");
const PRODUCTION = process.env.E2E_PRODUCTION_BUILD === "1";

const repo = (p: string) => new URL(`../${p}`, import.meta.url).href;
const { findPgBin, startThrowawayPostgres } = await import(repo("test/throwawayPostgres.ts"));

let pg: { url: string; stop: () => Promise<void> } | undefined;
let next: ChildProcess | undefined;
let mock: http.Server | undefined;

/** Stops a child, waiting for it to exit (force-stopping it after 5s). */
function stopChild(c: ChildProcess | undefined) {
  return new Promise<void>((resolve) => {
    if (!c || c.exitCode !== null || c.signalCode !== null) return resolve();
    const force = setTimeout(() => c.kill("SIGKILL"), 5_000);
    c.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    c.kill("SIGTERM");
  });
}

// Idempotent: every caller (a signal, next exiting, a startup error) awaits one run.
let cleaning: Promise<void> | undefined;
const cleanup = () =>
  (cleaning ??= (async () => {
    mock?.close();
    await stopChild(next);
    await pg?.stop();
  })());
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await cleanup();
    process.exit(0);
  });
}

try {
  // 1. Throwaway Postgres with the auth tables.
  const bin = findPgBin();
  if (!bin) throw new Error("Postgres server binaries (initdb, postgres) not found; the auth e2e tests need them.");
  pg = await startThrowawayPostgres(bin, "teachable-e2e-pg-");
  const { authSchemaOptions } = await import(repo("src/lib/auth/options.ts"));
  const { getMigrations } = await import("better-auth/db/migration");
  const { applyAppMigrations } = await import(repo("test/appMigrations.ts"));
  const { Pool } = (await import("pg")).default;
  const pool = new Pool({ connectionString: pg!.url });
  try {
    await (await getMigrations(authSchemaOptions(pool))).runMigrations();
    await applyAppMigrations(pool); // teaching_sessions
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
    if (prefix === BREACHED_PREFIX) lines.push(`${BREACHED_SUFFIX}:42`);
    res.writeHead(200, { "content-type": "text/plain" }).end(lines.join("\r\n"));
  });
  // A taken port arrives as an async "error" event, outside this try/catch.
  mock.on("error", async (e) => {
    console.error(`Mock breach API couldn't start on port ${MOCK_PORT}:`, (e as Error).message);
    await cleanup();
    process.exit(1);
  });
  mock.listen(MOCK_PORT, "127.0.0.1");

  // 3. The app. Next's own binary, not `npx`, whose wrapper doesn't pass signals on.
  const log = createWriteStream(SERVER_LOG);
  const nextBin = new URL(repo("node_modules/.bin/next")).pathname;
  const nextEnv = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: pg!.url,
    BETTER_AUTH_SECRET: "test-only-e2e-secret-not-used-anywhere-else-0123",
    BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
    PWNED_PASSWORDS_API_URL: `http://127.0.0.1:${MOCK_PORT}/range/`,
  };
  const runNext = (args: string[]) => {
    const child = spawn(nextBin, args, { stdio: ["ignore", "pipe", "pipe"], env: nextEnv });
    child.stdout!.pipe(log, { end: false });
    child.stderr!.pipe(log, { end: false });
    return child;
  };
  if (PRODUCTION) {
    // Same env as the server, so the build sees exactly what `next start` will.
    // Writes .next; `next dev` uses .next/dev, so a running dev server is unaffected.
    next = runNext(["build"]);
    const code = await new Promise<number | null>((resolve) => next!.once("exit", resolve));
    if (code !== 0) throw new Error(`next build exited with ${code ?? "a signal"}; see ${SERVER_LOG}`);
  }
  next = runNext([PRODUCTION ? "start" : "dev", "-p", APP_PORT]);
  // If next dies on its own, clean up and fail. During a normal shutdown cleanup has
  // already started; the signal handler then exits 0.
  next.on("exit", async (code) => {
    if (cleaning) return;
    await cleanup();
    process.exit(code ?? 1);
  });
} catch (e) {
  await cleanup();
  throw e;
}
