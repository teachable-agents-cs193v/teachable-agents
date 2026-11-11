# Deploying auth

Two people, in order:

- **Part A**, Betania (database): create the Postgres database if needed and apply the auth migration.
- **Part B**, Chase (Vercel): add the three environment variables and redeploy, then run the smoke test.

Everything below uses placeholders like `<your-production-domain>`. Real values never go in this file or anywhere else in the repo.

> ⚠️ **The database connection string contains the database password.** Share it only privately: give the other person their own access to the database console, or use a password-manager share. **Never** paste it in chat, Slack, email, an issue or PR, a commit, or any file in the repo. If it leaks, reset the database password and update Vercel.

## Part A: Betania (database)

**Before you start:** this PR (#28, `db/migrations/0001_auth.sql`) is approved by Betania and Anahi and merged to `main`.

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
   psql "$DB_DIRECT_URL" -c '\dt'                     # expect: users, auth_session, auth_account, auth_verification
   unset DB_DIRECT_URL
   ```
   - `-1` runs the whole file in one transaction, so a failure halfway leaves nothing behind.
   - "Already exists" means it was applied before. Stop and check; don't force it.
   - Never point `npm run db:generate` at this database. It refuses non-local databases anyway.
4. **Get the pooled string to Chase privately.** The best option is to give Chase his own access to the database project, so he copies it himself. Otherwise use a password-manager share.
5. **Tell Anahi and Chase "migration applied"**, saying which database and branch, but **not** the connection string.

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

   - Don't set `PWNED_PASSWORDS_API_URL`; it's for tests only.
   - Don't add a `NEXT_PUBLIC_` prefix to any of these.
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
| `psql: … already exists` while applying the migration | It was applied before. Check the tables with `\dt` instead of re-running it. |
