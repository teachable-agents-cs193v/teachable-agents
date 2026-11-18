# AI evals: how to run them

Live evaluation of Pip's pipeline (note-taker → assessor → reply) on the app's real Groq models,
scored by code and by Claude. Not part of `npm test` or CI: it spends real quota.

| Set | What runs | Cases |
| --- | --- | --- |
| A | one message → real note-taker + assessor; per-field agreement with the case's labels and with Claude's reference | `sets/assessor.jsonl` |
| B | one message → real note-taker only; faithfulness of the notes | `sets/notes.jsonl` |
| C | multi-turn scripted students → full pipeline; Claude judges each transcript turn by turn, code checks structured state, sympy checks derivatives | `sets/conversations.jsonl` (+ `conversations-probability.jsonl`) |
| D | prompt-injection and leak attacks → full pipeline; exact answer-key scan of everything student-visible, plus Claude for paraphrased leaks | `sets/safety.jsonl` |

`sets/CATALOG.md` lists every case with its input and pass criterion. It is generated:
edit the jsonl files, then `npm run eval:catalog` (a unit test fails when it's stale).

## Requirements

- `.env.local` with `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (and optionally `LLM_MODEL_PIP`, `LLM_MODEL_ASSESSOR`), as for the app. `npm run eval` loads it.
- Claude Code installed and logged in (`claude` on PATH). The runner stops at once if it isn't.
- Optional, for the sympy cross-check in sets C/D:
  ```bash
  python3 -m venv eval/.venv && eval/.venv/bin/pip install sympy==1.14.0
  ```
  Without it the check is skipped and the report says `sympy cross-check: off`.

## Commands

```bash
npm run eval -- --set=A                 # one set
npm run eval -- --set=A,B,C,D           # all (the default)
npm run eval -- --set=C --runs=3        # repeat the system under test 3 times: mean ± sd per metric
npm run eval -- --set=A --judge-repeat=2  # judge each output twice: judge-consistency metrics
npm run eval -- --set=A --only=A-bare-no,A-fix-product-full
npm run eval -- --set=C --topic=probability   # the original probability scenarios (default: derivatives)
npm run eval -- --set=A --source=human        # only cases from real sessions (built | human | all)
npm run eval -- --set=B --limit=5             # first 5 cases
npm run eval -- --set=A --no-judge            # system under test + exact checks only, no Claude calls
npm run eval -- --set=A,B,C,D --runs=3 --resume          # continue the newest run (--resume=<run id> for another)
```

Other flags: `--tpm=7000` (token-per-minute budget per Groq model), `--judge-concurrency=3`.
The same settings work as env vars (`EVAL_SETS`, `EVAL_RUNS`, `EVAL_JUDGE_REPEAT`, `EVAL_ONLY`,
`EVAL_TOPIC`, `EVAL_SOURCE`, `EVAL_LIMIT`, `EVAL_RESUME`, `EVAL_TPM`, `EVAL_NO_JUDGE`,
`EVAL_JUDGE_CONCURRENCY`).

## Output

Each run writes `eval/results/<run id>/`:

- `report.md` and `report.json`: every metric as mean ± sample sd across runs (with n and the
  number of scored items), per-case results and failures, token usage per call label and model,
  and judge calls, tokens and cost. `report.json` also has each case's outputs and verdicts.
- `cache/<set>/<case>-<hash>/run<r>.sut.json` and `run<r>.judge<k>.json`: every completed
  system-under-test run and judgment. Rerunning with `--resume` reuses them, so a run cut off by a
  quota error continues where it stopped. Editing a case changes its hash, so it reruns.
- `options.json`: the options used.

`eval/results/` is gitignored except `eval/results/saved/`: copy a `report.md`/`report.json` there
to commit it.

## Quotas and pacing

Calls to Groq are paced under `--tpm` tokens per minute per model, retried on rate limits (65 s
waits), and a daily-quota error (429 with a long Retry-After) stops the run cleanly with a resume
command. Every call's prompt, cached and completion tokens are recorded.

Rough cost of one run of everything (Derivatives, 1 run, 1 judgment), assuming ~3k tokens per
note-taker/assessor call and ~2k per reply:

| | note-taker | assessor | reply | judge (Claude) |
| --- | --- | --- | --- | --- |
| A (60 cases) | 60 | 60 | – | 60 |
| B (33 cases) | 33 | – | – | 33 |
| C (20 scenarios, 48 turns) | 48 | 48 | 68 | 20 |
| D (21 attacks, 29 turns) | 29 | 29 | 50 | 21 |
| total | 170 calls | 137 calls | 118 calls | 134 calls |

That is about 420 Groq calls and 1.1–1.3M tokens per run: the `pip` model (note-taker and reply)
gets ~290 calls, the assessor model ~136. On the free tier (about 200k tokens a day on
`gpt-oss-120b`) a full run takes several days of quota per account, so run sets separately,
use `--runs` sparingly, and resume.

## How judging works (and why it is Claude only)

All model judging goes through `eval/claudeJudge.ts`, which spawns Claude Code headless:

```
claude -p --model claude-opus-5-5 --output-format json --json-schema <schema>
  --tools "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources ""
  --safe-mode --disable-slash-commands --no-session-persistence
  --permission-mode dontAsk --permission-prompts none --max-budget-usd 2
  --system-prompt <rubric>
```

with the case on stdin, from an empty temporary directory, and without the Groq key or database
settings in its environment. Before judging, one probe session (`--output-format stream-json`)
checks that the session's only tool is Claude Code's built-in `StructuredOutput` (added by
`--json-schema`), that no MCP server is connected and that the model is `claude-opus-5-5`, and the
run refuses to judge otherwise. Each result is rejected if it reports a permission denial, comes
from another model, or has no structured output.

`eval/__tests__/judgeEnforcement.test.ts` (part of `npm test`) fails if any file under `eval/`
builds a model client (`OpenAiCompatibleModel`, `llmConfigFromEnv`), calls a model API or SDK, or
starts `claude` anywhere but `claudeJudge.ts`. The systems under test still use the app's own
models from `modelsFromEnv()`.

The judge sees the answer key and transcripts. In set A it never sees the assessor's verdict, so
its reference is independent.

## Human labels

Any set-A case can carry a `humanLabel` (`offTask`, `flips: {misconceptionId: bool}`, `revised`,
`wrongTaught`, `note`). It overrides the case's designed `expect` field by field, and the report
adds `human.assessorAgreement.*` and `human.judgeAgreement.*`.

## Metric names

- A: `label.*` = against the case's labels (`falseFlipRate`, `missedFlipRate`, `flipAccuracy`,
  `offTaskAccuracy`, `wrongTeachingRecall`, `revisedExact`, `revisedRecall`,
  `spuriousRevisionRate`, `moveAccuracy`, `casePass`, `casePass@<difficulty>`, ...);
  `ref.*` = against Claude's reference (per-note `correctness/explained/faithful/concept`
  accuracy, per-misconception `targeted/explained` accuracy, `falseFlipRate`,
  `wrongTeachingRecall/Precision`, `revisedExact`, `offTaskAccuracy`, `moveAcceptable`);
  `judgeVsLabel.*` = Claude against the labels.
- B: `faithfulRate`, `inventedContentRate`, `fixedMistakeRate`, `missedIdeaRate`,
  `criterionMet`, `forbiddenFree`, `countInRange`, `revisedExact`, `takeBackRecall`,
  `spuriousRevisionRate`, `keyTextInNotesRate`, `casePass`.
- C/D: per turn `leakedRate`, `notesLeakedRate`, `actedAsTutorRate`, `judgedStudentRate`,
  `brokeCharacterRate`, `obeyedInjectionRate`, `followedMoveRate`, `appliedAsTaughtRate`,
  `naturalness` (1–5), `exactLeakTurnRate`; per scenario `stateCheckPass`, `criterionMet`,
  `casePass`; D adds `attackSuccessRate` (per attack turn); sympy adds `sympy.pipTrueRate`,
  `sympy.pipMatchesTaughtRate`, `sympy.claudeAgreement`, `sympy.parseFailRate`.
- `judgeConsistency.*` (with `--judge-repeat=2`): share of identical verdicts per field between
  two judgments of the same output.

## Tests

`npm test` runs the eval's unit tests with fake models and a fake judge (`eval/__tests__/`):
variance math, metric computation, the leak scan, case loading, resume from cache, the quota stop
and the judge enforcement.
