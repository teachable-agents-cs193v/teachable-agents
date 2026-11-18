import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../../types";
import type { ChatTurn, JsonCallOptions, JsonModel } from "../llm";
import { probabilityPack as pack } from "../packs/probability";
import { initialState, runTurn, sameModel, type TeachableState } from "../pipeline";
import { buildProgress, buildReview } from "../progress";
import { upgradeState } from "../server";

/** Fake model: answers from a queue keyed by call label (`options.label`). */
class FakeModel implements JsonModel {
  readonly name = "fake";
  constructor(private readonly answers: Record<string, unknown[]>) {}
  async completeJson(_messages: ChatTurn[], options: JsonCallOptions) {
    const queue = this.answers[options.label];
    if (!queue?.length) throw new Error(`no fake answer for ${options.label}`);
    return queue.shift();
  }
}

const VOICED = "independent-means-cannot-co-occur";
const SILENT = "same-source-means-dependent"; // never voiced in these sessions
const msg = (id: string, role: ChatMessage["role"]): ChatMessage => ({ id, role, text: "...", createdAt: "" });
const verdict = (over: Record<string, unknown> = {}) => ({
  analysis: "private reasoning",
  claims: [],
  corrections: [],
  nowExplainedBeliefIds: [], revisedBeliefIds: [],
  offTask: false,
  move: "ask_why",
  moveTarget: null,
  moveNote: "",
  readyToWrapUp: false,
  ...over,
});
const claim = (pipStatement: string, explained: boolean, correctness = "correct", conceptId: string | null = "independence-definition") => ({
  pipStatement,
  conceptId,
  correctness,
  explained,
});

/** Runs student messages through the pipeline, one assessor verdict each, after `earlier` already-answered messages. */
async function teach(verdicts: Record<string, unknown>[], start: TeachableState = initialState(pack), earlier = 0) {
  const model = new FakeModel({ assessor: [...verdicts], reply: verdicts.map(() => ({ mood: "curious", text: "Hm?" })) });
  let state = start;
  const messages: ChatMessage[] = [msg("l0", "learner")];
  for (let i = 0; i < earlier; i++) messages.push(msg(`old${i}`, "student"), msg(`oldl${i}`, "learner"));
  for (let i = 0; i < verdicts.length; i++) {
    messages.push(msg(`s${earlier + i}`, "student"));
    state = (await runTurn({ pack, state, messages, models: sameModel(model) })).state;
    messages.push(msg(`l${i + 1}`, "learner"));
  }
  return state;
}

/** A session: an asserted idea, Pip voices a misconception, a bare correction, a real one, a wrong idea, an off-task message. */
const session = () =>
  teach([
    verdict({ claims: [claim("Independent means no effect on each other.", false)], move: "voice_misconception", moveTarget: VOICED }),
    verdict({ corrections: [{ misconceptionId: VOICED, targeted: true, explained: false }], move: "push_back" }),
    verdict({
      claims: [claim("A coin and a die can both happen.", true, "correct", "independent-can-co-occur")],
      corrections: [{ misconceptionId: VOICED, targeted: true, explained: true }],
      nowExplainedBeliefIds: ["t0-1"],
    }),
    verdict({ claims: [claim("Exclusive events are independent.", false, "incorrect", null)], corrections: [{ misconceptionId: SILENT, targeted: false, explained: false }] }),
    verdict({ offTask: true, move: "redirect" }),
  ]);

describe("buildProgress (during the session)", () => {
  it("counts beliefs, explained vs asserted teaching, and misconception progress", async () => {
    const progress = buildProgress(await session());
    expect(progress.studentTurns).toBe(5);
    expect(progress.recordedFromTurn).toBe(0);
    expect(progress.beliefs).toEqual({ heard: 1, understood: 2, believes: 0, changed_mind: 1 });
    expect(progress.teaching).toEqual({ claims: 3, explained: 1, asserted: 2, explainedLater: 1 });
    expect(progress.misconceptions).toEqual([
      {
        id: `m:${VOICED}`,
        statement: expect.any(String),
        status: "changed_mind",
        voicedAtTurn: 0,
        changedAtTurn: 2,
        turnsToChange: 2,
        attempts: 2,
      },
    ]);
  });

  it("builds a timeline of visible changes, oldest first", async () => {
    const { timeline } = buildProgress(await session());
    expect(timeline.map((e) => e.turn)).toEqual([0, 2, 3]);
    expect(timeline[0].events.map((e) => e.type)).toEqual(["learned", "voiced"]);
    expect(timeline[1].events.map((e) => e.type).sort()).toEqual(["changed_mind", "explained", "learned"]);
    expect(timeline[2].events).toEqual([{ type: "learned", beliefId: "t3-3", statement: "Exclusive events are independent.", status: "heard" }]);
  });

  it("never reveals the answer key, correctness verdicts, or a misconception Pip hasn't voiced", async () => {
    const text = JSON.stringify(buildProgress(await session()));
    expect(text).not.toMatch(/correctness|incorrect|conceptId|misconceptionId|offTask|analysis|targeted/);
    expect(text).not.toContain(SILENT);
    for (const m of pack.misconceptions) {
      expect(text).not.toContain(m.whyWrong);
      expect(text).not.toContain(m.correctionMustAddress);
      expect(text).not.toContain(m.label);
    }
    for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions.filter((x) => x.id !== VOICED)) expect(text).not.toContain(m.pipBelief);
  });

  it("shows a misconception the student corrected before Pip voiced it, without a turn count", async () => {
    const state = await teach([verdict({ corrections: [{ misconceptionId: SILENT, targeted: true, explained: true }] })]);
    const progress = buildProgress(state);
    expect(progress.misconceptions).toEqual([
      expect.objectContaining({ id: `m:${SILENT}`, status: "changed_mind", voicedAtTurn: null, changedAtTurn: 0, turnsToChange: null, attempts: 1 }),
    ]);
    expect(progress.timeline).toEqual([{ turn: 0, events: [expect.objectContaining({ type: "changed_mind" })] }]);
  });

  it("is empty for a fresh session", () => {
    const progress = buildProgress(initialState(pack));
    expect(progress).toEqual({
      studentTurns: 0,
      recordedFromTurn: 0,
      beliefs: { heard: 0, understood: 0, believes: 0, changed_mind: 0 },
      teaching: { claims: 0, explained: 0, asserted: 0, explainedLater: 0 },
      misconceptions: [],
      timeline: [],
      flags: [],
      wrongTaught: [],
    });
  });

  it("flags the latest message: Pip voicing a wrong idea, or the student teaching one (never the right answer)", async () => {
    const state = await teach([
      verdict({ claims: [claim("Independent means they can't both happen.", false, "incorrect", null)], move: "voice_misconception", moveTarget: VOICED }),
    ]);
    const progress = buildProgress(state);
    expect(progress.flags).toEqual([
      { kind: "pip_wrong_idea", beliefId: `m:${VOICED}`, statement: expect.any(String) },
      { kind: "taught_wrong", beliefId: expect.any(String), statement: "Independent means they can't both happen.", verdict: "wrong" },
    ]);
    expect(progress.wrongTaught).toEqual([{ id: expect.any(String), statement: "Independent means they can't both happen.", turn: 0, verdict: "wrong", fixed: false }]);
    const text = JSON.stringify(progress);
    for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions) expect(text).not.toContain(m.whyWrong);
    // The next message with nothing wrong in it clears the flags, but the wrong idea stays listed.
    const next = buildProgress(await teach([verdict({ claims: [claim("Another idea.", false)] })], state, 1));
    expect(next.flags).toEqual([]);
    expect(next.wrongTaught).toHaveLength(1);
  });

  it("works for a session from before history was recorded", async () => {
    const before = await teach([verdict({ claims: [claim("Old idea.", true)], move: "voice_misconception", moveTarget: VOICED })]);
    const old = { notebook: before.notebook, last: before.last, lastAssessment: before.lastAssessment };
    const state = await teach([verdict({ claims: [claim("New idea.", false)] })], upgradeState(old, pack.topicId)!, 1);
    const progress = buildProgress(state);
    expect(progress.recordedFromTurn).toBe(1);
    expect(progress.misconceptions[0]).toMatchObject({ status: "believes", voicedAtTurn: null, attempts: 0 });
    expect(progress.beliefs).toMatchObject({ understood: 1, heard: 1, believes: 1 });
    expect(progress.teaching).toEqual({ claims: 1, explained: 0, asserted: 1, explainedLater: 0 });
    expect(progress.timeline.map((e) => e.turn)).toEqual([1]);

    // The review still lists the belief taught before the history began, without its first-taught detail.
    const review = buildReview(state, pack);
    expect(review.taught.map((t) => [t.statement, t.turn, t.explainedWhenTaught])).toEqual([
      ["Old idea.", 0, null],
      ["New idea.", 1, false],
    ]);
  });
});

describe("buildReview (after the session)", () => {
  it("lists every misconception with its outcome and attempts", async () => {
    const review = buildReview(await session(), pack);
    expect(review.metrics.misconceptions).toEqual({ total: 3, voiced: 1, corrected: 1, stillHeld: 2 });
    const voiced = review.misconceptions.find((m) => m.id === `m:${VOICED}`)!;
    expect(voiced).toMatchObject({
      label: "Independent events cannot happen at the same time",
      outcome: "corrected",
      voiced: true,
      voicedAtTurn: 0,
      correctedAtTurn: 2,
      turnsToCorrect: 2,
      attempts: [
        { turn: 1, targeted: true, explained: false, accepted: false },
        { turn: 2, targeted: true, explained: true, accepted: true },
      ],
    });
    expect(review.misconceptions.find((m) => m.id === `m:${SILENT}`)).toMatchObject({ outcome: "still_held", voiced: false, attempts: [{ turn: 3, targeted: false }] });
  });

  it("lists what was taught with the assessor's correctness verdicts", async () => {
    const review = buildReview(await session(), pack);
    expect(review.taught).toEqual([
      { id: "t0-1", statement: "Independent means no effect on each other.", turn: 0, status: "understood", explainedWhenTaught: false, correctness: "correct", concept: expect.any(String) },
      { id: "t2-2", statement: "A coin and a die can both happen.", turn: 2, status: "understood", explainedWhenTaught: true, correctness: "correct", concept: expect.any(String) },
      { id: "t3-3", statement: "Exclusive events are independent.", turn: 3, status: "heard", explainedWhenTaught: false, correctness: "incorrect", concept: null },
    ]);
    expect(review.metrics.correctness).toEqual({ correct: 2, incorrect: 1, partly: 0, unclear: 0 });
    expect(review.metrics.offTaskTurns).toBe(1);
    expect(review.metrics.beliefs).toEqual({ heard: 1, understood: 2, believes: 2, changed_mind: 1 });
    expect(review.timeline.find((e) => e.turn === 3)!.events[0]).toMatchObject({ type: "learned", correctness: "incorrect" });
  });

  it("never includes the answer key itself", async () => {
    const text = JSON.stringify(buildReview(await session(), pack));
    for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions) {
      expect(text).not.toContain(m.whyWrong);
      expect(text).not.toContain(m.correctionMustAddress);
    }
    expect(text).not.toContain("private reasoning");
  });
});
