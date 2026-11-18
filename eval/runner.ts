/**
 * Runs eval sets: the system under test (cached per case and run, so an interrupted run resumes),
 * then the judge (cached too), then scoring. Dependencies are injected, so the unit tests run
 * whole sets with fake models and a fake judge.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { packFor, resolveMessageCase, type AnyCase, type AssessorCase, type NotesCase, type ScenarioCase, type SetId } from "./cases";
import type { Judge, JudgeUsage } from "./claudeJudge";
import { aggregateRuns, judgeAgreement, scoreAssessorCase, scoreNotesCase, scoreScenario, type Score, type Stat } from "./metrics";
import { QuotaExhaustedError, type CallRecord } from "./pacedModel";
import { notesRequest, referenceRequest, transcriptRequest, type NotesVerdict, type ReferenceVerdict, type TranscriptVerdict } from "./rubrics";
import { runMessage, runScenario, type MessageRun, type ScenarioRun, type SutModels } from "./sut";
import { checkDerivatives, type SympyResult } from "./sympy";

export interface RunOptions {
  runs: number;
  /** Judgments per output: 2 re-judges the same outputs and reports judge consistency. */
  judgeRepeat: number;
  /** Directory for this run: cache/, report.md, report.json. */
  outDir: string;
  judgeConcurrency: number;
  /** Python with sympy, or null to skip the sympy cross-check. */
  sympyPython: string | null;
  log: (line: string) => void;
}

export interface CaseResult {
  set: SetId;
  id: string;
  behavior: string;
  difficulty: string;
  source: string;
  run: number;
  error?: string;
  scores: Score[];
  failures: string[];
  /** Compact output for the report: what the system did and what the judge said. */
  detail: Record<string, unknown>;
}

export interface SetResult {
  set: SetId;
  caseCount: number;
  runs: number;
  incomplete: string | null;
  metrics: Record<string, Stat>;
  cases: CaseResult[];
  sutCalls: Omit<CallRecord, "raw">[];
  judgeCalls: JudgeUsage[];
  sympy: "on" | "off";
}

const hashOf = (c: unknown) => createHash("sha1").update(JSON.stringify(c)).digest("hex").slice(0, 10);

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 1));
}

/** A tiny promise pool for judge calls, so the system under test keeps going while Claude judges. */
function pool(size: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= size) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

type Sut = { kind: "message"; run: MessageRun } | { kind: "scenario"; run: ScenarioRun };

export async function runSet(set: SetId, cases: AnyCase[], deps: { models: SutModels | null; judge: Judge | null }, options: RunOptions): Promise<SetResult> {
  const { log } = options;
  const limit = pool(options.judgeConcurrency);
  const results: CaseResult[] = [];
  const sutCalls: Omit<CallRecord, "raw">[] = [];
  const judgeCalls: JudgeUsage[] = [];
  let incomplete: string | null = null;
  const pending: Promise<void>[] = [];

  for (let r = 1; r <= options.runs; r++) {
    for (const c of cases) {
      const dir = join(options.outDir, "cache", set, `${c.id}-${hashOf(c)}`);
      const sutPath = join(dir, `run${r}.sut.json`);
      let sut = readJson<Sut>(sutPath);
      if (!sut) {
        if (incomplete || !deps.models) {
          results.push(base(set, c, r, { error: incomplete ? "not run (stopped early)" : "not run (no models)" }));
          continue;
        }
        try {
          log(`[${set}] run ${r} ${c.id}`);
          sut = await runSut(set, c, deps.models);
          writeJson(sutPath, sut);
        } catch (error) {
          if (error instanceof QuotaExhaustedError) {
            incomplete = error.message;
            log(`[${set}] STOPPED: ${error.message}`);
          }
          results.push(base(set, c, r, { error: (error as Error).message }));
          continue;
        }
      }
      sutCalls.push(...callsOf(sut));
      const result = base(set, c, r, {});
      results.push(result);
      pending.push(
        (async () => {
          const judgments: unknown[] = [];
          if (deps.judge) {
            for (let k = 1; k <= options.judgeRepeat; k++) {
              const jPath = join(dir, `run${r}.judge${k}.json`);
              let cached = readJson<{ value: unknown; usage: JudgeUsage }>(jPath);
              if (!cached) {
                try {
                  cached = await limit(() => deps.judge!.judge(judgeRequest(set, c, sut!)));
                  writeJson(jPath, cached);
                } catch (error) {
                  result.failures.push(`judge ${k}: ${(error as Error).message}`);
                  break;
                }
              }
              judgeCalls.push(cached.usage);
              judgments.push(cached.value);
            }
          }
          score(set, c, sut!, judgments, result, options.sympyPython);
        })(),
      );
    }
  }
  await Promise.all(pending);

  const byRun = Array.from({ length: options.runs }, (_, i) => results.filter((x) => x.run === i + 1 && !x.error).flatMap((x) => x.scores));
  return {
    set,
    caseCount: cases.length,
    runs: options.runs,
    incomplete,
    metrics: aggregateRuns(byRun),
    cases: results,
    sutCalls,
    judgeCalls,
    sympy: options.sympyPython ? "on" : "off",
  };
}

function base(set: SetId, c: AnyCase, run: number, extra: { error?: string }): CaseResult {
  return { set, id: c.id, behavior: c.behavior, difficulty: c.difficulty, source: c.source, run, scores: [], failures: [], detail: {}, ...extra };
}

async function runSut(set: SetId, c: AnyCase, models: SutModels): Promise<Sut> {
  if (set === "A" || set === "B") {
    const { pack, notebook, conversation, student } = resolveMessageCase(c as AssessorCase | NotesCase);
    return { kind: "message", run: await runMessage({ pack, notebook, conversation, student, models, noteTakerOnly: set === "B" }) };
  }
  return { kind: "scenario", run: await runScenario({ pack: packFor(c), student: (c as ScenarioCase).student, models }) };
}

function callsOf(sut: Sut): Omit<CallRecord, "raw">[] {
  return sut.kind === "message" ? sut.run.calls : [...sut.run.openingCalls, ...sut.run.turns.flatMap((t) => t.calls)];
}

function judgeRequest(set: SetId, c: AnyCase, sut: Sut) {
  if (set === "A" || set === "B") {
    const run = (sut as { run: MessageRun }).run;
    const { pack, conversation, student } = resolveMessageCase(c as AssessorCase);
    return set === "A"
      ? referenceRequest({ pack, notebook: run.before, conversation, student, notes: run.notes.notes, c: c as AssessorCase })
      : notesRequest({ pack, notebook: run.before, conversation, student, taken: run.notes, c: c as NotesCase });
  }
  return transcriptRequest({ pack: packFor(c), scenario: c as ScenarioCase, run: (sut as { run: ScenarioRun }).run });
}

function score(set: SetId, c: AnyCase, sut: Sut, judgments: unknown[], result: CaseResult, python: string | null) {
  const judged = judgments[0] ?? null;
  if (judgments.length >= 2) {
    for (let k = 1; k < judgments.length; k++) result.scores.push(...judgeAgreement(set === "D" ? "C" : (set as "A" | "B" | "C"), judgments[0], judgments[k]));
  }
  if (set === "A") {
    const run = (sut as { run: MessageRun }).run;
    const s = scoreAssessorCase(c as AssessorCase, run, judged as ReferenceVerdict | null);
    result.scores.push(...s.scores);
    result.failures.push(...s.failures);
    result.detail = {
      student: resolveMessageCase(c as AssessorCase).student,
      notes: run.notes,
      verdict: run.verdict,
      flipped: run.after!.beliefs.filter((b) => b.misconceptionId && b.status === "corrected" && run.before.beliefs.find((x) => x.id === b.id)?.status === "misconception").map((b) => b.misconceptionId),
      reference: judged,
    };
  } else if (set === "B") {
    const run = (sut as { run: MessageRun }).run;
    const { pack, conversation, student } = resolveMessageCase(c as NotesCase);
    const s = scoreNotesCase(c as NotesCase, pack, run, judged as NotesVerdict | null, student, conversation.filter((m) => m.role === "student").map((m) => m.text));
    result.scores.push(...s.scores);
    result.failures.push(...s.failures);
    result.detail = { student, notes: run.notes, judge: judged };
  } else {
    const run = (sut as { run: ScenarioRun }).run;
    const verdict = judged as TranscriptVerdict | null;
    let sympy: (SympyResult & { turn: number; claude: boolean })[] | null = null;
    if (python && verdict) {
      const items = verdict.turns.flatMap((t) => t.derivatives.map((d) => ({ turn: t.turn, claude: d.pipAnswerIsTrueDerivative, item: { function: d.function, pipAnswer: d.pipAnswer, asTaught: d.asTaughtAnswer } })));
      const checked = checkDerivatives(python, items.map((i) => i.item));
      sympy = checked.map((r, i) => ({ ...r, turn: items[i].turn, claude: items[i].claude }));
    }
    const s = scoreScenario(c as ScenarioCase, packFor(c), run, verdict, sympy);
    result.scores.push(...s.scores);
    result.failures.push(...s.failures);
    result.detail = {
      opening: run.opening.text,
      turns: run.turns.map((t, i) => ({
        student: t.student,
        pip: t.reply.text,
        move: t.assessment.move,
        moveTarget: t.assessment.moveTarget,
        offTask: t.assessment.offTask,
        newBeliefs: t.newBeliefs,
        misconceptions: t.misconceptions,
        flags: t.progress.flags.map((f) => f.kind),
        exactLeaks: s.leaks[i],
        judge: verdict?.turns[i] ?? null,
      })),
      criterion: verdict ? { met: verdict.criterionMet, comment: verdict.criterionComment } : null,
      sympy,
    };
  }
}
