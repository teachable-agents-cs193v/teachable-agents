-- Encrypts the user-written parts of teaching sessions (Checkpoint 2; helper from #47,
-- src/lib/crypto/fieldEncryption.ts). Hand-written. Apply after 0002, in one transaction:
--   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_encrypt_teaching_sessions.sql
--
-- Set ENCRYPTION_MASTER_KEY in Vercel BEFORE deploying the code that uses these columns.
--
-- messages, pre_explanation and reflection now hold "v1:<iv>:<ciphertext>:<tag>" strings
-- instead of jsonb/plain text. The app writes every value, including the empty transcript,
-- so `messages` has no default. The checks reject plaintext written by mistake; a new
-- encryption version (key rotation) must widen them.
--
-- WARNING: deletes every existing teaching session. They're plaintext test data, which
-- can't go into the encrypted columns. Users and logins are kept.

delete from teaching_sessions;

alter table teaching_sessions
  drop constraint teaching_sessions_messages_check,
  drop constraint teaching_sessions_reflection_check,
  alter column messages drop default,
  alter column messages type text using messages::text,
  alter column reflection type text using reflection::text,
  add constraint teaching_sessions_messages_encrypted check (messages like 'v1:%'),
  add constraint teaching_sessions_pre_explanation_encrypted check (pre_explanation is null or pre_explanation like 'v1:%'),
  add constraint teaching_sessions_reflection_encrypted check (reflection is null or reflection like 'v1:%');
