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

TODO (Betania)

### Frontend (Arielle)

TODO (Arielle)

### Deployment and AI features (Chase)

TODO (Chase)
