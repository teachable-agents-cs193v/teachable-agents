# AI learner (Pip)

Pip only knows what the student teaches it in the session, including any mistakes. It's built on the "Reflect, then Respond" pattern from TeachYou/AlgoBo (CHI 2024) and TeachTune (CHI 2025), adapted for natural-language teaching.

## Running it on your machine

1. Make a free Groq account at [console.groq.com](https://console.groq.com) and create an API key. **Use your own key; don't share one.** Each account gets its own quota (about 1,000 requests a day and 8,000 tokens a minute on `openai/gpt-oss-120b`).
2. Add these to `.env.local` (gitignored):
   ```
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_API_KEY=<your key>
   LLM_MODEL=openai/gpt-oss-120b
   ```
3. Apply the migration to your database: `psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0004_learner_state.sql`
4. `npm run dev`, then start a session on any topic with **Start teaching Pip**. The note under the teaching tips says "AI learner" when the model is answering.

With no key, or on a topic without a topic pack, Pip falls back to the scripted demo learner. Nothing breaks.

Any OpenAI-compatible provider works by changing the three variables: Gemini's OpenAI endpoint, Ollama (`http://localhost:11434/v1`), OpenRouter, and others.

## How a turn works

```
student message ─► NOTE-TAKER (model call, models.pip, NO answer key)
                     what new ideas did the student teach? → notes, in Pip's words
                     which earlier taught ideas do they take back? → revisedBeliefIds
                 ─► ASSESSOR (model call, models.assessor, sees the hidden answer key)
                     grade each note: concept? correct? explained? faithful?
                     did they fix one of Pip's misconceptions? which move next?
                     → ids, enums and booleans ONLY (code drops anything else)
                 ─► notebook update (code: notes + grades → beliefs, enforces invariants)
                 ─► PIP'S REPLY (model call, models.pip, sees ONLY the notebook, the move and the chat)
```

Three model calls per student message (the opening is one reply call). They run one after another, because the assessor grades the note-taker's notes.

| Call | Label | Model role | Sees | Returns |
| --- | --- | --- | --- | --- |
| Note-taker | `noteTaker` | `pip` | The learning goal; the part of Pip's notebook the student can already see (taught beliefs and voiced or corrected misconceptions, with ids); the last 8 messages; the student message in `<student_message>` tags | `{ notes: [{ text }], revisedBeliefIds: [id] }` |
| Assessor | `assessor` | `assessor` | The answer key and misconception details; the whole notebook with hidden verdicts; the last 8 messages; the student message; the notes, numbered `[0]`, `[1]`… | `{ noteGrades: [{ index, conceptId, correctness, explained, faithful }], corrections: [{ misconceptionId, targeted, explained }], nowExplainedBeliefIds, offTask, move, moveTarget, readyToWrapUp }` |
| Reply | `reply` | `pip` | Background knowledge, `pipView()` of the notebook, the last 8 messages, the student message, what just changed, the move, its fixed guide text (`MOVE_GUIDE`) and the target belief's statement from the notebook | `{ mood, text }` |

- **Code never interprets language.** Every judgment about what someone said is made by one of the prompts in `src/lib/learner/teachable/prompts.ts`. Code only stores structured verdicts, decides what each call can see, validates JSON and checks ids against allowlists.
- **The note-taker writes Pip's new beliefs; the assessor only grades them.** Notes are capped at 3 per message and 300 characters each. Code joins each note with its grade (`buildAssessment` in `pipeline.ts`): a note graded `faithful: false` (it adds or fixes something the student didn't say) is dropped; a note with no grade is kept as `unclear` and not explained. The belief text always comes from the note-taker.
- **The reply call never sees the answer key, or anything the assessor wrote.** That's the main defence against Pip "knowing" things. Research shows that telling a model to pretend not to know doesn't work; hiding the information does. (There used to be a `moveNote` sentence from the assessor to the reply. It was removed: it was a way for answer-key text to reach Pip.)
- **Misconceptions only flip on a real correction.** A starting misconception becomes `corrected` only when the assessor marks the correction both *targeted* (it addressed that specific mistake) and *explained* (it said why). A bare "that's wrong" makes Pip push back instead.
- **Pip learns wrong things too.** If the student teaches something incorrect, Pip believes it. The hidden `taughtCorrectly` verdict records it for the reflection page and evaluation.
- **The server writes the whole conversation.** `POST /api/sessions/[id]/turn` with `{ clientMessageId, text }` saves the student's message before any model call, then saves Pip's reply, cursor and notebook together (`teaching_sessions.learner_state`). `PUT` can't change messages, so the stored transcript is what actually happened. Both writes check the session hasn't changed since it was read, so two tabs can't interleave turns. Retrying the same request never saves or answers a message twice, and a model failure leaves the student's message saved for the retry. Messages are capped at 1,500 characters.
- **The browser never sees the notebook itself**, only the student view below. `GET /api/sessions/[id]` never returns it.
- **A retry never re-runs the note-taker or the assessor.** Once a message is assessed, the state is saved as `pending` with the verdict in `lastAssessment`; a retried turn (or the device fallback) only runs the reply.

## LLM safety: no call has the whole "lethal trifecta"

A model call is dangerous when it has all three of: **untrusted input** (text an attacker controls, here the student's message), **sensitive data** (here the topic pack's answer key: `keyIdea`, `whyWrong`, `correctionMustAddress`), and **external output** (a way for its text to reach the student, including by way of Pip's reply). A prompt-injected message could then make the model copy the secret out. Before this split the assessor had all three: it read the student message, saw the key, and wrote `claims[].pipStatement` (shown in the beliefs panel and fed to the reply), `moveNote` (fed to the reply) and `analysis` (stored).

Each call now lacks at least one leg, and the missing leg is enforced by code, not by asking the model nicely:

| LLM call | Untrusted input | Sensitive data | External output | Software control |
| --- | --- | --- | --- | --- |
| Note-taker (`noteTaker`, `models.pip`) | Yes: student message, recent conversation | **No.** Only the learning goal and what the student can already see of the notebook (`noteTakerView()`: taught beliefs, voiced or corrected misconceptions). Not even unvoiced misconceptions. | Yes: its notes become belief text in the beliefs panel, progress, review and the reply prompt | The prompt is built by `noteTakerMessages()`, which is never passed the pack's concepts or misconception details. `parseNotes()` keeps at most 3 notes of 300 characters and only belief ids of taught beliefs in the notebook. Tested: the prompt never contains key text. |
| Assessor (`assessor`, `models.assessor`) | Yes: student message, conversation, and the notes (a paraphrase of it) | Yes: the whole answer key | **No.** Only allowlisted ids, enum values, note indexes and booleans leave the call | `parseAssessorVerdict()` in `assessorBoundary.ts` builds a fresh object: `conceptId` must be a pack concept id, `misconceptionId` a pack misconception id (`m:` prefix mapped), `nowExplainedBeliefIds` and `moveTarget` ids in the current notebook, `move` one of `MOVES`, `correctness` one of its four values, `index` an integer index of a note from this turn; booleans must be `true`/`false`, not strings. Anything else is dropped or set to a fixed default; unknown keys are ignored; nested values are never copied. `upgradeState()` strips the old `analysis`/`moveNote` from states saved before the split. Tested with adversarial and fuzzed inputs and an end-to-end injected assessor. |
| Reply (`reply`, `models.pip`) | Yes: student message, conversation | **No.** `pipView()` of the notebook only: statements and how sure Pip is | Yes: Pip's message | The prompt is built by `replyMessages()` from the notebook, the move, the fixed `MOVE_GUIDE` text and the target belief's statement from the notebook. Nothing the assessor wrote is passed. Tested: the prompt never contains key text, even when the assessor is injected. |
| On-device reply (experiment, off) | Yes | **No.** `deviceReplyMessages()` uses the notebook only | Yes | Same as the reply. The device can only change Pip's wording; the server keeps the notebook. |
| Eval judge (`npm run eval`, developers only) | Scripted test students and saved real sessions, not live users | Yes: the answer key, to spot leaks | **No.** It writes a local report; nothing reaches the app | Not part of the app. Claude via `claude -p` with no tools and no MCP servers, returning only its JSON schema (`eval/claudeJudge.ts`). |

What's left, and accepted:

- **The assessor's structured values still mean something.** Its correctness verdict is what makes the `taught_wrong` flag appear, so a student can learn "that idea was judged wrong" one idea at a time (the product decision above). It can't send the key's words: the most it can do is pick wrong ids, enums or moves, or drop a note by grading it unfaithful.
- **A target belief's statement is notebook text.** `moveTarget` can point the reply at any belief, including a starting misconception the student hasn't seen yet (that's how Pip voices one). Those are Pip's own wrong ideas, written in the pack for Pip to say, not the answer key.
- **The note-taker can be talked into writing anything the student typed.** It holds nothing secret, so the student only gets back their own words.
- Tests: `src/lib/learner/teachable/__tests__/assessorBoundary.test.ts` (adversarial objects, a seeded fuzz test, the pipeline end to end) and the "prompt-injected assessor" case in `src/app/api/sessions/__tests__/turn.test.ts` (the route's response, the reply prompt and the stored `learner_state`).

## AI notice: students are told, every session

There's no offline or scripted option for students: every session is AI Pip, and the start screen says so before each one. "Where your words go" (`src/components/AiNoticeCard.tsx`) is open every time, with nothing remembered between visits: a one-line summary with a "Full details" link to `/ai-data` (public), what goes to Groq, what doesn't, what Groq does with it, what we keep, and a single **Start teaching Pip** button. The details fold away with a click; the one line stays. On the teach screen a line under the message box says where messages go (`src/components/DataLine.tsx`), and the dashboard has Delete on every session.

- **Stored:** `POST /api/sessions { topicId, preExplanation? }` always stores `learner_id = "pip"`. Any `learner` or `learnerId` field in the body (including the old `learner: "offline"`) is ignored. No update query writes `learner_id`, so the browser can't change it afterwards (`PUT` ignores it).
- **Enforced:** `modelsFor(session, models)` in `src/lib/learner/teachable/server.ts` returns no models unless `learner_id` is `"pip"`, and `learnerTurn` and `deviceTurn` (the only code that calls a model for a session) start with it. Unknown ids fail closed. Rows with `"pip-offline"` (only from testing the removed offline choice) stay readable and get the scripted learner; nothing can create one now.
- **No model configured:** when the server has no `LLM_*` settings, the scripted learner answers. That's an operator fallback, not a student option, and the teach-screen line then says "The AI isn't available right now, so a simpler scripted Pip is answering. Nothing you type leaves our server."
- **Copy:** every sentence about the provider is in `src/lib/aiData.ts`, with the policy links. Set `ZDR_ENABLED = true` there after turning on Zero Data Retention in the Groq console (Settings → Data Controls); it changes the retention sentences.
- **What's sent:** the note-taker, assessor and reply prompts (`prompts.ts`) carry the topic pack, Pip's notebook, the last few messages and the newest message. No name, email, user id or session id; the request body has no `user` field. `src/app/api/sessions/__tests__/consent.test.ts` checks that against a fake model, that `learner: "offline"` still gets AI Pip, and that an old `"pip-offline"` row makes zero model calls.

## For the UI: what Pip believes

Every turn response carries `pip`, and `GET /api/sessions/[id]/pip` returns the same thing after a reload. The `useTeachingSession` hook exposes it as `pipBeliefs`. It's `null` for the scripted learner.

```ts
// src/lib/types.ts
interface StudentBelief {
  id: string;
  statement: string;          // in Pip's words
  status: "heard"             // the student said it, no reason yet
        | "understood"        // the student explained why, or gave an example
        | "believes"          // Pip started out believing this and has said it
        | "changed_mind";     // the student's explanation changed Pip's mind
  startedWith: boolean;       // Pip believed it before the session
  changedThisTurn: boolean;   // added or changed by the student's latest message
  evidence: number[];         // which student messages it came from (0 = the first)
}
```

- The beliefs panel itself never says whether a belief is **correct**. Wrong ideas are flagged separately (`progress.flags` and `progress.wrongTaught`, below), which say an idea isn't right, never what the right one is.
- Starting misconceptions appear only once Pip has said them, or the student has changed Pip's mind about them, so the panel doesn't spoil what's coming.
- `changedThisTurn` is the moment to animate: it's how a student sees their explanation land.

## For the UI: learning progress and the review

Each turn also records what the student's message changed (beliefs added, status changes, correction attempts, misconceptions voiced) in `learner_state.history` (`learner_state.version` 2; version 1 sessions upgrade in code, so no migration). Metrics are counted from those structured fields only (`src/lib/learner/teachable/progress.ts`). Code never reads the text.

| Where | Shape (`src/lib/types.ts`) | When |
| --- | --- | --- |
| `progress` on every `POST /turn` response, and `GET /api/sessions/[id]/progress` → `{ progress }` | `LearningProgress`: `studentTurns`, `recordedFromTurn`, `beliefs` (count per status), `teaching` (`claims`, `explained`, `asserted`, `explainedLater`), `misconceptions` (`ProgressMisconception[]`: status, `voicedAtTurn`, `changedAtTurn`, `turnsToChange`, `attempts`), `timeline` (`TimelineEntry[]`) | During the session. Nothing from the answer key and no unvoiced misconceptions. Wrong ideas are flagged (`flags`, `wrongTaught`; see below), but correctness verdicts on anything else are not shown. |
| `GET /api/sessions/[id]/review` → `{ review }` | `LearningReview`: `metrics` (adds `correctness` counts, misconception `total/voiced/corrected/stillHeld`, `offTaskTurns`), every `misconceptions` entry with `label`, `outcome` and each attempt, `taught` with the assessor's `correctness`, and the full `timeline` | **409 until the session is completed.** Never includes key ideas, `whyWrong` or `correctionMustAddress`. |

**Flagging wrong ideas (product decision, 2026-11-18).** Catching Pip's wrong ideas is the student's main work, so the student is told when an idea is wrong, but never what the right one is, and Pip itself never says it:
- `progress.flags`, about the latest message only: `pip_wrong_idea` (Pip just voiced one of its starting misconceptions) and `taught_wrong` (the student just taught something the assessor judged wrong or partly wrong). Shown under the chat by `LearningFlags`.
- `progress.wrongTaught`: wrong ideas the student taught, with `fixed` once they took them back (`revisedBeliefIds`). Shown in `MisconceptionTracker` ("Wrong ideas to catch").
- The trade-off, accepted: a claim with no flag tells the student it was judged correct or unclear, so they can probe the assessor one claim at a time. The answer key's text is still never sent.

All three are `null` for the scripted learner. Turns are student message indexes (0 = first); show them as `turn + 1`. `useTeachingSession` exposes `progress` (from the turn response, loaded once after a reload, no polling).

Components (`src/components/learning/`, self-contained; props are the shapes above):

- `PipBeliefsPanel` (`beliefs: StudentBelief[]`): "What Pip believes", in the workspace sidebar. Items with `changedThisTurn` get `animate-pop` and a "New" tag.
- `MisconceptionTracker` (`misconceptions`, `studentTurns`): Pip's starting ideas once voiced, in the sidebar. It's worded neutrally on purpose and never says an idea is wrong during the session.
- `LearningStrip` (`progress`): counts, "your last message: …" (an `aria-live` region) and one dot per message, under the conversation (so it's visible on phones; the sidebar opens from "Pip's notes").
- `LearningReviewPanel` (`review`): on the reflection page in place of the scripted learner's cards.
- `labels.ts`: every label, hint, Badge tone and timeline dot colour in one place for restyling.

`npm run test:e2e:learning` drives these screens with a local fake model (`e2e-auth/fakeLlm.mts`), with no quota used.

## Files

| Path | What it is |
| --- | --- |
| `src/lib/learner/teachable/packs/` | Hidden answer keys per topic: concepts, Pip's starting misconceptions, what a real correction must address. **Human-reviewed; the assessor treats them as ground truth.** |
| `src/lib/learner/teachable/prompts.ts` | The note-taker, assessor and Pip prompts. Most behavior changes happen here. |
| `src/lib/learner/teachable/assessorBoundary.ts` | `parseAssessorVerdict()`: the allowlist that keeps any text from leaving the assessor (the trifecta boundary). |
| `src/lib/learner/teachable/notebook.ts` | Notebook state, invariants, and `pipView()` (what Pip may see). |
| `src/lib/learner/teachable/pipeline.ts` | One turn: note-taker, assessor, update, reply. |
| `src/lib/learner/teachable/llm.ts` | OpenAI-compatible client. |
| `src/lib/learner/teachable/turnService.ts` | One turn on the server: save the student's message, run the pipeline, save Pip's reply. |
| `src/app/api/sessions/[id]/turn/route.ts` | The turn route. |
| `src/app/api/sessions/[id]/pip/route.ts` | What Pip believes, for the panel. |
| `src/lib/learner/teachable/history.ts` | Per-turn history, recorded from the notebook diff and the assessor's verdict. |
| `src/lib/learner/teachable/progress.ts` | Live metrics (`buildProgress`) and the end-of-session review (`buildReview`). |
| `src/app/api/sessions/[id]/progress/route.ts`, `.../review/route.ts` | The progress and review routes. |
| `eval/` | Live evaluation against the real model (below). |

## Adding a topic

Write a pack in `src/lib/learner/teachable/packs/` with the same shape as `probability.ts`, register it in `packs/index.ts`, and add cases for it in `eval/sets/` (Derivatives has the full set; probability has conversation scenarios). A model can draft the pack, but a person must check every concept and misconception.

## Evaluating Pip

`npm run eval -- --set=A,B,C,D` runs the eval suite in `eval/` against the real pipeline and models: A (assessor verdicts per message), B (note-taker faithfulness), C (multi-turn conversations) and D (prompt injection and leaks). Cases are data in `eval/sets/` (catalog: `eval/sets/CATALOG.md`). The only judge is Claude, run through Claude Code headless (`claude -p`, no tools, no MCP servers; enforced by `eval/__tests__/judgeEnforcement.test.ts`). Code checks structured state and scans everything student-visible for answer-key text. Reports go to `eval/results/<run>/` (gitignored). How to run it, flags, resuming and costs: `eval/README.md`.

It spends real Groq quota, so it isn't part of `npm test` or CI. Unit and route tests use a fake model.

## When the model fails: errors the student sees

The student's message is saved before any model call, so a failed turn never loses it, and "Try again" resends the same body (it's never saved or answered twice). The student never sees the provider's own error.

- **Out of capacity** (Groq answers 429: the per-minute rate limit or the daily quota). `llm.ts` still retries short waits and fails at once on long ones, as below, and the error it throws has `kind: "rate_limited"` and `retryAfterSeconds` when Retry-After gave a number. `POST /turn` answers `503 { error, code: "at_capacity", retryAfterSeconds? }`, and the browser (`postTurn` / `postDeviceReply` in `src/lib/learner/httpLearner.ts`) shows "Pip is at capacity right now: a lot of people are teaching at once. Try again in a few minutes." (or "in about N minutes/hours" when the wait is known). The wording is in `src/lib/learner/capacity.ts`. The client goes by `code`, never by the text. `POST /device-reply` never calls a model, so it can't hit this; the assessor call for the on-device path happens in `/turn`.
- **Any other model failure** (5xx, timeouts, bad JSON): `503` (or `500` for a non-model bug) with "Pip is having trouble thinking right now. Wait a moment and try again." and no `code`.
- Tests: "says Pip is at capacity" and "keeps the student's message when the model fails" in `src/app/api/sessions/__tests__/turn.test.ts`, "failed turns" in `src/lib/__tests__/httpLearner.test.ts`, and the rate-limit cases in `src/lib/learner/teachable/__tests__/llm.test.ts`.

## Free-tier caveats

- Respect the provider's terms. Don't put real student names or personal details in messages during user tests.
- There is also a daily cap of about 200,000 tokens on `openai/gpt-oss-120b`. One Pip turn uses roughly 5,000–5,500 tokens (note-taker about 1,300, assessor about 2,700, reply about 1,200; estimated from prompt sizes; `npm run eval` reports measured tokens per call), so one key handles about 35–40 student messages a day if every role is on one model. A full `npm run eval` of all four sets needs several days of it (see `eval/README.md`). When the daily cap runs out, every call returns 429 until it resets.
- 8,000 tokens a minute is about 1–1.5 Pip turns a minute per account. Past that, Pip waits for the limit to clear (up to 30 seconds) before answering. A class-size user test on one account will hit it. Use several accounts or a paid tier for that.
- Quotas are per Groq **account** and per model, not per key. A second key on the same account shares the same quota. Each model has its own, so `LLM_MODEL=openai/gpt-oss-20b` (smaller and weaker, but with separate quota) works as a fallback when `gpt-oss-120b` runs out.
- **Split the roles across models** to stretch the free quota. `LLM_MODEL_ASSESSOR` is the call that sees the answer key and makes the hard judgments, so keep it on `openai/gpt-oss-120b`. `LLM_MODEL_PIP` covers the calls that never see the answer key (the note-taker and the reply), and can run on `openai/gpt-oss-20b`. Both default to `LLM_MODEL`. The eval report shows calls and tokens per role, including prompt-cache hits.

## On-device Pip (Derivatives) — experiment, off for students

**Not shown to students.** It worked as a research demo, but the 0.6B model is far weaker than the server Pip in conversation, so nothing about it renders and the server ignores it unless both switches are on, for local experiments only:
`NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT=1` (the panel) and `DEVICE_PIP_EXPERIMENT=1` (the server honours `replyOn: "device"`; otherwise `/device-reply` answers 404).

For topics whose pack has a `device` prompt (only Derivatives so far), Pip's reply can be written in the student's browser by a small model instead of the server's reply model:

- **The model.** Qwen3-0.6B with Calc 1 derivatives unlearned (`research/unlearning`, adapter v10 step 150), packed for WebLLM with `research/unlearning/mlc_pack.py` (16-bit, 1.2 GB; verified byte-identical in format to WebLLM's own Qwen3-0.6B). It runs on WebLLM's prebuilt Qwen3-0.6B library.
- **The turn, in two steps.** `POST /turn` with `replyOn: "device"` assesses the message, updates the notebook and returns `device: { forMessageId, messages }`: the device prompt, filled from Pip's notebook only (`deviceReplyMessages`), never the answer key. The browser writes the reply and saves it with `POST /device-reply { forMessageId, text }`, tagged `generatedOn: "device"`. Only the reply the server asked for is accepted. If the device can't write it, a plain `{}` turn replies on the server without assessing again.
- **What the device can change.** Only Pip's words. The assessor, the notebook, the transcript and the learning metrics stay on the server.
- **UI.** `DevicePipPanel` in the teach sidebar: turn it on, see load progress and the speed of each reply. The choice is remembered per browser.
- **Trying it locally.** Link the weights into `public/webllm/pip-v10-q0f16-MLC/resolve/main` (gitignored), then `npm run dev:local` (a throwaway Postgres; sign up with any email). WebGPU is needed: recent Chrome or Edge on a Mac, or Safari on iOS 26+.
