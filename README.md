# Teachable Agents · Pip

**The best way to learn is to teach.** Protégé is the student-facing frontend for our Stanford CS193V final project, *Teachable Agents and the Protégé Effect*. Instead of being tutored by an AI, the student teaches **Pip**, a curious AI learner who asks questions, makes plausible mistakes, and needs the student to explain concepts and correct misunderstandings.

Pip is an **AI learner**: three model calls per student message (a note-taker, an assessor that holds the hidden answer key, and Pip's reply, which sees only Pip's notebook), so Pip only knows what the student taught it. Without a model configured, a scripted demo learner answers instead. Teaching sessions are stored in PostgreSQL per user, with the transcript, reflection and Pip's notebook encrypted at rest. The AI learner is described in [docs/AI_LEARNER.md](docs/AI_LEARNER.md).

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
| `npm run test:e2e:auth` | Playwright tests for signup, login, logout and protected pages |
| `npm run test:e2e:learning` | Playwright tests of the AI learner's panels, with a local fake model (port 3220) |
| `npm run eval` | Live evaluation of the AI learner against the real models, judged by Claude (`eval/README.md`; spends real quota, not part of CI) |
| `npm run dev:local` | Dev server with a throwaway Postgres, for the on-device experiment (docs/AI_LEARNER.md) |
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
   - `ENCRYPTION_MASTER_KEY`: generate one with `openssl rand -base64 32` (sessions can't be saved without it)
   - Optional, for the AI learner: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (and `LLM_MODEL_ASSESSOR` / `LLM_MODEL_PIP`); see [docs/AI_LEARNER.md](docs/AI_LEARNER.md). Without them the scripted learner answers.
3. Create the tables, in order:
   ```
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0001_auth.sql
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0002_teaching_sessions.sql
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_encrypt_teaching_sessions.sql
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0004_learner_state.sql
   psql "<your-database-url>" -1 -v ON_ERROR_STOP=1 -f db/migrations/0005_rate_limits.sql
   ```
4. Run `npm install`, then `npm run dev`.

Without a `DATABASE_URL`, the app still runs, but everyone appears logged out.

### Tests

- `npm run check`: lint, type check, unit tests and build. This also runs in CI on every PR.
- `npm run test:e2e:auth`: browser tests for signup, login, logout and protected pages. Needs PostgreSQL installed. It starts a throwaway database and a fake breach-check service, and never touches a real database.

### Before your first commit

Run the [one-time secret-scanning setup](#one-time-setup-secret-scanning) above if you haven't already.

### Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md). Production needs every variable in the table in [Part B, step 2](docs/DEPLOY.md#part-b-chase-vercel) set in Vercel. Never commit real values, and never prefix them with `NEXT_PUBLIC_`.

**Deploying this version:** apply the migrations in number order before deploying the code. `0004_learner_state.sql` (Pip's notebook, encrypted) goes after `0003_encrypt_teaching_sessions.sql`; `ENCRYPTION_MASTER_KEY` must already be set in Vercel. `0005_rate_limits.sql` (per-user limits on starting and saving sessions) only adds a table. The steps and smoke tests are in [docs/DEPLOY.md](docs/DEPLOY.md#pips-notebook-0004_learner_statesql). Leave the `DEVICE_*` experiment variables unset.

## The student flow

1. **Landing** (`/`): the pitch, how it works, why Pip is different, a labelled example exchange. `/about` describes the project and the target user.
2. **Topic library** (`/topics`): only **Derivatives** is offered right now, and it's the featured topic. The other five topics (probability, economics, biology, computer science, psychology) are hidden with `hidden: true` in `src/lib/topics.ts`: every list and picker uses `visibleTopics()`, `/learner/<hidden-id>` is a 404, and `POST /api/sessions` answers 404 for them. Their packs and scripts are kept, and existing sessions on them still open, can be reviewed and deleted. Remove the flag to offer a topic again. Subject filters show only when more than one subject has a topic.
3. **Meet your learner** (`/learner/[topicId]`): Pip introduces its confusion, three teaching tips, an optional *pre-session explanation* the student writes before teaching, and the **Where your words go** notice: what is sent to the AI provider (Groq), what isn't, and what is kept, with a link to the full explanation at `/ai-data` (public). Its one button, **Start teaching Pip**, starts the session (or resumes an in-progress one for that topic).
4. **Teaching workspace** (`/teach/[sessionId]`): the conversation. Each student message goes to `POST /api/sessions/[id]/turn`, which saves it, runs the three model calls and saves Pip's reply; the browser never writes the transcript. Beside the chat: **What Pip believes** (updated each turn, new beliefs highlighted), Pip's starting misconceptions once voiced and the wrong ideas the student taught, flags when the latest message voiced or taught a wrong idea (never the right answer), and a progress strip with one dot per message. A line under the message box says where messages go. Errors are friendly and offer a retry that never sends a message twice; when the provider is rate limited or out of quota, Pip says it's at capacity and roughly when to try again. Enter sends, Shift+Enter adds a newline, and the session survives a page refresh. **End Session** asks for confirmation.
5. **Reflection** (`/reflect/[sessionId]`): observed counts (messages, duration), the end-of-session review for the AI learner (which misconceptions the student corrected, what they taught and whether it was right, message by message), the student's pre-session explanation, and a self-assessment form. Nothing is scored. For the scripted learner, the review is replaced by the concepts and misconceptions from Pip's script.
6. **Past sessions** (`/sessions`, `/sessions/[sessionId]`): in-progress and completed sessions, an empty state, a read-only review of each transcript with its reflection, and **Delete** on every session. The logged-in home (`/dashboard`) and `/profile` show the same data.

## Project structure

```
src/
  app/                      Next.js App Router routes (thin wrappers around screens)
    (site)/layout.tsx       Shared shell: server-rendered nav + footer
    (site)/(public)/        Landing (page.tsx), about/, ai-data/, topics/, login/, signup/
    (site)/(app)/           dashboard/, profile/, learner/[topicId]/, reflect/[sessionId]/, sessions/ (login required)
    api/sessions/           Session API: CRUD, and [id]/turn, pip, progress, review, device-reply for the AI learner
    (focus)/teach/[sessionId]/  Teaching workspace, with its own header
    globals.css             Design tokens (colors, fonts, type scale, utilities)
  components/
    ui/                     Button, Card, Badge, Field, SectionHeading
    illustrations/          Pip.tsx (the character), Doodles.tsx (hand-drawn doodles), Icons.tsx (UI icons)
    landing/                Landing page sections (Hero, HowItWorks, WhyPip, ExampleConversation, FinalCta)
    nav/                    SiteNav (server, picks links from the session) + NavBar (client)
    screens/                Page-level client components
    LearnerAvatar.tsx       Pip at avatar size, with moods
    ChatMessage.tsx, ChatComposer.tsx, ThinkingIndicator.tsx
    TopicCard.tsx, TopicFilters.tsx, TeachingTips.tsx, SessionProgress.tsx
    learning/               The AI learner's panels: beliefs, misconception tracker, flags, progress strip, review
    AiNoticeCard.tsx, DataLine.tsx   "Where your words go" notice and the line under the message box
    ReflectionForm.tsx, SessionCard.tsx, DeleteSessionButton.tsx
    Footer.tsx, Logo.tsx
  lib/
    types.ts                Shared interfaces (Topic, ChatMessage, TeachingSession, LearnerReply, SessionReflection, ...)
    topics.ts, subjects.ts  Topic catalogue (visibleTopics(): only Derivatives is offered) and subject accent colors
    scripts/                Scripted learner conversations, one file per topic
    learner/                The browser client for turns (httpLearner.ts), the scripted learner, and the
                            AI learner in teachable/ (packs, prompts, pipeline, assessor boundary, progress)
    crypto/                 Per-user, per-field encryption for stored session data
    persistence/            SessionStore interface, HttpSessionStore, and PostgreSQL storage for teaching sessions
    hooks/useTeachingSession.ts   Session lifecycle used by the workspace
    sessions.ts, utils.ts   Session creation, summaries, formatting
    __tests__/              Vitest unit tests
e2e/, e2e-auth/, e2e-learning/   Playwright specs (student flow, auth, the AI learner's panels with a fake model)
eval/                       Live evaluation of the AI learner (npm run eval)
db/migrations/              Hand-written SQL migrations, applied in number order
```

## Design system

The visual direction is the Pip style tile, [`docs/design/pip-style-tile.png`](docs/design/pip-style-tile.png) (hand-drawn, collegiate, all greens). Tokens live in `src/app/globals.css` under `@theme` and are used as Tailwind utilities:

- Colors: `ivory` (warm paper, the page), `paper` (cards), `mint`, `sage`, `leaf`, `forest` (deep green), `butter` (the only highlight), `charcoal`, `muted`, `line`, `danger`
- Fonts: `font-display` (Space Grotesk) for headings, `font-sans` (Inter) for body, `font-mono` (IBM Plex Mono) for labels and metadata; type scale utilities `type-display`, `type-h1` … `type-h4`, `type-lead`, `type-label`
- Shadows: `shadow-soft`, `shadow-lift` (very light); radii: `rounded-card` (16px), `rounded-xl` controls (12px)
- Hand-drawn utilities: `band` (marker stroke behind a label), `sketch-underline`, `paper-lines` (notebook ruling), `grid-paper`, `focus-ring`, `card`, `card-sage`, `accent-bg` / `accent-text` (per-subject greens from `subjects.ts`)
- Illustrations: Pip in `src/components/illustrations/Pip.tsx` (one `PipHead` drawing, four moods, used by `LearnerAvatar` at avatar size only) and the doodle set in `Doodles.tsx`, which the landing hero is composed from. Functional line icons stay in `Icons.tsx`. The tile and screenshots of each redesign PR are in [`docs/design/`](docs/design/README.md).

## Integration points for teammates

The UI never talks to a model or a database directly. Each concern has one interface and one factory function to swap.

### Chase · AI learner

**Pip is now an AI learner.** See [`docs/AI_LEARNER.md`](docs/AI_LEARNER.md) for setup (a free Groq key in `.env.local`), how a turn works, and `npm run eval`. Without a key, the scripted learner described below still runs.

- Which learner answers is chosen on the server, in `learnerTurn()` (`src/lib/learner/teachable/server.ts`): the AI learner when `LLM_*` is set and the topic has a pack, otherwise the scripted learner (`LearnerAdapter` in `src/lib/learner/adapter.ts`). The browser only calls `POST /api/sessions/[id]/turn` through `postTurn()`; the API key never leaves the server.
- The workspace says which learner is running ("AI learner" or "Demo mode"), and the line under the message box says where messages go.
- Pip's beliefs, progress and review come from `GET /api/sessions/[id]/pip`, `/progress` and `/review`, shaped for students (no answer-key text). See [`docs/AI_LEARNER.md`](docs/AI_LEARNER.md) for the shapes and the components that show them.

### Betania · persistence

- Sessions live in Postgres, in `teaching_sessions` (`db/migrations/0002_teaching_sessions.sql`): one row per session, owned by `user_id` (deleted with the user). `messages`, `pre_explanation` and `reflection` are encrypted per user (`0003_encrypt_teaching_sessions.sql`), and so is `learner_state`, Pip's notebook, which only the server reads (`0004_learner_state.sql`).
- Browser: `getSessionStore()` in `src/lib/persistence/index.ts` returns `HttpSessionStore`, which calls `/api/sessions`. Components use the same `SessionStore` interface as before, plus `createSession(topicId, preExplanation?)`: the server picks every ID.
- Server: `getUserSessionStore(user)` in `src/lib/persistence/server.ts` filters every query by the logged-in user. Routes call `requireApiUser()` first; another user's session answers 404, like a missing one. `PUT` bodies are checked by `parseSessionUpdate()` in `validate.ts` and may change only `status`, `endedAt` and `reflection`. The transcript is written only by the server, through `POST /api/sessions/[id]/turn` (see `docs/AI_LEARNER.md`), so the stored conversation is what actually happened.
- Routes: `GET`/`POST /api/sessions` (`?activeTopicId=` finds the in-progress session for a topic) and `GET`/`PUT`/`DELETE /api/sessions/[id]`.
- Tests run against the throwaway Postgres, which applies `db/migrations/0002+` via `test/appMigrations.ts`. `LocalStorageSessionStore` remains as the reference implementation.

### Anahi · authentication

- See [`docs/AUTH.md`](docs/AUTH.md) for the auth contract: how to get the current user, which pages and API routes are protected, and the data ownership rules.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md): problem, approach, student journey, design decisions, what is real vs. mocked
- [`docs/EVALUATION.md`](docs/EVALUATION.md): hypothesis, user-testing protocol, rubric, and how we separate engagement from learning
- [`docs/CHECKPOINT_1.md`](docs/CHECKPOINT_1.md): Week 8/9 status, demo script, test results, integration plan
- [`docs/AUTH.md`](docs/AUTH.md): authentication contract (helpers, protected routes, ownership rules, auth tables, env vars)
- [`docs/AI_LEARNER.md`](docs/AI_LEARNER.md): the AI learner: setup, how a turn works, adding topics, evaluation

## What the demo deliberately does not do

- The scripted fallback learner does not interpret the student's wording: it advances through a fixed sequence of questions and misconceptions regardless of the reply, and says so on screen. (The AI learner does respond to what was said.)
- The reflection page reports counts and the student's own self-assessment. It does not compute accuracy, mastery, or learning gains.
