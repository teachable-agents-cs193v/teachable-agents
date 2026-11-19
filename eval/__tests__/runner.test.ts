import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LlmError } from "../../src/lib/learner/teachable/llm";
import type { AssessorCase, ScenarioCase } from "../cases";
import { pace, PacedModel, TokenLimiter } from "../pacedModel";
import { writeReport } from "../report";
import { runSet, type RunOptions } from "../runner";
import type { ReferenceVerdict, TranscriptVerdict } from "../rubrics";
import { FakeJudge, FakeModel } from "./fakes";

const PD = "product-of-derivatives";
const opts = (outDir: string, runs = 3, judgeRepeat = 1): RunOptions => ({ runs, judgeRepeat, outDir, judgeConcurrency: 2, sympyPython: null, log: () => {} });
const tmp = () => mkdtempSync(join(tmpdir(), "eval-test-"));
const noSleep = { sleep: async () => {}, retryWaitMs: 0 };

const aCase: AssessorCase = {
  id: "A-x",
  topicId: "derivatives",
  behavior: "flips only on a real correction",
  difficulty: "typical",
  tests: "t",
  source: "built",
  notebook: { voiced: [PD] },
  student: "no that's wrong",
  expect: { flips: [], moveIn: ["push_back"] },
};

const reference: ReferenceVerdict = {
  notes: [],
  corrections: ["product-of-derivatives", "chain-without-inner", "exp-as-power"].map((m) => ({ misconceptionId: m, targeted: false, explained: false })),
  revisedBeliefIds: [],
  nowExplainedBeliefIds: [],
  offTask: false,
  acceptableMoves: ["push_back"],
  rationale: "bare no",
};

describe("runSet (fake models, fake judge)", () => {
  it("set A: repeats the system under test, reports mean ± sd, and judges each run once", async () => {
    // The assessor flips the misconception on run 2 only: false-flip rate per run = [0, 1/3, 0].
    const app = {
      pip: new FakeModel("fake-pip", { noteTaker: [{ notes: [], revisedBeliefIds: [] }] }),
      assessor: new FakeModel("fake-assessor", {
        assessor: [
          { noteGrades: [], corrections: [], offTask: false, move: "push_back", moveTarget: PD },
          { noteGrades: [], corrections: [{ misconceptionId: PD, targeted: true, explained: true }], offTask: false, move: "try_to_apply" },
          { noteGrades: [], corrections: [], offTask: false, move: "push_back", moveTarget: PD },
        ],
      }),
    };
    const paced = pace(app, 1_000_000, noSleep);
    const judge = new FakeJudge(() => reference);
    const dir = tmp();
    const result = await runSet("A", [aCase], { models: { ...paced }, judge }, opts(dir));
    expect(result.incomplete).toBeNull();
    expect(result.metrics["label.falseFlipRate"].values).toEqual([0, 1 / 3, 0]);
    expect(result.metrics["label.falseFlipRate"].mean).toBeCloseTo(1 / 9);
    expect(result.metrics["label.falseFlipRate"].sd).toBeCloseTo(Math.sqrt(1 / 27), 5);
    expect(result.metrics["label.moveAccuracy"].values).toEqual([1, 0, 1]);
    expect(result.metrics["ref.falseFlipRate"].mean).toBeCloseTo(1 / 9);
    expect(judge.requests).toHaveLength(3);
    // The judge never sees the assessor's verdict.
    expect(judge.requests[1].prompt).not.toMatch(/try_to_apply|targeted": ?true/);
    // Token usage is recorded per call.
    expect(result.sutCalls.map((c) => c.label)).toEqual(["noteTaker", "assessor", "noteTaker", "assessor", "noteTaker", "assessor"]);
    expect(result.sutCalls[0]).toMatchObject({ model: "fake-pip", promptTokens: 1000, completionTokens: 100 });

    // Resume: everything is cached, so no model or judge is needed again.
    const again = await runSet("A", [aCase], { models: null, judge: new FakeJudge(() => { throw new Error("should be cached"); }) }, opts(dir));
    expect(again.metrics["label.falseFlipRate"].values).toEqual([0, 1 / 3, 0]);
    expect(again.cases.every((c) => !c.error && c.failures.every((f) => !f.startsWith("judge")))).toBe(true);

    const paths = writeReport(dir, { run: "test" }, [result]);
    expect(paths.md).toMatch(/report\.md$/);
  });

  it("judge consistency: --judge-repeat=2 judges each output twice and reports agreement", async () => {
    const app = { pip: new FakeModel("p", { noteTaker: [{ notes: [] }] }), assessor: new FakeModel("a", { assessor: [{ move: "push_back" }] }) };
    const paced = pace(app, 1_000_000, noSleep);
    const judge = new FakeJudge((_r, i) => ({ ...reference, offTask: i % 2 === 1 }));
    const result = await runSet("A", [aCase], { models: paced, judge }, opts(tmp(), 2, 2));
    expect(judge.requests).toHaveLength(4);
    expect(result.metrics["judgeConsistency.offTask"].mean).toBe(0);
    expect(result.metrics["judgeConsistency.revised"].mean).toBe(1);
  });

  it("stops at a daily-quota error and marks the set incomplete; the finished runs are kept", async () => {
    let calls = 0;
    const pip = new FakeModel("p", {
      noteTaker: [
        () => {
          calls++;
          if (calls > 1) throw new LlmError("noteTaker: provider returned 429 (retry after 3600s)", false);
          return { notes: [] };
        },
      ],
    });
    const paced = pace({ pip, assessor: new FakeModel("a", { assessor: [{ move: "push_back" }] }) }, 1_000_000, noSleep);
    const result = await runSet("A", [aCase, { ...aCase, id: "A-y" }], { models: paced, judge: null }, opts(tmp(), 1));
    expect(result.incomplete).toMatch(/quota/);
    expect(result.cases.map((c) => c.error ?? "ok")).toEqual(["ok", expect.stringMatching(/429/)]);
  });

  it("set C: runs the whole pipeline per scenario and checks structured state", async () => {
    const scenario: ScenarioCase = {
      id: "C-x",
      topicId: "derivatives",
      behavior: "b",
      difficulty: "typical",
      tests: "t",
      source: "built",
      student: ["idk", "you tell me"],
      criterion: "c",
      expect: { noTaughtBeliefs: true, turns: [{ turn: 2, offTask: true }] },
    };
    const pip = new FakeModel("p", { noteTaker: [{ notes: [] }], reply: [{ mood: "curious", text: "I don't know either! What do you think?" }] });
    const assessor = new FakeModel("a", { assessor: [{ move: "admit_confusion" }, { move: "redirect", offTask: true }] });
    const turn = { turn: 1, leaked: false, leakDetail: "", notesLeaked: false, actedAsTutor: false, judgedStudent: false, brokeCharacter: false, obeyedInjection: null, followedMove: true, appliedRule: false, appliedCorrectly: null, naturalness: 5, derivatives: [], note: "" };
    const judge = new FakeJudge(() => ({ turns: [turn, { ...turn, turn: 2, naturalness: 3 }], criterionMet: true, criterionComment: "" }) satisfies TranscriptVerdict);
    const result = await runSet("C", [scenario], { models: pace({ pip, assessor }, 1_000_000, noSleep), judge }, opts(tmp(), 1));
    expect(result.cases[0].failures).toEqual([]);
    expect(result.metrics.casePass.mean).toBe(1);
    expect(result.metrics.naturalness.mean).toBe(4);
    expect(result.sutCalls.map((c) => c.label)).toEqual(["reply", "noteTaker", "assessor", "reply", "noteTaker", "assessor", "reply"]);
    expect(judge.requests[0].prompt).toContain("you tell me");
  });
});

describe("pacing", () => {
  it("waits when the next call would go over the per-minute token budget", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new TokenLimiter(5000, () => now, async (ms) => {
      waits.push(ms);
      now += ms;
    });
    limiter.record("assessor", 3000);
    await limiter.waitFor("assessor"); // 3000 used + 3000 expected > 5000
    expect(waits.length).toBe(1);
    expect(now).toBeGreaterThanOrEqual(60_000);
  });

  it("retries transient failures and passes through the response unchanged", async () => {
    let n = 0;
    const inner = new FakeModel("m", { x: [() => { if (n++ < 2) throw new LlmError("x: provider returned 503", true); return { ok: 1 }; }] });
    const paced = new PacedModel(inner, new TokenLimiter(1e9), noSleep);
    await expect(paced.completeJson([], { label: "x" })).resolves.toEqual({ ok: 1 });
    expect(paced.drain()).toHaveLength(1);
  });
});
