# Security audit

**Date:** 2026-11-19
**Scope:** `main` at `517b7e0` (after #50, "Encrypt teaching sessions at rest"), plus the open AI learner PR **#42** at `71bf99a`, reviewed before it merges.
**Written by:** Claude Code (an AI assistant), at Anahi's request, for Checkpoint 2. Reviewed by the team in the PR that added this file.

Findings marked **[#42]** are in **unmerged code** on #42's branch (`learner/teachable-pip`). Their file and line references are to that branch. All other references are to `main`.

## Summary

| # | Severity | Finding | Where | Tracked in |
|---|---|---|---|---|
| 1 | High | Account data (name, email, session tokens) is stored as plaintext | `db/migrations/0001_auth.sql` | #54 |
| 2 | High **[#42]** | No per-user limit on AI learner turns | `src/app/api/sessions/[id]/turn/route.ts` | #55 |
| 3 | Medium | No security headers | `next.config.ts` | #56 |
| 4 | Medium **[#42]** | Answer keys and `llm.ts` aren't marked `server-only` | `src/lib/learner/teachable/` | #57 |
| 5 | Medium (main), fixed in **[#42]** | The browser can rewrite the whole transcript and reopen sessions | `src/lib/persistence/server.ts` | Fixed by #42 |
| 6 | Low | No rate limit on `/api/sessions` | `src/app/api/sessions/` | #58 |
| 7 | Medium (privacy) **[#42]** | Student messages go to Groq; retention not verified | `src/lib/learner/teachable/llm.ts` | #59 |
| 8 | Low | Production deploy of encryption not verified | Vercel, Neon | #60 |
| 9 | Low | Key checked lazily; one bad row hides the whole list | `fieldEncryption.ts`, `server.ts` | #53, #52 |
| 10 | Low | 7 moderate `npm audit` issues in development tools | `package-lock.json` | #61 |
| 11 | Info | GitHub Actions pinned to tags, not commit hashes | `.github/workflows/ci.yml` | #61 |
| 12 | Info **[#42]** | New environment variables, including browser-visible flags | `.env.example` | Note only |

Severity is judged for this app: a student-facing teaching tool with open signup, a shared free-tier model quota and no real users yet.

## Findings

### 1. Account data is stored as plaintext (High)

- **Where:** `db/migrations/0001_auth.sql:1` (`users`: `name`, `email`) and `:3` (`auth_session`: `token`). Described in `docs/AUTH.md:126-127`.
- **Why it matters:** Checkpoint 2 requires all user information to be stored encrypted. Teaching-session content is encrypted per user and field (#47, #50), but each student's name and email are plaintext. Better Auth also stores session tokens as plain text, so anyone who can read the database could act as a logged-in student until the session expires.
- **Suggested fix:** decide as a team.
  - **Either** encrypt name and email. Login looks accounts up by email, so it needs a keyed hash of the lowercased email as the lookup column, plus an encrypted copy for display.
  - **Or** document the exception and why in ENCRYPTION.md: Neon's encryption at rest, database access limited to the database owner, TLS in transit, and session expiry. Logout already deletes the session row.
- **Tracked in:** #54.

### 2. No per-user limit on AI learner turns (High) [#42]

- **Where:** `src/app/api/sessions/[id]/turn/route.ts:33` (`POST`), which calls `runServerTurn` at line 44. The only limits are per call: messages are capped at 1,500 characters (`src/lib/persistence/validate.ts:44`, `MAX_TURN_TEXT`) and each model call has a token cap.
- **Why it matters:** each turn makes three model calls (note-taker, assessor, reply). Signup is open, so one account or a script can use up the shared Groq daily quota, after which every student sees "Pip is at capacity". On a paid key, spending would have no cap.
- **Suggested fix:**
  - A per-user limit on turns per minute, and a daily cap per user, with counts stored in Postgres. Vercel runs many short-lived instances, so in-memory counts aren't shared (`docs/AUTH.md:162`).
  - Possibly a maximum number of turns per session.
  - A friendly 429 using the existing capacity message (`src/lib/learner/capacity.ts`).
  - Document the limits in COST-CONTROLS.md.
- **Tracked in:** #55.

### 3. No security headers (Medium)

- **Where:** `next.config.ts:3` defines no `headers()`, and there's no middleware or proxy.
- **Why it matters:**
  - There's no `Content-Security-Policy`, so any injected script would run unrestricted.
  - There's no `frame-ancestors` or `X-Frame-Options`, so the login and teaching pages can be embedded in another site (clickjacking).
  - `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` are also missing.
- **Suggested fix:** add a `headers()` block in `next.config.ts`:
  - Start with `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`.
  - Then add a stricter CSP (`default-src 'self'` plus what Next needs), tested in development and against a production build.
- **Tracked in:** #56.

### 4. Answer keys and `llm.ts` aren't marked `server-only` (Medium) [#42]

- **Where:** in `src/lib/learner/teachable/`, `packs/index.ts` and the other `packs/*` files (the hidden answer keys), `llm.ts` (which reads `LLM_API_KEY`), `pipeline.ts`, `prompts.ts` and `assessorBoundary.ts` have no `import "server-only"`. `server.ts` and `turnService.ts` already have it.
- **Why it matters:** no client component imports these today. The one client file that touches `llm.ts` uses a type-only import. But nothing stops a future client import, and if one happened, the answer keys would ship to the browser with no error. The API key itself wouldn't, because Next only puts `NEXT_PUBLIC_` variables into browser code.
- **Suggested fix:** add `import "server-only";` to at least `packs/index.ts` and `llm.ts`, so a client import fails the build, matching `auth.ts`, `db/pool.ts` and `persistence/server.ts`.
- **Tracked in:** #57.

### 5. The browser can rewrite the whole transcript (Medium on main, fixed in #42)

- **Where:** `src/app/api/sessions/[id]/route.ts:23` (`PUT`), `src/lib/persistence/validate.ts:60` (`parseSessionUpdate`) and `src/lib/persistence/server.ts:122`, which sets `status`, `messages` and the rest from the request body.
- **Why it matters:** a student can replace their own transcript, including Pip's messages, and set a completed session back to `in_progress`. It only affects their own data, but it undermines the integrity of the evaluation data, and of what the AI learner is told was said.
- **Fix:** #42 moves transcript writes to the server-side turn route. There, `PUT` only sets `status`, `endedAt` and `reflection`, and a completed session can't be reopened. No separate issue. Recheck this when #42 merges.

### 6. No rate limit on `/api/sessions` (Low)

- **Where:** `src/app/api/sessions/route.ts:24` (`POST`, create) and `src/app/api/sessions/[id]/route.ts:23` (`PUT`, update).
- **Why it matters:** a logged-in user can create sessions and send updates without any limit, which can fill the database. Each request is size-limited (`MAX_BODY_BYTES` 1 MB at `validate.ts:11`, 1,000 messages at `:68`, 20,000 characters per text field at `:13`), but the number of requests isn't. Better Auth's limiter covers only `/api/auth/*`, in memory on each server instance (`docs/AUTH.md:162`).
- **Suggested fix:** a per-user limit using the same Postgres-backed limiter as finding 2.
- **Tracked in:** #58, linked to #55.

### 7. Student messages go to Groq; retention not verified (Medium, privacy) [#42]

- **Where:** `src/lib/learner/teachable/llm.ts:138` sends each turn to the provider's `/chat/completions` endpoint (Groq in production). Students are told about it in `AI-CONSENT.md`, on the `/ai-data` page (`src/app/(site)/(public)/ai-data/page.tsx`, content in `src/lib/aiData.ts`) and on the "Where your words go" card.
- **Why it matters:** student messages may include personal details, and they go to a third party. The notice should match Groq's actual retention and training terms. This audit didn't check those terms.
- **Suggested fix:** check how long Groq keeps API data, whether it trains on it, whether zero-retention can be turned on, and where data is processed. Then update `/ai-data`, `AI-CONSENT.md` and this file, with a link to Groq's policy and the date checked.
- **Tracked in:** #59.

### 8. Production deploy of encryption not verified (Low)

- **Where:** Vercel environment variables and the production Neon database. Steps are in `docs/DEPLOY.md:36` ("Encrypting teaching sessions") and #50.
- **Why it matters:** if `ENCRYPTION_MASTER_KEY` is missing in a tier, or `0003_encrypt_teaching_sessions.sql` isn't applied, every save on that site fails. This can't be checked from the repo.
- **Suggested fix:**
  - Confirm the key is set in each Vercel tier, with a different value per tier and a backup kept outside the repo.
  - Confirm `0003` is applied, and `0004_learner_state.sql` once #42 merges.
  - Confirm a new production session's encrypted columns start with `v1:`.
- **Tracked in:** #60.

### 9. Key checked lazily; one bad row hides the whole list (Low, already filed)

- **Where:** `src/lib/crypto/fieldEncryption.ts:83` (`masterKey()` runs on first use, not at startup) and `src/lib/persistence/server.ts:78` (`rows.map(this.toSession)`).
- **Why it matters:**
  - A misconfigured deploy starts normally and only fails when a student saves.
  - One row that can't be decrypted makes the dashboard and the session list fail for that student.
- **Tracked in:** #53 and #52, filed by Chase during the review of #50. No new issue.

### 10. `npm audit`: 7 moderate issues in development tools (Low)

- **Where:** `package-lock.json`. The issue is `minimatch` (GHSA-g3hv-75wg-m249), pulled in by `typescript-eslint`. Production dependencies have **0** issues (`npm audit --omit=dev`).
- **Why it matters:** it only runs in lint, so the risk is low, but it's an easy cleanup.
- **Suggested fix:** `npm audit fix` (without `--force`), then `npm run check`.
- **Tracked in:** #61.

### 11. GitHub Actions pinned to tags, not commit hashes (Info)

- **Where:** `.github/workflows/ci.yml:26`, `:27` and `:44` (`actions/checkout@v7`, `actions/setup-node@v7`).
- **Why it matters:** a tag can be moved to point at different code; a commit hash can't. Workflow permissions are already read-only (`contents: read`), which limits the damage.
- **Suggested fix:** pin each action to its full commit hash, with the version in a comment.
- **Tracked in:** #61.

### 12. New environment variables, including browser-visible flags (Info) [#42]

- **Where:** `.env.example` on #42's branch adds `LLM_MODEL_ASSESSOR`, `LLM_MODEL_PIP` and `DEVICE_PIP_EXPERIMENT`, plus `NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT` and `NEXT_PUBLIC_DEVICE_PIP_URL` (read in `src/lib/learner/device/onDevicePip.ts:19` and `:22`). The server-side switch is in `src/lib/learner/teachable/turnService.ts:36`.
- **Why it matters:** these are switches and model names, not secrets. The `NEXT_PUBLIC_` ones are visible in the browser by design. The on-device experiment must stay off for students.
- **Action:** add them to the SECRETS.md inventory, and **keep every `DEVICE_*` variable unset in Vercel**. Note only, no issue.

## What already passes

- **Encryption of teaching sessions (#47, #50):**
  - AES-256-GCM with a fresh IV per value and a separate key per user and field, derived with HKDF from `ENCRYPTION_MASTER_KEY`.
  - The user ID and field name are bound in as additional authenticated data, so a value copied into another user's row or column fails to decrypt instead of returning data.
  - `src/lib/persistence/server.ts` encrypts on every write and decrypts on every read, always with the owner's user ID. The field names match `ENCRYPTED_FIELDS`.
  - The database rejects plaintext: every encrypted column must start with `v1:` (`db/migrations/0003_encrypt_teaching_sessions.sql`).
- **[#42] Pip's notebook (`learner_state`)** is encrypted the same way, as `text` with a `v1:` check (`db/migrations/0004_learner_state.sql`). Renumbering the migration to `0004` resolves the clash with `0003`.
- **Access control:**
  - Every API route calls `requireApiUser()` and goes through the owner-scoped store, so another user's session answers 404, exactly like a missing one. On #42 this includes the new `turn`, `pip`, `progress`, `review` and `device-reply` routes.
  - Every app page calls `requireUser`, and the public pages (`/`, `/about`, `/topics`, `/login`, `/signup`, and `/ai-data` in #42) show no student data. `src/lib/auth/__tests__/routeGuard.test.ts` enforces this.
- **Cross-site requests and input limits:**
  - The session API requires `application/json` (`src/app/api/sessions/shared.ts:16`), and the login cookies are SameSite=Lax.
  - Request bodies are capped at 1 MB, with 1,000 messages and 20,000 characters per text field. [#42] Turn messages are capped at 1,500 characters.
- **Authentication:**
  - Better Auth email/password, with passwords hashed.
  - A signup password policy (zxcvbn strength plus a Pwned Passwords check that fails closed).
  - Better Auth's login rate limiting in production.
  - Sessions no longer store IP address or user agent (`src/lib/auth/auth.ts:70`, #48).
  - In production, `BETTER_AUTH_SECRET` is rejected if it's missing, shorter than 32 characters or still the `.env.example` placeholder (`src/lib/auth/auth.ts:82`). This happens when auth is first used, which in practice is the first page load, because the nav reads the session. It isn't checked at process startup.
- **Secrets:** all secrets are server-only, and `.env.example` holds placeholders only. No `NEXT_PUBLIC_` variable holds a secret. A full-history gitleaks scan of every branch found nothing, and gitleaks also runs in CI and in pre-commit and pre-push hooks.
- **Errors and logging:**
  - Students only see friendly messages (`src/lib/errors.ts:20`, #49).
  - Server logs record error messages and session IDs, never transcript content, passwords or keys.
  - The encryption helper never logs, and its errors contain no plaintext.
- **[#42] AI safety design:** a three-call turn in which the assessor's output is allowlisted in code before it reaches Pip's reply. Prompt-injection and behavior evals are included. See the documents below.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities.

## What this audit couldn't check from the repo

- **Production configuration:** whether the Vercel tiers have `ENCRYPTION_MASTER_KEY`, `BETTER_AUTH_SECRET` and `DATABASE_URL` set correctly, and whether the production database has every migration applied (#60).
- **Groq's data handling:** retention, training use and data location (#59).
- **Neon:** encryption at rest, backups, and who has console access.
- **GitHub settings:** branch protection rules for `main`. The token used couldn't read them. There are no repository rulesets, and approvals are not dismissed when new commits are pushed.
- **Runtime behavior on Vercel:** response headers added by the platform, and whether Better Auth's rate limiting is effective across instances.
- **Model behavior:** prompt-injection resistance depends on the models. That's covered by #42's evals, not by this audit.

## Related documents

These are in **#42** (not merged yet):

- [AI-SAFETY.md](https://github.com/teachable-agents-cs193v/teachable-agents/blob/learner/teachable-pip/AI-SAFETY.md): how the three-call turn resists prompt injection.
- [AI-CONSENT.md](https://github.com/teachable-agents-cs193v/teachable-agents/blob/learner/teachable-pip/AI-CONSENT.md): what students are told about where their words go.
- [AI-EVALS.md](https://github.com/teachable-agents-cs193v/teachable-agents/blob/learner/teachable-pip/AI-EVALS.md): the eval sets, including prompt injection, and results.

On `main`: [docs/AUTH.md](docs/AUTH.md) (auth contract and known limitations) and [docs/DEPLOY.md](docs/DEPLOY.md) (deploy steps, including encryption).
