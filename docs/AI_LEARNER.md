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
3. Apply the migration to your database: `psql "$DB_DIRECT_URL" -1 -v ON_ERROR_STOP=1 -f db/migrations/0003_learner_state.sql`
4. `npm run dev`, then start a session on any topic. The note under the teaching tips says "AI learner" when the model is answering.

With no key, or on a topic without a topic pack, Pip falls back to the scripted demo learner. Nothing breaks.

Any OpenAI-compatible provider works by changing the three variables: Gemini's OpenAI endpoint, Ollama (`http://localhost:11434/v1`), OpenRouter, and others.

## How a turn works

```
student message ─► ASSESSOR (model call, sees the hidden answer key)
                     what did the student claim? correct? explained?
                     did they fix one of Pip's misconceptions? which move next?
                 ─► notebook update (code: records the verdict, enforces invariants)
                 ─► PIP'S REPLY (model call, sees ONLY the notebook, the move and the chat)
```

- **Code never interprets language.** Every judgment about what someone said is made by one of the two prompts in `src/lib/learner/teachable/prompts.ts`. Code only stores structured verdicts, decides what each call can see, and validates JSON.
- **The reply call never sees the answer key.** That's the main defence against Pip "knowing" things. Research shows that telling a model to pretend not to know doesn't work; hiding the information does.
- **Misconceptions only flip on a real correction.** A starting misconception becomes `corrected` only when the assessor marks the correction both *targeted* (it addressed that specific mistake) and *explained* (it said why). A bare "that's wrong" makes Pip push back instead.
- **Pip learns wrong things too.** If the student teaches something incorrect, Pip believes it. The hidden `taughtCorrectly` verdict records it for the reflection page and evaluation.
- **The server writes the whole conversation.** `POST /api/sessions/[id]/turn` with `{ clientMessageId, text }` saves the student's message before any model call, then saves Pip's reply, cursor and notebook together (`teaching_sessions.learner_state`). `PUT` can't change messages, so the stored transcript is what actually happened. Both writes check the session hasn't changed since it was read, so two tabs can't interleave turns. Retrying the same request never saves or answers a message twice, and a model failure leaves the student's message saved for the retry. Messages are capped at 1,500 characters.
- **The browser never sees the notebook itself**, only the student view below. `GET /api/sessions/[id]` never returns it.

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
| `src/lib/learner/teachable/prompts.ts` | The assessor and Pip prompts. Most behavior changes happen here. |
| `src/lib/learner/teachable/notebook.ts` | Notebook state, invariants, and `pipView()` (what Pip may see). |
| `src/lib/learner/teachable/pipeline.ts` | One turn: assessor, update, reply. |
| `src/lib/learner/teachable/llm.ts` | OpenAI-compatible client. |
| `src/lib/learner/teachable/turnService.ts` | One turn on the server: save the student's message, run the pipeline, save Pip's reply. |
| `src/app/api/sessions/[id]/turn/route.ts` | The turn route. |
| `src/app/api/sessions/[id]/pip/route.ts` | What Pip believes, for the panel. |
| `src/lib/learner/teachable/history.ts` | Per-turn history, recorded from the notebook diff and the assessor's verdict. |
| `src/lib/learner/teachable/progress.ts` | Live metrics (`buildProgress`) and the end-of-session review (`buildReview`). |
| `src/app/api/sessions/[id]/progress/route.ts`, `.../review/route.ts` | The progress and review routes. |
| `eval/` | Live evaluation against the real model (below). |

## Adding a topic

Write a pack in `src/lib/learner/teachable/packs/` with the same shape as `probability.ts`, register it in `packs/index.ts`, and add scenarios for it in `eval/scenarios.ts` (the current scenarios cover the probability topic only). A model can draft the pack, but a person must check every concept and misconception.

## Evaluating Pip

`npm run eval` replays scripted students against the real model. They:

- quiz an empty Pip;
- ask for answers;
- attempt prompt injection;
- give bare "you're wrong" corrections;
- teach wrong ideas;
- teach well;
- send vague or off-topic messages.

A judge model scores every reply for leaks, judging the student, teaching, breaking character and following the move. Code checks only the notebook's structured state. Reports go to `eval/results/latest.md` (gitignored).

```bash
EVAL_JUDGE_MODEL=qwen/qwen3.8-27b npm run eval     # a different model family as judge
EVAL_ONLY=injection,bare-corrections npm run eval  # just some scenarios
```

It spends real quota (roughly 3 calls per student message), so it isn't part of `npm test` or CI. Unit and route tests use a fake model.

## Free-tier caveats

- Respect the provider's terms. Don't put real student names or personal details in messages during user tests.
- There is also a daily cap of about 200,000 tokens on `openai/gpt-oss-120b`. One Pip turn uses about 4,000 tokens (assessor about 2,800, reply about 1,200), so one key handles about 50 student messages a day. A full `npm run eval` uses about half of that. When the daily cap runs out, every call returns 429 until it resets.
- 8,000 tokens a minute is about 1–2 Pip turns a minute per account. Past that, Pip waits for the limit to clear (up to 30 seconds) before answering. A class-size user test on one account will hit it. Use several accounts or a paid tier for that.
- Quotas are per Groq **account** and per model, not per key. A second key on the same account shares the same quota. Each model has its own, so `LLM_MODEL=openai/gpt-oss-20b` (smaller and weaker, but with separate quota) works as a fallback when `gpt-oss-120b` runs out.
- **Split the roles across models** to stretch the free quota. `LLM_MODEL_ASSESSOR` is the call that sees the answer key and makes the hard judgments, so keep it on `openai/gpt-oss-120b`. `LLM_MODEL_PIP` covers the calls that only see Pip's notebook (the reply), and can run on `openai/gpt-oss-20b`. Both default to `LLM_MODEL`. The eval report shows calls and tokens per role, including prompt-cache hits.

## On-device Pip (Derivatives) — experiment, off for students

**Not shown to students.** It worked as a research demo, but the 0.6B model is far weaker than the server Pip in conversation, so nothing about it renders and the server ignores it unless both switches are on, for local experiments only:
`NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT=1` (the panel) and `DEVICE_PIP_EXPERIMENT=1` (the server honours `replyOn: "device"`; otherwise `/device-reply` answers 404).

For topics whose pack has a `device` prompt (only Derivatives so far), Pip's reply can be written in the student's browser by a small model instead of the server's reply model:

- **The model.** Qwen3-0.6B with Calc 1 derivatives unlearned (`research/unlearning`, adapter v10 step 150), packed for WebLLM with `research/unlearning/mlc_pack.py` (16-bit, 1.2 GB; verified byte-identical in format to WebLLM's own Qwen3-0.6B). It runs on WebLLM's prebuilt Qwen3-0.6B library.
- **The turn, in two steps.** `POST /turn` with `replyOn: "device"` assesses the message, updates the notebook and returns `device: { forMessageId, messages }`: the device prompt, filled from Pip's notebook only (`deviceReplyMessages`), never the answer key. The browser writes the reply and saves it with `POST /device-reply { forMessageId, text }`, tagged `generatedOn: "device"`. Only the reply the server asked for is accepted. If the device can't write it, a plain `{}` turn replies on the server without assessing again.
- **What the device can change.** Only Pip's words. The assessor, the notebook, the transcript and the learning metrics stay on the server.
- **UI.** `DevicePipPanel` in the teach sidebar: turn it on, see load progress and the speed of each reply. The choice is remembered per browser.
- **Trying it locally.** Link the weights into `public/webllm/pip-v10-q0f16-MLC/resolve/main` (gitignored), then `npm run dev:local` (a throwaway Postgres; sign up with any email). WebGPU is needed: recent Chrome or Edge on a Mac, or Safari on iOS 26+.
