-- Pip's notebook and turn bookkeeping (src/lib/learner/teachable/pipeline.ts, TeachableState).
-- Hand-written. Apply after 0002_teaching_sessions.sql, in one transaction:
--   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_learner_state.sql
-- Written only by POST /api/sessions/[id]/turn on the server. The browser's PUT can't
-- change it, and GET never returns it: it holds the assessor's hidden verdicts.
-- Null means the session hasn't used the AI learner yet (or uses the scripted one).
alter table teaching_sessions
  add column learner_state jsonb
  check (learner_state is null or jsonb_typeof(learner_state) = 'object');
