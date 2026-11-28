import "server-only";
import type { Pool } from "pg";
import { getPool } from "./db/pool";

/**
 * Per-user rate limits stored in Postgres (db/migrations/0005_rate_limits.sql), so every
 * Vercel instance sees the same counts. Fixed windows: "at most `max` per `windowSeconds`",
 * counted from the start of the current window (e.g. the current hour).
 *
 * Used by POST and PUT /api/sessions (#58). Meant to be reused for the AI learner's turn
 * limit (#55): add an action name and its limits below.
 */
export interface Limit {
  max: number;
  windowSeconds: number;
}

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/**
 * The limits for each action. Generous for a real student (a class session uses a few
 * sessions and a handful of saves) but they stop a script from filling the database.
 */
export const RATE_LIMITS = {
  /** POST /api/sessions: starting a teaching session. */
  session_create: [
    { max: 30, windowSeconds: HOUR },
    { max: 100, windowSeconds: DAY },
  ],
  /** PUT /api/sessions/[id]: ending a session or saving its reflection. */
  session_update: [
    { max: 120, windowSeconds: HOUR },
    { max: 500, windowSeconds: DAY },
  ],
} satisfies Record<string, Limit[]>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

interface CountRow {
  max: number;
  count: number;
  seconds_left: number;
}

/**
 * Counts one request by `userId` for `action` and says whether it's within every limit.
 * Atomic: concurrent requests from one user can't both slip under a limit. Requests over
 * the limit count too, so retrying in a loop doesn't help until the window ends.
 * `retryAfterSeconds` is when the longest exceeded window ends.
 */
export async function hitRateLimit(
  userId: string,
  action: RateLimitAction,
  pool: Pool = getPool(),
  limits: readonly Limit[] = RATE_LIMITS[action],
): Promise<RateLimitResult> {
  const { rows } = await pool.query<CountRow>(
    `with expired as (
       delete from rate_limit_counts
       where user_id = $1 and action = $2 and window_start + window_seconds * interval '1 second' <= now()
     ),
     limits as (
       select * from unnest($3::int[], $4::int[]) as l(window_seconds, max)
     ),
     counted as (
       insert into rate_limit_counts (user_id, action, window_seconds, window_start)
       select $1, $2, window_seconds, to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds)
       from limits
       on conflict (user_id, action, window_seconds, window_start)
       do update set count = rate_limit_counts.count + 1
       returning window_seconds, window_start, count
     )
     select l.max, c.count,
            ceil(extract(epoch from c.window_start + c.window_seconds * interval '1 second' - now()))::int as seconds_left
     from counted c join limits l using (window_seconds)`,
    [userId, action, limits.map((l) => l.windowSeconds), limits.map((l) => l.max)],
  );

  const exceeded = rows.filter((r) => r.count > r.max);
  if (exceeded.length === 0) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, ...exceeded.map((r) => r.seconds_left)) };
}
