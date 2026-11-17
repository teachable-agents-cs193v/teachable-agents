# Technical overview

Each team member adds their own section below.

### Authentication (Anahi)

**Main pieces and tools**
- Better Auth handles signup, login and logout at `/api/auth/...`, and stores accounts and active logins in our Postgres database.
- On signup, the server checks password strength with zxcvbn, then checks Have I Been Pwned's Pwned Passwords API for known breaches. If the breach check can't run, signup is refused rather than let through.
- Helpers for teammates: `getCurrentUser()`, `requireUser()` for pages (sends logged-out users to login), and `requireApiUser()` for API routes (answers 401). A test fails if a new page is neither protected nor marked public.

**Stored information**
- Auth stores data in our Postgres database:
  - `users`: each student's name and email.
  - `auth_session`: login records, so the app knows who is logged in and shows each student only their own teaching sessions. Better Auth also records the IP address and browser info for each login.
  - `auth_account`: the password, stored only as a one-way hash. The plain-text password is never stored or logged.
- In the browser, auth only keeps the login cookie.

**Secrets and user information**
- `BETTER_AUTH_SECRET` (signs login cookies) and `DATABASE_URL` (includes the database password) live only in Vercel and in each person's git-ignored `.env.local`. gitleaks hooks and the CI scan catch accidental commits.
- Passwords are stored hashed, never in plain text, and never logged.
- Every PR gets CI checks plus AI code and security reviews before a teammate approves it.

**Open questions**
- Signup shows whether an email already has an account. We accepted this because we don't have email verification, and we'll revisit it if we add verification.
- Login attempts are rate-limited, but each server instance keeps its own count, so the limit isn't shared. Next step: decide in Week 9 whether to store the count in the database instead.

### Database (Betania)

**Main pieces and tools**
- PostgreSQL, hosted through Neon, is used to store teaching sessions so users can save and access their sessions across browsers.
- I built a `teaching_sessions` table to store session information and API routes for CRUD operations. Using SQL migrations, I created database tables and used Vitest to test the API routes and database functionality. The tests run against a temporary local PostgreSQL database instead of the Neon database.

**Stored information**
- The `teaching_sessions` table includes the session's topic, status, timestamps, message history, learner cursor, reflection data, learner ID, and pre-explanation.
- Messages and reflections are stored using JSONB, and each session has an associated `user_id`. Sessions are also automatically deleted when the associated user's account is deleted.

**Secrets and user information**
- `DATABASE_URL` stores the Neon database connection info and is stored in `.env.local` locally and in Vercel environment variables in production, and is not committed to GitHub.
- Users cannot access or modify another user's sessions, and database queries are filtered to prevent unauthorized access.
- Session IDs are generated using `crypto.randomUUID()` to ensure they are secure and cannot be easily guessed.

**Open questions**
- Still need to ensure that the PostgreSQL database is properly configured and improve error messages for issue #22.

### Frontend (Arielle)

**Main pieces and tools**
- Next.js 16 App Router with React 19 and Tailwind v4. Pages are thin server components; the interactive screens are client components under `src/components/screens/`.
- Page architecture (PR 1): route groups organise the app by access without changing URLs. `(site)/(public)` holds `/`, `/about`, `/topics`, `/login` and `/signup`; `(site)/(app)` holds `/learner`, `/reflect` and `/sessions`; `(focus)` holds `/teach`, which draws its own header. `(site)/layout.tsx` renders the shared nav and footer once. Access is still decided per page (`requireUser`) and per API route; layouts are never a guard, because they don't re-render on client navigation.
- Navigation: `SiteNav` is an async server component that reads `getCurrentUser()` and picks the public or student link set, then renders the client `NavBar` (active underline, mobile menu). The login/logout control is auth's `AuthNavControl`, unchanged.
- Design system: tokens live in `globals.css` under `@theme` (colors, the three font families, shadows, radii) with utilities for the type scale (`type-display` … `type-label`), marker bands, sketch underlines and paper textures. Primitives in `src/components/ui/`; doodles and the Pip drawing in `src/components/illustrations/`. Subject accents are CSS variables set per card from `subjects.ts`, all within the green family.
- Illustrations are inline SVG React components, so they take the current text colour, scale without assets, and ship no image files. Fonts are self-hosted by `next/font` at build time; the browser never calls Google.
- Data the frontend depends on: the static topic catalogue (`src/lib/topics.ts`), `/api/sessions` for the student's own sessions, and (once PR #42 lands) `POST /api/sessions/[id]/turn` for Pip's replies. The example conversation on the landing page is written copy, labelled as an example, not data.

**Stored information**
- The frontend stores nothing new. Sessions, pre-explanations and reflections go through Betania's `/api/sessions` routes; the browser keeps only the login cookie. No analytics or third-party scripts.

**Secrets and user information**
- No secrets in the frontend. The nav shows the student's first name from the server session; screenshots and test fixtures use a fake "Test Student" account on a throwaway database, never real students.
- Pip's belief state (PR #42) holds the assessor's private verdicts and is never sent to the browser. The planned belief panel will only render a student-safe projection (statement, status, source) once a backend route provides it. Nothing in the UI invents belief or learning data.

**Open questions**
- Which single subject the team narrows to; the catalogue will filter by a scope list once decided.
- The data contract for a student-safe view of Pip's notebook (proposed: `GET /api/sessions/[id]/beliefs` returning statement, status, source and evidence indexes only), and whether the post-session reflection may ever show that Pip learned something incorrect, given that the product never grades the student.
- Whether to rename the platform from Protégé to Pip, and whether to change the nav's "Sign up" to "Get started" (touches auth's browser tests).

### Deployment and AI features (Chase)

**Main pieces and tools**
- Each student message goes to `POST /api/sessions/[id]/turn`. The server makes two calls to Groq: one that sees the answer key and decides what Pip learned, and one that only sees Pip's notebook and writes the reply.
- Answer keys live in `src/lib/learner/teachable/packs/`. Without an API key, Pip falls back to the scripted demo.

**Stored information**
- Pip's notebook is saved in `teaching_sessions.learner_state`. Only the server reads it.
- Student messages are sent to Groq to generate replies.

**Secrets and user information**
- `LLM_API_KEY` lives only in `.env.local` and Vercel, and never reaches the browser.

**Open questions**
- How to cover quota for user tests, and whether students actually learn more by teaching Pip.
