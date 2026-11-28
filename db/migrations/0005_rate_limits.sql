-- Per-user request counts for rate limiting (src/lib/rateLimit.ts, #58).
-- Hand-written. Apply after 0004_learner_state.sql, in one transaction:
--   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0005_rate_limits.sql
--
-- Fixed windows: one row per user, action and window (e.g. "session_create" in the hour
-- starting 14:00). The counts live in Postgres, not in memory, because Vercel runs many
-- short-lived instances that don't share memory (docs/AUTH.md, "Known limitations").
-- Each hit deletes that user's expired rows for the action, so the table stays small.

create table rate_limit_counts (
  user_id text not null references users (id) on delete cascade,
  action text not null check (length(action) between 1 and 64),
  window_seconds integer not null check (window_seconds > 0),
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  primary key (user_id, action, window_seconds, window_start)
);
