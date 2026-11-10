# Teachable Agents · Protégé

**The best way to learn is to teach.** Protégé is the student-facing frontend for our Stanford CS193V final project, *Teachable Agents and the Protégé Effect*. Instead of being tutored by an AI, the student teaches **Pip**, a curious AI learner who asks questions, makes plausible mistakes, and needs the student to explain concepts and correct misunderstandings.

This repository currently contains the complete frontend MVP with a **scripted demo learner** and **browser-local persistence**. The real AI learner, database, and authentication are owned by teammates and plug in through the adapter interfaces described below.

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

Open http://localhost:3000. The demo needs no account and no environment variables. Sessions are stored in the browser's localStorage.

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
    persistence/            SessionStore interface + LocalStorageSessionStore (Betania)
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

- Interface: `SessionStore` in `src/lib/persistence/adapter.ts` (`listSessions`, `getSession`, `saveSession`, `deleteSession`, `findActiveSession`). All methods are async already.
- Swap it in `getSessionStore()` in `src/lib/persistence/index.ts`. `TeachingSession` in `src/lib/types.ts` is the record shape to persist, including `messages`, `preExplanation`, and `reflection`.
- `LocalStorageSessionStore` is the reference implementation and has unit tests you can reuse against a real backend.

### Anahi · authentication

- There is no user concept in the UI yet. The natural seam is the `SessionStore`: once a user is known, the store can scope reads and writes to that user without touching components.
- `Navbar.tsx` is the place for a sign-in/profile control. Pages that should require auth are `/teach/*`, `/reflect/*`, and `/sessions*`.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md): problem, approach, student journey, design decisions, what is real vs. mocked
- [`docs/EVALUATION.md`](docs/EVALUATION.md): hypothesis, user-testing protocol, rubric, and how we separate engagement from learning
- [`docs/CHECKPOINT_1.md`](docs/CHECKPOINT_1.md): Week 8/9 status, demo script, test results, integration plan

## What the demo deliberately does not do

- Pip does not interpret the student's wording. The scripted adapter advances through a fixed sequence of questions and misconceptions regardless of the reply, and says so on screen.
- The reflection page reports counts and the student's own self-assessment. It does not compute accuracy, mastery, or learning gains.
- Sessions are per-browser. Clearing site data removes them.
