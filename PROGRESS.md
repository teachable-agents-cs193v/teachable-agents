# Progress

Each team member adds their own section below.

### Authentication (Anahi)

**Progress so far**
- Users can sign up with their name, email and a password, then log in and log out. It's built on Better Auth rather than hand-written security code.
- Signup runs two server-side password checks, ported from A10: a strength check (zxcvbn) with specific tips, and a breach check that rejects passwords found in known data leaks. Only 5 characters of the password's hash are sent to the breach service. A meter shows users how strong their password is as they type.
- The teaching pages (starting a session, teaching, reflecting, past sessions) require login. Logged-out users are sent to log in and brought back afterwards; the home page and topic library stay public. Betania's session routes use the same login check, so students only see their own sessions.
- Team setup: CI runs lint, type checks, tests and a build on every PR, and gitleaks (in CI and as git hooks) catches secrets before they're committed.

**What we learned**
- To address Mara's concern about handoffs, I wrote the auth contract (docs/AUTH.md) first so Betania could build against it, which avoided the miniproject's handoff problem.
- AI code reviews caught real bugs: a failed logout that silently left people logged in, a 128-character paste cutoff that would have broken login, and a build crash.

**Changes from proposal**
- My proposal task was "authentication and user management, including login functionality and helping integrate the AI teaching agent." Following Mara's feedback, I made it concrete for Week 8: users can sign up and log in/out, the teaching pages require login, and each student's teaching sessions are tied to their account so no one else can see them. We met this goal on the live site.
- For the AI-agent part, every teaching session with the AI learner now belongs to the logged-in student. On the deployed app, logged-in students can teach the AI learner, which Chase connected to Groq.
- I used a maintained auth library (Better Auth) instead of hand-written login code like in A10, but reused my A10 password checks: the strength tips and the breach check.
- I left out Google login, 2FA, password reset and email verification. They aren't required for this project, and keeping the scope small let me focus on making the core login reliable and well tested.
- Following Mara's process feedback, every task was a labeled issue (type and priority) with its own small PR, review concerns became assigned issues (#30, #33, #34), and the auth contract (docs/AUTH.md) made the handoff to Betania's session routes explicit.

**Problems**
- #30 / #38: Arielle's browser tests are flaky in development mode. A production build fixes it, and Arielle is updating her PR.

**Contributions and next steps**
- My PRs: #23 (auth contract), #24 (CI), #25 (gitleaks), #26 (password checks), #27 (core auth), #28 (auth database setup), #29 (login and signup pages) and #31 (protected pages).
- I reviewed Betania's #32, which saves teaching sessions in our database so each student only sees their own, and turned my review notes into issues (#33, #34). I also coordinated the merge order and reviewer split for our stacked PRs.
- Week 9: work with Arielle to finish #38, which fixes the flaky browser tests in #30. Her fix needs to move into the shared test server I set up (e2e-auth/server.mts), so we'll do it together.
- Week 9 (smaller): the tooling issues assigned to me: #8 (PR template), #18 (pin Playwright), #20 (Node version) and #21 (ESLint upgrade).
- A task is done when CI passes, a teammate approves with no outstanding feedback, and the issue is closed.

### Database (Betania)

**Progress so far**
- This week, I worked on using PostgreSQL for the storage of teaching sessions. By allowing teaching sessions to use PostgreSQL, sessions can now be saved across browser sessions, and all session data is stored using JSONB and associated with a specific user (#17, PR #32).
- I also implemented checks to ensure that users can only modify or access their own sessions, preventing unauthorized access.
- I also worked on error handling, like restricting which fields can be changed in PR #32 and making sure invalid data returns a 400 error instead of a 500 error in PR #35 (#33). I also improved how screens handle failed loading and saving, along with adding tests (#34, PR #36).
- I worked on making sure session IDs are generated securely (#19, PR #37).
- I also reviewed Anahi's PRs #23 and #28, which focused on the authentication contract and database migration.

**What we learned**
- The biggest thing I learned was that I became a lot more comfortable with managing a database, particularly PostgreSQL through Neon, which will help me with future software applications as well.
- I also learned more about how to connect a database to backend API routes and how to make sure users can only access their own data.

**Changes from proposal**
- There were no major changes, as I was mainly responsible for backend development and database design, such as managing data storage, and I was able to work on implementing PostgreSQL storage for the application.

**Problems**
- I initially had a challenge with connecting the database to our codebase, and we still need to verify that the production database is properly configured and can be used throughout different parts of the application.

**Contributions and next steps**
- I completed PRs #32, #35, #36, and #37, focusing on database storage, validation, error handling, and secure session IDs.
- For Week 9, I plan to focus on verifying the production database and improving error handling for issue #22.
- I will know these tasks are complete when a session saved on the live site can still be accessed after logging out and back in, and when users see a clear error message with a retry option while detailed errors are only shown in the server logs.

### Frontend (Arielle)

TODO (Arielle)

### Deployment and AI features (Chase)

TODO (Chase)
