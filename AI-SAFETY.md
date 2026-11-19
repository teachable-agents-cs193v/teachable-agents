# AI Safety

<!--
HOW TO USE THIS FILE
- Write every answer yourself, by hand (course requirement).
- The hidden notes are technical facts only.
- DELETE every comment before you submit.
- More detail: docs/AI_LEARNER.md (per-call trifecta table) and src/lib/learner/teachable/assessorBoundary.ts.
-->

## Every place we use an LLM

<!--
FACTS: LLM calls in the app (all on Groq, via src/lib/learner/teachable/llm.ts)
1. Note-taker, openai/gpt-oss-20b, label "noteTaker".
   - Sees: the topic's learning goal; the beliefs the student can already see (no answer key; no unvoiced starting misconceptions); recent conversation; the student's message (wrapped in <student_message> tags).
   - Outputs: { notes: [{text}], revisedBeliefIds } — notes become Pip's beliefs, shown to the student.
2. Assessor, openai/gpt-oss-120b, label "assessor".
   - Sees: the answer key (concept key ideas, misconception details from packs/*.ts); Pip's notebook; the note-taker's notes by index; recent conversation; the student's message.
   - Outputs only: noteGrades [{index, conceptId, correctness, explained, faithful}], corrections [{misconceptionId, targeted, explained}], nowExplainedBeliefIds, offTask, move, moveTarget, readyToWrapUp.
3. Reply (Pip's voice), openai/gpt-oss-20b, label "reply".
   - Sees: Pip's notebook (pipView: statements and how sure Pip is; no answer key), the move, the fixed MOVE_GUIDE text for that move, the target belief's statement, recent conversation, the student's message.
   - Outputs: { mood, text } — Pip's message, shown to the student.
Not in the app:
- On-device reply (WebLLM): an experiment, off unless DEVICE_PIP_EXPERIMENT=1 and NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT=1. Same notebook-only prompt.
- Eval judge (Claude via `claude -p`): developer-only, local reports, no tools.
-->


## For each use: why it doesn't have all three parts of the lethal trifecta

<!--
FACTS
| Call | Untrusted input | Sensitive data | External communication |
| --- | --- | --- | --- |
| Note-taker | yes (student text) | no (only what the student can already see) | yes (notes are shown) |
| Assessor | yes (student text, notes) | yes (answer key) | no (only allowlisted ids, enums and booleans leave it) |
| Reply | yes (student text) | no (pipView only) | yes (Pip's message) |
"Sensitive data" here: the topic pack's answer key and misconception details (packs/*.ts). Also, no call sees other users' data: each request is scoped to one session owned by the logged-in user.
-->

### Use 1:


### Use 2:


### Use 3:


## The software controls that enforce this

<!--
FACTS (file:line on branch learner/safe-assessor)
- Assessor output boundary: src/lib/learner/teachable/assessorBoundary.ts
  - Comment block: lines 1–22.
  - assessorAllowlist: :48. parseAssessorVerdict: :65. It builds a fresh object.
  - Each value must be in an allowlist: conceptId in the pack's concepts; misconceptionId in the pack's misconceptions; belief ids in the current notebook; move in MOVES; correctness in its enum; note index in range; booleans must be real booleans.
  - Anything else is dropped or defaulted. Unknown keys and nested objects are never copied.
- Pip's belief text comes only from the note-taker: buildAssessment, pipeline.ts:102. Notes the assessor grades faithful:false are dropped.
- The note-taker's prompt never receives the pack's concepts or misconception details: noteTakerMessages, prompts.ts:65. parseNotes (pipeline.ts:84) caps notes at 3 × 300 characters and allowlists revisedBeliefIds.
- The reply's prompt is built only from pipView (notebook.ts:207), the move and MOVE_GUIDE. There's no assessor free text (moveNote was removed).
- Student text is wrapped in <student_message> tags with closing tags stripped (studentBlock, prompts.ts:48), and capped at 1,500 characters (MAX_TURN_TEXT, validate.ts:44).
- Pip's text is rendered as plain text: no markdown or HTML, so no links or images that could carry data out.
- Every session route checks login and ownership (requireApiUser; another user's session answers 404).
- The server owns the transcript: the browser can't write Pip's messages or the notebook (PUT only changes status, endedAt, reflection).
Tests:
- src/lib/learner/teachable/__tests__/assessorBoundary.test.ts:
  - adversarial values in every field
  - a fuzz test over 2,000 random inputs
  - an end-to-end test where a fake assessor stuffs the answer key into every field, checking the reply, the beliefs panel, progress, the review, the reply prompt and the stored state
- src/app/api/sessions/__tests__/turn.test.ts: the same attack through the real /turn route and database.
- Set D of the eval: live injection attacks on each call (eval/sets/safety.jsonl).
-->


## What's left, and what we accept

<!--
FACTS (known residual risks)
- An injected assessor can still mislabel ideas, pick bad moves, or hide a note by grading it unfaithful. It can't send key text.
- The note-taker obeyed 3 of 3 "write the real rule in your notes" injections in eval Set B. It wrote general calculus from its own knowledge, not answer-key text. Set D measures whether those notes survive the assessor's faithful check.
- Wrong-idea flags show the assessor's verdicts to students (a product decision).
- There's no rate limit on /turn yet.
-->

