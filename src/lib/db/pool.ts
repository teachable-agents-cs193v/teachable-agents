import "server-only";
import { Pool } from "pg";

/**
 * The app's one shared Postgres pool. Owned by Betania (database); auth uses
 * it too. Reuse this pool rather than creating another one.
 *
 * - `DATABASE_URL` is server-only. On Vercel, use Neon's pooled connection string.
 * - A small `max` keeps serverless instances from exhausting Neon's connections.
 * - Creating a Pool doesn't connect; the first query does, so `next build` and
 *   CI never need a database.
 * - Cached on globalThis so dev-mode hot reloads don't open a new pool each time.
 */
const g = globalThis as typeof globalThis & { __pgPool?: Pool };

export function getPool(): Pool {
  if (!g.__pgPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10_000 });
    // The server may close idle connections. Without a listener that error would
    // crash the process; the pool replaces the connection on its own.
    pool.on("error", (e) => console.error("Idle database connection closed:", e.message));
    g.__pgPool = pool;
  }
  return g.__pgPool;
}
