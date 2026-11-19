# Deploying auth

Two people, in order:

- **Part A**, Betania (database): create the Postgres database if needed and apply the auth migration.
- **Part B**, Chase (Vercel): add the four environment variables and redeploy, then run the smoke test.

Everything below uses placeholders like `<your-production-domain>`. Real values never go in this file or anywhere else in the repo.

> ⚠️ **The database connection string contains the database password.** Share it only privately: give the other person their own access to the database console, or use a password-manager share. **Never** paste it in chat, Slack, email, an issue or PR, a commit, or any file in the repo. If it leaks, reset the database password and update Vercel.

## Part A: Betania (database)

**Before you start:** #28 (`db/migrations/0001_auth.sql`) and #32 (`db/migrations/0002_teaching_sessions.sql`) are approved by Betania and Anahi and merged to `main`.

1. **Create the database, if there isn't one yet.**
   - **Neon:** create a project, or use the existing one. Note its production branch and database name.
   - **Another Postgres host:** any standard Postgres works. The migration uses only `text`, `boolean` and `timestamptz` columns, and was tested on Postgres 18 locally. Require SSL (`sslmode=require`). Vercel runs many short-lived servers, so use the host's **pooled** connection option if it has one.
2. **Get two connection strings** (on Neon, from the **Connect** dialog):
   - **Direct** (pooling **off**): used once, for step 3.
   - **Pooled** (pooling **on**; on Neon the host contains `-pooler`): for Chase's `DATABASE_URL`.
3. **Apply the migration** from the repo folder, on an up-to-date `main`:
   ```bash
   read -rs DB_DIRECT_URL && export DB_DIRECT_URL     # paste the DIRECT string; hidden, not saved to history
   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0001_auth.sql
   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0002_teaching_sessions.sql
   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_encrypt_teaching_sessions.sql
   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0004_learner_state.sql
   psql "$DB_DIRECT_URL" -c '\dt'                     # expect: users, auth_session, auth_account, auth_verification, teaching_sessions
   unset DB_DIRECT_URL
   ```
   - Apply the files in number order. `-1` runs each whole file in one transaction, so a failure halfway leaves nothing behind.
   - "Already exists" means it was applied before. Stop and check; don't force it.
   - Never point `npm run db:generate` at this database. It refuses non-local databases anyway.
4. **Get the pooled string to Chase privately.** The best option is to give Chase his own access to the database project, so he copies it himself. Otherwise use a password-manager share.
5. **Tell Anahi and Chase "migration applied"**, saying which database and branch, but **not** the connection string.

### Encrypting teaching sessions (`0003_encrypt_teaching_sessions.sql`)

This changes the transcript, pre-explanation and reflection columns to hold encrypted values. **The order matters**, because the old code can't read the new columns and the new code can't write the old ones:

1. **Chase:** set `ENCRYPTION_MASTER_KEY` in Vercel for every environment (see Part B, step 2).
2. **Betania:** check the session count, then apply the migration. ⚠️ **It deletes every existing teaching session** (plaintext test data that can't go into the encrypted columns). Users and logins are kept.
   ```bash
   read -rs DB_DIRECT_URL && export DB_DIRECT_URL
   psql "$DB_DIRECT_URL" -c 'select count(*) from teaching_sessions'   # make sure these are all test sessions
   psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_encrypt_teaching_sessions.sql
   psql "$DB_DIRECT_URL" -c '\d teaching_sessions'                     # expect messages/reflection as text, and *_encrypted checks
   unset DB_DIRECT_URL
   ```
3. **Merge and deploy right after.** Between steps 2 and 3, saving and loading sessions on the live site fails, so do them together.
4. **Smoke test:** start a session on the live site, send a message, log out and back in, and check that it's still there. In the Neon SQL Editor, `select left(messages, 3) from teaching_sessions` should show `v1:`.

### Pip's notebook (`0004_learner_state.sql`)

Adds `teaching_sessions.learner_state` (Pip's notebook, per-turn history and the assessor's verdicts), stored encrypted like the transcript. It must be applied **after `0003`, and before deploying the code that uses it** (otherwise every AI turn fails with a missing column). It drops any earlier plaintext `learner_state` column first; `0003` has already deleted every session, so nothing is lost.

```bash
read -rs DB_DIRECT_URL && export DB_DIRECT_URL
psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0004_learner_state.sql
psql "$DB_DIRECT_URL" -c '\d teaching_sessions'   # expect learner_state as text, with teaching_sessions_learner_state_encrypted
unset DB_DIRECT_URL
```

Smoke test after the deploy: send Pip a message on the live site, then in the Neon SQL Editor `select left(learner_state, 3) from teaching_sessions where learner_state is not null` should show `v1:`.

## Part B: Chase (Vercel)

**Before you start:** Betania has said the migration is applied, and you have the **pooled** connection string through a private channel.

1. **Generate the session secret** on your own computer:
   ```bash
   openssl rand -base64 32
   ```
   - Copy it **straight into Vercel** (step 2); don't save it anywhere else.
   - Use a **different** one for Preview if you set Preview variables.
   - The app refuses to start in production if this is missing, shorter than 32 characters, or still the `.env.example` placeholder.
2. **Add the environment variables** (Vercel → Project → Settings → Environment Variables):

   | Name | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | the **pooled** string from Betania | Mark **Sensitive**. Production only, unless Preview has its own database |
   | `BETTER_AUTH_SECRET` | output of step 1 | Mark **Sensitive**. A separate value per environment |
   | `BETTER_AUTH_URL` | `https://<your-production-domain>` | Exact, with no trailing slash |
   | `ENCRYPTION_MASTER_KEY` | output of `openssl rand -base64 32` | Mark **Sensitive**. A separate value per environment; see below |
   | `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | The AI learner's provider (any OpenAI-compatible API) |
   | `LLM_API_KEY` | the provider's API key | Mark **Sensitive**. Without it Pip falls back to the scripted learner |
   | `LLM_MODEL` | `openai/gpt-oss-120b` | Default model for every role |
   | `LLM_MODEL_ASSESSOR` | `openai/gpt-oss-120b` | Optional. The assessor sees the answer key; keep it on the strong model |
   | `LLM_MODEL_PIP` | `openai/gpt-oss-20b` | Optional. The note-taker and Pip's reply; a separate quota on Groq |

   - **`ENCRYPTION_MASTER_KEY`:** each tier (development, preview, production) needs its own, generated with `openssl rand -base64 32`, with a backup kept outside the repo (for example in the team password manager), because losing it makes the encrypted data unreadable.
   - **Deploy order:** set `ENCRYPTION_MASTER_KEY` in Vercel for each tier **before** any code that calls `encryptField` is deployed to that tier. Otherwise every save fails on the live site.
   - Don't set `PWNED_PASSWORDS_API_URL`; it's for tests only.
   - Don't add a `NEXT_PUBLIC_` prefix to any of these.
   - Don't set `DEVICE_PIP_EXPERIMENT`, `NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT` or `NEXT_PUBLIC_DEVICE_PIP_URL`: the on-device Pip is a local experiment and stays off in production.
3. **Redeploy.** Variables only apply to new deployments: Deployments → latest `main` → **Redeploy**.
4. **Smoke test on the live site**, with an email you control and a test-only password:

   | # | Do | Expect |
   |---|---|---|
   | 1 | Logged out, open `/sessions` | Redirect to `/login?next=%2Fsessions` |
   | 2 | Sign up with password `Password1` | "…harder to guess" with tips; no account created |
   | 3 | Sign up with a long passphrase of unrelated words | Land on `/topics`; the Navbar says "Hi, ‹first name›" |
   | 4 | Open `/sessions` | The page loads |
   | 5 | Log out, then press Back | Home page with "Log in"; `/sessions` doesn't reappear |
   | 6 | Log in with a wrong password, then the right one | First "That email and password don't match an account.", then logged in |
   | 7 | Vercel → Logs | No errors about `BETTER_AUTH_SECRET` or `DATABASE_URL` |

5. **Report back to Anahi** with the results. If the test account should be deleted, ask Betania, who has database access.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Error page on every request | `BETTER_AUTH_SECRET` missing or shorter than 32 characters, or `DATABASE_URL` missing. Fix it in Vercel and redeploy. |
| "We couldn't check this password against known data breaches…" | The breach-check service was briefly unreachable, so signup refused, as designed. Retry in a minute. |
| Login fails only on preview URLs | Known open concern: previews may need extra trusted origins. Test on the production domain. |
| Sessions fail to save or load right after an encryption deploy | `ENCRYPTION_MASTER_KEY` missing or malformed in that environment (Vercel logs show `EncryptionKeyError`), or `0003` not applied yet. |
| Pip answers "having trouble thinking" on every message; logs show `column "learner_state" does not exist` or a type error on it | `0004_learner_state.sql` isn't applied. Apply it (after `0003`). |
| Pip answers "at capacity" | The provider's rate limit or daily quota (Groq: per account and model). It resets on its own; see docs/AI_LEARNER.md, "Free-tier caveats". |
| `Could not decrypt …` in the Vercel logs | The value was encrypted with a different `ENCRYPTION_MASTER_KEY`, such as a regenerated or another environment's key. Restore the original key from the backup; never generate a new one over existing data. |
| `psql: … already exists` while applying the migration | It was applied before. Check the tables with `\dt` instead of re-running it. |
