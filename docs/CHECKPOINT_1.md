# Checkpoint 1 (Week 8/9) Status

*Prepared for the Friday, November 13, 2026 check-in. Author: Arielle Blumenfeld (frontend/UX).*

## What we planned

Issue #1 laid out the first milestone: initialize the Next.js app, establish a consistent visual system and reusable components, build the landing page and topic selection, create the learner introduction and an interactive teaching chat with mock AI responses, build the reflection and past-sessions pages, define the interfaces the backend work will plug into, and test navigation and responsiveness.

## What has been implemented

All of the above, on branch `feat/arielle-teaching-ui`, in PR #2 (open, targets `main`, closes #1).

- Next.js 16 (App Router, TypeScript) with Tailwind v4, initialized in the repository root
- Six screens: landing, topic library, Meet Your Learner, teaching workspace, reflection, past sessions (plus a per-session review page and a not-found page)
- Design tokens in `src/app/globals.css` (palette, Fraunces and DM Sans, shadows, notebook-paper and focus-ring utilities) and primitives in `src/components/ui/`
- Pip, the learner, as an SVG avatar with four moods
- Five topics with scripted conversations in `src/lib/scripts/`. Probability has nine turns and three misconceptions; the other four have six turns and two misconceptions each
- `LearnerAdapter` and `SessionStore` interfaces with demo implementations
- Unit tests (Vitest) and an end-to-end test (Playwright) of the full student flow
- README with setup, structure, and integration notes

## Arielle's contributions

Everything in PR #2: product framing and copy, visual design and design system, all screens and components, the scripted learner and the five conversation scripts, the adapter interfaces, the session hook and localStorage persistence, tests, and documentation. Built with Claude Code assistance.

## Team responsibilities

The split below is what was described when the frontend work was scoped. **Marked as proposed until each person confirms at Friday's check-in.**

| Person | Area | Integration point in the code | Status |
| --- | --- | --- | --- |
| Chase | AI learner API | Implement `LearnerAdapter` (`src/lib/learner/adapter.ts`), swap in `getLearnerAdapter()` | Proposed, not started as far as the repo shows |
| Betania | Persistence and database | Implement `SessionStore` (`src/lib/persistence/adapter.ts`), swap in `getSessionStore()` | Proposed, not started as far as the repo shows |
| Anahi | Authentication | Sign-in control in `Navbar`, user scoping in the session store, protect `/teach`, `/reflect`, `/sessions` | Proposed, not started as far as the repo shows |
| Arielle | Frontend and UX | Screens, components, design system, evaluation UI | Milestone 1 done (PR #2) |

"Not started as far as the repo shows" means there are no branches or commits for that work in this repository as of November 9. Teammates may have work locally.

## References

- Issue #1: Initial Frontend Setup and Core UI Implementation (open)
- PR #2: Build student-facing frontend MVP, `feat/arielle-teaching-ui` → `main` (open, closes #1)
- Commit `6bf3c15` on the feature branch

## How to demo the student flow

```
npm install
npm run dev
```

Then at http://localhost:3000:

1. Click **Start Teaching**, filter to **Probability**, click **Teach This Topic**.
2. On Meet Pip, optionally write a pre-session explanation, click **Start Teaching**.
3. Reply to Pip. Suggested replies that fit the script: "Independence means one event happening doesn't change the probability of the other", then "Flipping heads on a coin and rolling a six on a die", then "Because the die doesn't know what the coin did; P(six | heads) is still 1/6". Pip's follow-ups are scripted, so any reply advances the conversation.
4. Refresh the page to show the session persists.
5. Click **End Session**, confirm, and walk through the reflection page. Point out the "not a score" note and the "From Pip's script" tags.
6. Fill in and save the reflection, then open **My sessions** and **Review** to show the transcript with misconception tags.

For a short demo, the whole thing takes about four minutes.

## Testing completed

Run on November 9, 2026 in the course dev container, on commit `6bf3c15`:

| Check | Result |
| --- | --- |
| `npm run lint` | Clean, no warnings |
| `npm run typecheck` | Clean |
| `npm test` | 16 unit tests pass in 3 files (`scriptedLearner`, `localStorageStore`, `utils`) |
| `npm run test:e2e` | 3 Playwright tests pass: full student journey, empty sessions state, not-found states |
| `npm run build` | Succeeds, 11 routes |

Every screen was also reviewed by screenshot at desktop (1360px) and phone (390px) widths. No user testing has been done yet; see `EVALUATION.md` for the plan.

## Still mocked or awaiting integration

- Pip's responses (scripted, not model-driven, and not responsive to the student's wording)
- Session persistence (browser localStorage only)
- Accounts and sign-in (not built)
- Concepts and misconceptions on the reflection page come from script tags, not analysis of the conversation
- Topic catalogue is static

## Proposed integration deadline

**Thursday, November 12 at 6 PM PT**: each backend area has at least a working branch that implements its interface against the demo UI, even if rough. This is proposed, not agreed, and depends on what Chase, Betania, and Anahi say on Friday. If it is too tight, the fallback for the checkpoint demo is the scripted learner, which already works end to end.

## Risks, blockers, and escalation

- **Risk: the real learner does not fit the adapter.** Mitigation: the interface is small (two methods, one reply shape). If Chase needs changes, Arielle will adjust the UI rather than block the backend. Escalate if it is not resolved by Wednesday.
- **Risk: model responses stop sounding like a learner.** A general model drifts toward explaining. The prompt design is Chase's, but the UI copy assumes Pip asks and gets things wrong. Worth a short pairing session.
- **Risk: persistence changes the session shape.** `TeachingSession` in `src/lib/types.ts` is the contract. Any field changes should go through a PR so the reflection and review pages do not break.
- **Blocker: no confirmed ownership.** The responsibility table above is unconfirmed. Resolve at Friday's check-in.
- **Blocker: no evaluation data.** We cannot say anything about learning until the protocol in `EVALUATION.md` runs with real classmates.
- **Escalation plan.** If a teammate is blocked for more than two days, raise it in the team channel and, if unresolved, bring it to the Friday check-in or to the course staff.

## Next steps after Friday

1. Confirm ownership and the Thursday deadline with Chase, Betania, and Anahi.
2. Merge PR #2 once teammates have reviewed it, so integration branches start from `main`.
3. Run the user-testing protocol with 2 to 3 classmates on the scripted learner, so we have a baseline before the model goes in.
4. Arielle: add a sign-in affordance to the navbar as a placeholder for Anahi, and a route handler stub under `src/app/api/learner/` if that is where Chase wants to put the model call.
5. Revisit the reflection page once the real learner can tag concepts, so the "From Pip's script" labels become "From this conversation."
