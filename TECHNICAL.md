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

TODO (Betania)

### Frontend (Arielle)

TODO (Arielle)

### Deployment and AI features (Chase)

TODO (Chase)
