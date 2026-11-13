# Teachable Agents · Protégé

**The best way to learn is to teach.** Protégé is the student-facing frontend for our Stanford CS193V final project, *Teachable Agents and the Protégé Effect*. Instead of being tutored by an AI, the student teaches **Pip**, a curious AI learner who asks questions, makes plausible mistakes, and needs the student to explain concepts and correct misunderstandings.

This repository contains the complete frontend MVP with a **scripted demo learner**. Teaching sessions are now stored using PostgreSQL, allowing users to save and access their sessions across browsers. The real AI learner plugs in through the adapter interface described below.

## Running the app

Requirements: Node 20+ and npm.

```bash
npm install
sh .githooks/install.sh   # once per clone: turns on secret scanning (see below)
npm run dev
```

### One-time setup: secret scanning

**Everyone, please run this once in each clone of the repo** (each laptop or container):

```bash
sh .githooks/install.sh
```

It turns on two git hooks and downloads [gitleaks](https://github.com/gitleaks/gitleaks) into `.githooks/bin/`. That folder is gitignored. You should see `Hooks enabled` and `Installed 8.30.1`.

- **What the hooks do:** before each commit and each push, they check for passwords, API keys, database URLs with passwords, and `.env` files. If they find one, the commit or push is blocked and the file and line are shown. The secret value itself is never printed.
- **If you're blocked:** move the value into `.env.local` (gitignored) and read it with `process.env`. For placeholders, use something like `postgres://user:password@host/db`.
- **CI scans every PR as well,** so skipping this doesn't skip the check. It just means you find out after pushing instead of before.
- Please don't bypass the hooks with `--no-verify`. The push hook and CI will still catch the secret.

Open http://localhost:3000. To run the application, users need to create an account and configure the `DATABASE_URL` environment variable to connect to PostgreSQL (see [Running auth locally](#running-auth-locally)).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (learner script, persistence, summaries) |
| `npm run test:e2e` | Playwright end-to-end test of the full student flow (starts its own dev server on port 3210) |
| `npm run check` | lint + typecheck + unit tests + build |

Playwright is pinned to the browser already installed in the course container. If you run the e2e tests elsewhere, run `npx playwright install chromium` once.

## Authentication

Students sign up with a name, email and password, then log in and out. The teaching pages and the session API require a login. For how to use auth in code, see [docs/AUTH.md](docs/AUTH.md).

**Try it live:** sign up at [YOUR LIVE SITE URL]/signup. Use a test password, not one you use anywhere else.

### Running auth locally

1. Install Node 24 and PostgreSQL.
2. Copy the env file with `cp .env.example .env.local`, then fill in:
   - `DATABASE_URL`: a Postgres database you control (local or a dev database, never production)
   - `BETTER_AUTH_SECRET`: generate one with `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000`
3. Create the tables, in order:
   ```
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0001_auth.sql
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0002_teaching_sessions.sql
   ```
4. Run `npm install`, then `npm run dev`.

Without a `DATABASE_URL`, the app still runs, but everyone appears logged out.

### Tests

- `npm run check`: lint, type check, unit tests and build. This also runs in CI on every PR.
- `npm run test:e2e:auth`: browser tests for signup, login, logout and protected pages. Needs PostgreSQL installed. It starts a throwaway database and a fake breach-check service, and never touches a real database.

### Before your first commit

Run the [one-time secret-scanning setup](#one-time-setup-secret-scanning) above if you haven't already.

### Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md). Production needs the same three environment variables set in Vercel. Never commit real values, and never prefix them with `NEXT_PUBLIC_`.

## The student flow

1. **Landing** (`/`): product pitch, example conversation, how it works, meet Pip.
2. **Topic library** (`/topics`): five topics across five subjects with filters. Probability is the featured demo with the longest script.
3. **Meet your learner** (`/learner/[topicId]`): Pip introduces its confusion, three teaching tips, an optional *pre-session explanation* the student writes before teaching, and **Start Teaching** (or resume an in-progress session for that topic).
4. **Teaching workspace** (`/teach/[sessionId]`): the conversation. Enter sends, Shift+Enter adds a newline, empty messages are blocked, Pip shows a thinking indicator, the view auto-scrolls, errors offer a retry, and the session survives a page refresh. **End Session** asks for confirmation.
5. **Reflection** (`/reflect/[sessionId]`): observed counts (messages, duration, misconceptions raised), the concepts and misconceptions from Pip's script, the student's pre-session explanation, and a self-assessment form (explain a key concept without notes, confidence rating, hardest thing to explain, whether Pip's mistakes exposed uncertainty, whether the student noticed a gap). Nothing is scored.
6. **Past sessions** (`/sessions`, `/sessions/[sessionId]`): dashboard with in-progress and completed sessions, an empty state, and a read-only review of each transcript with its reflection.

## Project structure

```
src/
  app/                      Next.js App Router routes (thin wrappers around screens)
    page.tsx                Landing
    topics/                 Topic library
    learner/[topicId]/      Meet your learner
    teach/[sessionId]/      Teaching workspace
    reflect/[sessionId]/    Reflection and results
    sessions/               Past sessions dashboard + review
    globals.css             Design tokens (colors, fonts, shadows, utilities)
  components/
    ui/                     Button, Card, Badge, Field, SectionHeading
    illustrations/          SVG icon set (books, pencils, stars, subject icons)
    screens/                Page-level client components
    LearnerAvatar.tsx       Pip, drawn in SVG with moods
    ChatMessage.tsx, ChatComposer.tsx, ThinkingIndicator.tsx
    TopicCard.tsx, TopicFilters.tsx, TeachingTips.tsx, SessionProgress.tsx
    ReflectionForm.tsx, SessionCard.tsx, ConversationPreview.tsx
    Navbar.tsx, Footer.tsx, Logo.tsx
  lib/
    types.ts                Shared interfaces (Topic, ChatMessage, TeachingSession, LearnerReply, SessionReflection, ...)
    topics.ts, subjects.ts  Mock topic catalogue and subject accent colors
    scripts/                Scripted learner conversations, one file per topic
    learner/                LearnerAdapter interface + ScriptedLearnerAdapter (Chase)
    persistence/            SessionStore interface, HttpSessionStore, and PostgreSQL storage for teaching sessions (Betania)
    hooks/useTeachingSession.ts   Session lifecycle used by the workspace
    sessions.ts, utils.ts   Session creation, summaries, formatting
    __tests__/              Vitest unit tests
e2e/                        Playwright student-flow spec
```

## Design system

Tokens live in `src/app/globals.css` under `@theme` and are used as Tailwind utilities:

- Colors: `ivory`, `paper`, `forest`, `sage`, `butter`, `terracotta`, `charcoal`, `muted`, `line`, `danger`
- Fonts: `font-display` (Fraunces) for headings, `font-sans` (DM Sans) for body
- Shadows: `shadow-soft`, `shadow-lift`; radii: `rounded-card`, `rounded-bubble`
- Utilities: `card`, `paper-lines` (notebook ruling), `dot-grid`, `focus-ring`, `accent-bg` / `accent-text` (driven by per-subject CSS variables from `subjects.ts`)

## Integration points for teammates

The UI never talks to a model or a database directly. Each concern has one interface and one factory function to swap.

### Chase · AI learner

- Interface: `LearnerAdapter` in `src/lib/learner/adapter.ts` with `open(context)` and `respond(context)`. The context carries the topic, the full transcript, the student's latest message, and an opaque numeric `cursor` stored on the session.
- Return a `LearnerReply` (`text`, `kind`, `mood`, optional `concept` / `misconception`, `isFinal`, `nextCursor`). `concept` and `misconception` feed the reflection page, so if the model can tag its turns, the reflection screen lights up automatically.
- Swap it in `getLearnerAdapter()` in `src/lib/learner/index.ts`. Keep the API key server-side (for example a route handler under `src/app/api/learner/`) and have the adapter call it.
- The workspace shows the adapter's `displayName` in a "Demo mode" note so it is always transparent which learner is running. Thinking delay currently lives inside the scripted adapter, not the UI.

### Betania · persistence

- Sessions live in Postgres, in `teaching_sessions` (`db/migrations/0002_teaching_sessions.sql`): one row per session, with `messages` and `reflection` as `jsonb`, owned by `user_id` (deleted with the user).
- Browser: `getSessionStore()` in `src/lib/persistence/index.ts` returns `HttpSessionStore`, which calls `/api/sessions`. Components use the same `SessionStore` interface as before, plus `createSession(topicId, preExplanation?)`: the server picks every ID.
- Server: `getUserSessionStore(user)` in `src/lib/persistence/server.ts` filters every query by the logged-in user. Routes call `requireApiUser()` first; another user's session answers 404, like a missing one. `PUT` bodies are checked by `parseSessionUpdate()` in `validate.ts` and may change only `status`, `endedAt`, `messages`, `learnerCursor` and `reflection`.
- Routes: `GET`/`POST /api/sessions` (`?activeTopicId=` finds the in-progress session for a topic) and `GET`/`PUT`/`DELETE /api/sessions/[id]`.
- Tests run against the throwaway Postgres, which applies `db/migrations/0002+` via `test/appMigrations.ts`. `LocalStorageSessionStore` remains as the reference implementation.

### Anahi · authentication

- See [`docs/AUTH.md`](docs/AUTH.md) for the auth contract: how to get the current user, which pages and API routes are protected, and the data ownership rules.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md): problem, approach, student journey, design decisions, what is real vs. mocked
- [`docs/EVALUATION.md`](docs/EVALUATION.md): hypothesis, user-testing protocol, rubric, and how we separate engagement from learning
- [`docs/CHECKPOINT_1.md`](docs/CHECKPOINT_1.md): Week 8/9 status, demo script, test results, integration plan
- [`docs/AUTH.md`](docs/AUTH.md): authentication contract (helpers, protected routes, ownership rules, auth tables, env vars)

## What the demo deliberately does not do

- Pip does not interpret the student's wording. The scripted adapter advances through a fixed sequence of questions and misconceptions regardless of the reply, and says so on screen.
- The reflection page reports counts and the student's own self-assessment. It does not compute accuracy, mastery, or learning gains.
