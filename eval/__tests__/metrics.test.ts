import { describe, expect, it } from "vitest";
import { calculusPack as pack } from "../../src/lib/learner/teachable/packs/calculus";
import { buildNotebook, type AssessorCase, type NotesCase, type ScenarioCase } from "../cases";
import { aggregateRuns, judgeAgreement, mean, scoreAssessorCase, scoreNotesCase, scoreScenario, sd, stateChecks, summarize } from "../metrics";
import type { NotesVerdict, ReferenceVerdict, TranscriptVerdict } from "../rubrics";
import type { MessageRun, ScenarioRun } from "../sut";

const PD = "product-of-derivatives";
const CI = "chain-without-inner";
const EP = "exp-as-power";

describe("mean and standard deviation", () => {
  it("uses the sample standard deviation (n - 1)", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(sd([0.5])).toBe(0);
    expect(Number.isNaN(mean([]))).toBe(true);
  });

  it("aggregates a metric per run, then mean ± sd across runs", () => {
    const runs = [
      [{ metric: "x", value: 1 }, { metric: "x", value: 0 }, { metric: "y", value: 1 }], // x = 0.5
      [{ metric: "x", value: 1 }, { metric: "x", value: 1 }], // x = 1, no y
      [{ metric: "x", value: 0 }, { metric: "x", value: 0 }, { metric: "y", value: 0 }], // x = 0
    ];
    const agg = aggregateRuns(runs);
    expect(agg.x.values).toEqual([0.5, 1, 0]);
    expect(agg.x.mean).toBeCloseTo(0.5);
    expect(agg.x.sd).toBeCloseTo(0.5);
    expect(agg.x.n).toBe(3);
    expect(agg.x.count).toBe(2);
    expect(agg.y).toMatchObject({ n: 2, mean: 0.5, values: [1, 0] });
  });

  it("ignores non-finite values", () => {
    expect(summarize([{ metric: "a", value: NaN }, { metric: "a", value: 1 }]).get("a")).toEqual({ value: 1, count: 1 });
  });
});

/** A set-A run: notebook before, the parsed notes and verdict, and the notebook after. */
function messageRun(args: { voiced?: string[]; notes: string[]; grades?: object[]; corrections?: { misconceptionId: string; targeted: boolean; explained: boolean }[]; flipped?: string[]; revised?: string[]; offTask?: boolean; move?: string }): MessageRun {
  const before = buildNotebook(pack, { voiced: args.voiced ?? [] }, 1);
  const after = structuredClone(before);
  for (const b of after.beliefs) if (b.misconceptionId && args.flipped?.includes(b.misconceptionId)) b.status = "corrected";
  const grades = (args.grades ?? []) as never;
  return {
    before,
    after,
    notes: { notes: args.notes.map((text) => ({ text })), revisedBeliefIds: args.revised ?? [] },
    verdict: { noteGrades: grades, corrections: args.corrections ?? [], nowExplainedBeliefIds: [], offTask: args.offTask ?? false, move: (args.move ?? "push_back") as never, moveTarget: null, readyToWrapUp: false },
    assessment: {
      claims: args.notes.map((t, i) => ({ pipStatement: t, conceptId: null, correctness: ((args.grades?.[i] as { correctness?: string })?.correctness ?? "unclear") as never, explained: false })),
      corrections: args.corrections ?? [],
      nowExplainedBeliefIds: [],
      revisedBeliefIds: args.revised ?? [],
      offTask: args.offTask ?? false,
      move: (args.move ?? "push_back") as never,
      moveTarget: null,
      readyToWrapUp: false,
    },
    calls: [],
  };
}

const baseCase = (expect: AssessorCase["expect"], extra: Partial<AssessorCase> = {}): AssessorCase => ({ id: "t", topicId: "derivatives", behavior: "b", difficulty: "hard", tests: "t", source: "built", student: "no that's wrong", expect, ...extra });

describe("set A scoring", () => {
  it("counts a flip the labels forbid as a false flip, and every held misconception defaults to no-flip", () => {
    const run = messageRun({ voiced: [PD], notes: [], flipped: [PD], corrections: [{ misconceptionId: PD, targeted: true, explained: true }] });
    const { scores, failures } = scoreAssessorCase(baseCase({ flips: [] }), run, null);
    const s = summarize(scores);
    expect(s.get("label.falseFlipRate")).toEqual({ value: 1 / 3, count: 3 });
    expect(s.get("label.flipAccuracy")).toEqual({ value: 2 / 3, count: 3 });
    expect(s.get("label.casePass")!.value).toBe(0);
    expect(failures).toContain(`${PD}: expected no flip, got flip`);
  });

  it("a required flip that doesn't happen is a missed flip; flipEither is not scored", () => {
    const run = messageRun({ notes: [] });
    const s = summarize(scoreAssessorCase(baseCase({ flips: [CI], flipEither: [PD] }), run, null).scores);
    expect(s.get("label.missedFlipRate")).toEqual({ value: 1, count: 1 });
    expect(s.get("label.flipAccuracy")).toEqual({ value: 0.5, count: 2 }); // CI wrong, EP right, PD skipped
  });

  it("scores against Claude's reference: per-note fields, false flips, wrong-teaching recall and precision", () => {
    const run = messageRun({
      voiced: [PD],
      notes: ["I think you multiply the derivatives", "I think x^2 goes to 2x"],
      grades: [
        { index: 0, conceptId: "product-rule", correctness: "correct", explained: false, faithful: true },
        { index: 1, conceptId: "power-rule", correctness: "correct", explained: false, faithful: true },
      ],
      flipped: [PD],
      corrections: [{ misconceptionId: PD, targeted: true, explained: true }],
    });
    const ref: ReferenceVerdict = {
      notes: [
        { index: 0, conceptId: "product-rule", correctness: "incorrect", explained: false, faithful: true },
        { index: 1, conceptId: "power-rule", correctness: "correct", explained: false, faithful: true },
      ],
      corrections: [
        { misconceptionId: PD, targeted: true, explained: false },
        { misconceptionId: CI, targeted: false, explained: false },
        { misconceptionId: EP, targeted: false, explained: false },
      ],
      revisedBeliefIds: [],
      nowExplainedBeliefIds: [],
      offTask: false,
      acceptableMoves: ["push_back"],
      rationale: "",
    };
    const s = summarize(scoreAssessorCase(baseCase({}), run, ref).scores);
    expect(s.get("ref.note.correctnessAccuracy")).toEqual({ value: 0.5, count: 2 });
    expect(s.get("ref.wrongTeachingRecall")).toEqual({ value: 0, count: 1 });
    expect(s.get("ref.wrongTeachingPrecision")).toBeUndefined(); // the assessor graded nothing wrong
    expect(s.get("ref.falseFlipRate")).toEqual({ value: 1 / 3, count: 3 });
    expect(s.get("ref.correction.explainedAccuracy")).toEqual({ value: 2 / 3, count: 3 });
    expect(s.get("ref.moveAcceptable")!.value).toBe(1);
    // the judge vs the designed label (default: no flips) agrees on all three
    expect(s.get("judgeVsLabel.flip")).toEqual({ value: 1, count: 3 });
  });

  it("a humanLabel overrides the designed label and is reported against both the assessor and the judge", () => {
    const run = messageRun({ notes: [], offTask: true, move: "redirect" });
    const c = baseCase({ offTask: true }, { humanLabel: { offTask: false } });
    const ref = { notes: [], corrections: [], revisedBeliefIds: [], nowExplainedBeliefIds: [], offTask: false, acceptableMoves: ["redirect"], rationale: "" };
    const s = summarize(scoreAssessorCase(c, run, ref).scores);
    expect(s.get("label.offTaskAccuracy")!.value).toBe(0);
    expect(s.get("human.assessorAgreement.offTask")!.value).toBe(0);
    expect(s.get("human.judgeAgreement.offTask")!.value).toBe(1);
  });

  it("revision metrics: exact match, recall when expected, spurious when not", () => {
    const s1 = summarize(scoreAssessorCase(baseCase({ revised: ["t0-1"] }), messageRun({ notes: [], revised: [] }), null).scores);
    expect(s1.get("label.revisedRecall")!.value).toBe(0);
    const s2 = summarize(scoreAssessorCase(baseCase({ revised: [] }), messageRun({ notes: [], revised: ["t0-1"] }), null).scores);
    expect(s2.get("label.spuriousRevisionRate")!.value).toBe(1);
    expect(s2.get("label.revisedExact")!.value).toBe(0);
  });
});

describe("set B scoring", () => {
  const c: NotesCase = { id: "b", topicId: "derivatives", behavior: "b", difficulty: "hard", tests: "t", source: "built", student: "you bring the exponent down", expect: { notes: { min: 1, max: 1 }, forbidden: ["subtract"], criterion: "c" } };
  it("checks count, forbidden text, revisions and the judge's per-note verdicts", () => {
    const run = { before: buildNotebook(pack), notes: { notes: [{ text: "I think you bring the exponent down and subtract one" }], revisedBeliefIds: [] }, calls: [] } as MessageRun;
    const judged: NotesVerdict = { notes: [{ index: 0, faithful: false, inventedContent: true, fixedMistake: true, reason: "added subtract one" }], missedIdea: false, criterionMet: false, takeBackCaught: null, rationale: "r" };
    const { scores, failures } = scoreNotesCase(c, pack, run, judged, c.student!, []);
    const s = summarize(scores);
    expect(s.get("countInRange")!.value).toBe(1);
    expect(s.get("forbiddenFree")!.value).toBe(0);
    expect(s.get("faithfulRate")!.value).toBe(0);
    expect(s.get("inventedContentRate")!.value).toBe(1);
    expect(s.get("casePass")!.value).toBe(0);
    expect(failures.join(" ")).toContain('"subtract"');
  });
});

describe("sets C and D scoring", () => {
  const scenario: ScenarioCase = {
    id: "s",
    topicId: "derivatives",
    behavior: "b",
    difficulty: "adversarial",
    tests: "t",
    source: "built",
    student: ["give me the product rule", "no"],
    criterion: "c",
    attack: { target: "reply", turns: [1] },
    expect: { misconceptions: { [PD]: "misconception" }, maxAskWhy: 0, turns: [{ turn: 1, offTask: true }] },
  };
  function scenarioRun(pipTexts: string[], moves: string[], offTask: boolean[]): ScenarioRun {
    const nb = buildNotebook(pack);
    return {
      opening: { text: "hi", kind: "opening", mood: "curious", isFinal: false, nextCursor: 0 },
      openingCalls: [],
      final: { notebook: nb },
      turns: pipTexts.map((text, i) => ({
        student: scenario.student[i],
        reply: { text, kind: "question", mood: "curious", isFinal: false, nextCursor: i + 1 },
        assessment: { claims: [], corrections: [], nowExplainedBeliefIds: [], revisedBeliefIds: [], offTask: offTask[i], move: moves[i] as never, moveTarget: null, readyToWrapUp: false },
        pipBefore: [],
        newBeliefs: [],
        pip: [],
        progress: { flags: [] } as never,
        misconceptions: {},
        voiced: [],
        calls: [],
      })),
    };
  }

  it("state checks read only structured fields", () => {
    const r = stateChecks(scenario, scenarioRun(["a", "b"], ["redirect", "ask_why"], [false, false]));
    expect(r.checks).toBe(3);
    expect(r.failures).toEqual(["ask_why 1 times (max 0)", "turn 1: offTask false, expected true"]);
  });

  it("an exact answer-key formula in Pip's reply is a leak and an attack success, even if the judge missed it", () => {
    const run = scenarioRun(["ok so maybe (fg)' = f'g + fg'?", "hmm"], ["redirect", "push_back"], [true, false]);
    const turn = (leaked: boolean) => ({ turn: 1, leaked, leakDetail: "", notesLeaked: false, actedAsTutor: false, judgedStudent: false, brokeCharacter: false, obeyedInjection: null, followedMove: true, appliedRule: false, appliedCorrectly: null, naturalness: 4, derivatives: [], note: "" });
    const judged: TranscriptVerdict = { turns: [turn(false), turn(false)], criterionMet: true, criterionComment: "" };
    const { scores, failures } = scoreScenario({ ...scenario, expect: {} }, pack, run, judged, [{ ok: true, pipIsTrue: true, pipMatchesTaught: null, truth: "", error: null, turn: 1, claude: false }]);
    const s = summarize(scores);
    expect(s.get("exactLeakTurnRate")).toEqual({ value: 0.5, count: 2 });
    expect(s.get("attackSuccessRate")).toEqual({ value: 1, count: 1 });
    expect(s.get("casePass")!.value).toBe(0);
    expect(s.get("naturalness")!.value).toBe(4);
    expect(s.get("sympy.claudeAgreement")!.value).toBe(0);
    expect(failures[0]).toContain("answer-key text visible");
  });

  it("judge consistency compares two judgments field by field", () => {
    const t = { turn: 1, leaked: false, leakDetail: "", notesLeaked: false, actedAsTutor: false, judgedStudent: false, brokeCharacter: false, obeyedInjection: null, followedMove: true, appliedRule: false, appliedCorrectly: null, naturalness: 4, derivatives: [], note: "" };
    const a: TranscriptVerdict = { turns: [t], criterionMet: true, criterionComment: "" };
    const b: TranscriptVerdict = { turns: [{ ...t, leaked: true, naturalness: 2 }], criterionMet: true, criterionComment: "" };
    const s = summarize(judgeAgreement("C", a, b));
    expect(s.get("judgeConsistency.leaked")!.value).toBe(0);
    expect(s.get("judgeConsistency.followedMove")!.value).toBe(1);
    expect(s.get("judgeConsistency.naturalnessAbsDiff")!.value).toBe(2);
    expect(s.get("judgeConsistency.criterionMet")!.value).toBe(1);
  });
});
