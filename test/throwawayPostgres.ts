/**
 * Starts a throwaway Postgres cluster on 127.0.0.1 in a fresh temp directory,
 * for tests only. Used by the Vitest setup (test/postgres.globalSetup.ts) and
 * the auth browser-test server (e2e-auth/server.mts). Uses only node: built-ins
 * so Node can also run it directly.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/** initdb/postgres/pg_isready: on PATH, or under /usr/lib/postgresql/<version>/bin. */
export function findPgBin(): string | null {
  const onPath = (process.env.PATH ?? "").split(path.delimiter).find((d) => existsSync(path.join(d, "initdb")));
  if (onPath) return onPath;
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const v of readdirSync(root).sort((a, b) => Number(b) - Number(a))) {
    const bin = path.join(root, v, "bin");
    if (existsSync(path.join(bin, "initdb"))) return bin;
  }
  return null;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = (srv.address() as net.AddressInfo);
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export interface ThrowawayPostgres {
  /** No password: the cluster trusts local connections and is deleted on stop(). */
  url: string;
  /** Stops the server, waits for it to exit, and deletes its directory. Safe to call twice. */
  stop: () => Promise<void>;
}

export async function startThrowawayPostgres(bin: string, prefix = "teachable-pg-"): Promise<ThrowawayPostgres> {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  const port = await freePort();
  let stopping: Promise<void> | undefined;
  let server: ReturnType<typeof spawn> | undefined;

  const stop = () =>
    (stopping ??= (async () => {
      if (server && server.exitCode === null && server.signalCode === null) {
        const exited = new Promise<void>((resolve) => server!.once("exit", () => resolve()));
        const force = setTimeout(() => server!.kill("SIGKILL"), 5_000);
        server.kill("SIGINT");
        await exited;
        clearTimeout(force);
      }
      rmSync(dir, { recursive: true, force: true });
    })());

  try {
    execFileSync(path.join(bin, "initdb"), ["-D", path.join(dir, "data"), "-U", "postgres", "--auth=trust", "-E", "UTF8"], {
      stdio: "ignore",
    });
    let startError: Error | undefined;
    server = spawn(path.join(bin, "postgres"), ["-D", path.join(dir, "data"), "-p", String(port), "-h", "127.0.0.1", "-k", dir], {
      stdio: "ignore",
    });
    // Without a listener a failed spawn (ENOENT, EACCES) would crash the process.
    server.on("error", (e) => (startError = e));
    for (let i = 0; ; i++) {
      if (startError) throw startError;
      if (server.exitCode !== null) throw new Error(`Throwaway Postgres exited during startup (code ${server.exitCode}).`);
      try {
        execFileSync(path.join(bin, "pg_isready"), ["-q", "-h", "127.0.0.1", "-p", String(port)]);
        break;
      } catch {
        if (i > 100) throw new Error("Throwaway Postgres didn't start.");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  } catch (e) {
    await stop();
    throw e;
  }
  return { url: `postgres://postgres@127.0.0.1:${port}/postgres`, stop };
}
