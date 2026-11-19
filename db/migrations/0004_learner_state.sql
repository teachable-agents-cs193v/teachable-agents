-- Pip's notebook and turn bookkeeping (src/lib/learner/teachable/pipeline.ts, TeachableState),
-- encrypted like the transcript (src/lib/crypto/fieldEncryption.ts, field "learner_state").
-- Hand-written. Apply after 0003_encrypt_teaching_sessions.sql, in one transaction:
--   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0004_learner_state.sql
--
-- Written only by POST /api/sessions/[id]/turn on the server. The browser's PUT can't
-- change it, and GET never returns it: it holds the assessor's hidden verdicts and
-- paraphrases of the student's messages. The app stores JSON.stringify(state) encrypted,
-- as a "v1:<iv>:<ciphertext>:<tag>" string; the check rejects plaintext written by mistake.
-- Null means the session hasn't used the AI learner yet (or uses the scripted one).
--
-- Drops any earlier plaintext jsonb learner_state column first (from an older, unencrypted
-- version of this migration). 0003 deletes every session anyway, so nothing is lost.

alter table teaching_sessions drop column if exists learner_state;

alter table teaching_sessions
  add column learner_state text
  constraint teaching_sessions_learner_state_encrypted check (learner_state is null or learner_state like 'v1:%');
