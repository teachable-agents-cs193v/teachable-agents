-- Teaching sessions, one row per session, owned by one user (docs/AUTH.md, "Ownership rules").
-- Hand-written (not generated). Apply after 0001_auth.sql, in one transaction:
--   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0002_teaching_sessions.sql
-- The app saves the whole session each time, so the transcript and reflection are
-- jsonb columns on the row rather than separate tables.
create table teaching_sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  topic_id text not null,
  learner_id text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  messages jsonb not null default '[]' check (jsonb_typeof(messages) = 'array'),
  learner_cursor integer not null default 0 check (learner_cursor >= 0),
  pre_explanation text,
  reflection jsonb check (reflection is null or jsonb_typeof(reflection) = 'object'),
  updated_at timestamptz not null default now()
);

-- Every query filters by user_id; lists are newest first.
create index teaching_sessions_user_started_idx on teaching_sessions (user_id, started_at desc);
