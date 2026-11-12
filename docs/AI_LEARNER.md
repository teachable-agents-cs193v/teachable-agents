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
4. `npm run dev`, then start a session on **Independence vs. Mutual Exclusivity**. The note under the teaching tips says "AI learner" when the model is answering.

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
- **The turn runs on the server.** `POST /api/sessions/[id]/turn` reads the transcript from the database and keeps the notebook in `teaching_sessions.learner_state`. The browser can't change the notebook, and `GET` never returns it.

## Files

| Path | What it is |
| --- | --- |
| `src/lib/learner/teachable/packs/` | Hidden answer keys per topic: concepts, Pip's starting misconceptions, what a real correction must address. **Human-reviewed; the assessor treats them as ground truth.** |
| `src/lib/learner/teachable/prompts.ts` | The assessor and Pip prompts. Most behavior changes happen here. |
| `src/lib/learner/teachable/notebook.ts` | Notebook state, invariants, and `pipView()` (what Pip may see). |
| `src/lib/learner/teachable/pipeline.ts` | One turn: assessor, update, reply. |
| `src/lib/learner/teachable/llm.ts` | OpenAI-compatible client. |
| `src/app/api/sessions/[id]/turn/route.ts` | The server route. |
| `eval/` | Live evaluation against the real model (below). |

## Adding a topic

Write a pack in `src/lib/learner/teachable/packs/` with the same shape as `probability.ts`, register it in `packs/index.ts`, and add scenarios for it in `eval/scenarios.ts`. A model can draft the pack, but a person must check every concept and misconception.

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
- 8,000 tokens a minute is about 1–2 Pip turns a minute per key. A class-size user test on one key will hit it. Use several keys or a paid tier for that.
