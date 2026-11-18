import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../../types";
import type { ChatTurn, JsonCallOptions, JsonModel } from "../llm";
import { appendHistory, MAX_HISTORY, notebookBeforeLatest, recordTurn } from "../history";
import { probabilityPack as pack } from "../packs/probability";
import { initialState, runOpening, runTurn, sameModel, type TeachableState } from "../pipeline";
import { upgradeState } from "../server";
import type { TurnRecord } from "../types";
import { turnAnswers, type FakeTurn } from "./fakeTurns";

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

const MISC = "independent-means-cannot-co-occur";
const OTHER = "exclusive-means-independent";
const msg = (id: string, role: ChatMessage["role"], text = "..."): ChatMessage => ({ id, role, text, createdAt: "" });
const reply = { mood: "curious", text: "Hmm?" };
const assessment = (over: FakeTurn = {}): FakeTurn => over;

/** Runs student messages through the pipeline, one note-taker and assessor answer each. */
async function teach(verdicts: FakeTurn[], start: TeachableState = initialState(pack)) {
  const model = new FakeModel({ ...turnAnswers(verdicts), reply: verdicts.map(() => reply) });
  let state = start;
  const messages: ChatMessage[] = [msg("l0", "learner")];
  for (let i = 0; i < verdicts.length; i++) {
    messages.push(msg(`s${i}`, "student"));
    state = (await runTurn({ pack, state, messages, models: sameModel(model) })).state;
    messages.push(msg(`l${i + 1}`, "learner"));
  }
  return state;
}

describe("learning history", () => {
  it("records one entry per student message from structured fields", async () => {
    const state = await teach([
      assessment({
        claims: [{ pipStatement: "Independent means no effect.", conceptId: "independence-definition", correctness: "correct", explained: false }],
        move: "voice_misconception",
        moveTarget: MISC,
      }),
      assessment({
        claims: [{ pipStatement: "A coin and a die can both happen.", conceptId: "independent-can-co-occur", correctness: "correct", explained: true }],
        corrections: [{ misconceptionId: MISC, targeted: true, explained: true }],
        nowExplainedBeliefIds: ["t0-1"],
        move: "try_to_apply",
      }),
    ]);

    expect(state.version).toBe(2);
    expect(state.historyFrom).toBe(0);
    expect(state.history).toHaveLength(2);
    const [first, second] = state.history;
    expect(first).toMatchObject<Partial<TurnRecord>>({
      turn: 0,
      messageId: "s0",
      added: [{ beliefId: "t0-1", statement: "Independent means no effect.", status: "heard", conceptId: "independence-definition", correctness: "correct" }],
      changed: [],
      corrections: [],
      voiced: [MISC],
      move: "voice_misconception",
    });
    expect(second.turn).toBe(1);
    expect(second.added).toEqual([expect.objectContaining({ status: "understood" })]);
    expect(second.changed).toEqual(
      expect.arrayContaining([
        { beliefId: `m:${MISC}`, statement: expect.any(String), from: "misconception", to: "corrected" },
        { beliefId: "t0-1", statement: "Independent means no effect.", from: "heard", to: "understood" },
      ]),
    );
    expect(second.corrections).toEqual([{ misconceptionId: MISC, targeted: true, explained: true, accepted: true }]);
    expect(second.voiced).toEqual([]);
  });

  it("records a bare correction as an attempt that wasn't accepted", async () => {
    const state = await teach([
      assessment({ corrections: [{ misconceptionId: `m:${MISC}`, targeted: true, explained: false }], move: "push_back" }),
    ]);
    expect(state.history[0].corrections).toEqual([{ misconceptionId: MISC, targeted: true, explained: false, accepted: false }]);
    expect(state.history[0].changed).toEqual([]);
  });

  it("ignores corrections of misconceptions Pip no longer holds, or that don't exist", async () => {
    const state = await teach([
      assessment({ corrections: [{ misconceptionId: MISC, targeted: true, explained: true }] }),
      assessment({ corrections: [{ misconceptionId: MISC, targeted: true, explained: true }, { misconceptionId: "made-up", targeted: true, explained: true }] }),
    ]);
    expect(state.history[0].corrections).toHaveLength(1);
    expect(state.history[1].corrections).toEqual([]);
  });

  it("records offTask straight from the assessor", async () => {
    const state = await teach([assessment({ offTask: true, move: "redirect" })]);
    expect(state.history[0]).toMatchObject({ offTask: true, move: "redirect" });
  });

  it("keeps the history through the opening and on a retried message", async () => {
    const model = new FakeModel({ reply: [reply] });
    const opened = (await runOpening({ pack, state: initialState(pack), models: sameModel(model) })).state;
    expect(opened.history).toEqual([]);
    const state = await teach([assessment()], opened);
    const again = await runTurn({ pack, state, messages: [msg("l0", "learner"), msg("s0", "student")], models: sameModel(new FakeModel({})) });
    expect(again.state.history).toHaveLength(1);
  });

  it("replaces a record for the same message and caps the length", () => {
    const record = (i: number): TurnRecord => ({ turn: i, messageId: `s${i}`, added: [], changed: [], corrections: [], voiced: [], move: "ask_why", offTask: false });
    expect(appendHistory([record(0)], { ...record(0), offTask: true })).toEqual([{ ...record(0), offTask: true }]);
    let history: TurnRecord[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++) history = appendHistory(history, record(i));
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].turn).toBe(5);
  });

  it("recordTurn only compares ids and statuses", () => {
    const before = initialState(pack).notebook;
    const after = { ...before, beliefs: before.beliefs.map((b) => (b.misconceptionId === OTHER ? { ...b, statement: "reworded" } : b)) };
    const none = { claims: [], corrections: [], nowExplainedBeliefIds: [], revisedBeliefIds: [], offTask: false, move: "ask_why" as const, moveTarget: null, readyToWrapUp: false };
    const r = recordTurn({ before, after, assessment: none, student: { index: 0, messageId: "s0" } });
    expect(r.changed).toEqual([]);
    expect(r.added).toEqual([]);
  });
});

describe("notebookBeforeLatest", () => {
  it("rebuilds the notebook before the latest message: its additions removed, its changes undone", async () => {
    const second = await teach([
      assessment({ claims: [{ pipStatement: "Idea one.", conceptId: null, correctness: "correct", explained: false }] }),
      assessment({ claims: [{ pipStatement: "Idea two.", conceptId: null, correctness: "correct", explained: false }], nowExplainedBeliefIds: ["t0-1"] }),
    ]);
    expect(second.notebook.beliefs.find((b) => b.id === "t0-1")!.status).toBe("understood");
    const before = notebookBeforeLatest(second.notebook, second.history);
    expect(before.beliefs.map((b) => [b.statement, b.status]).filter(([, s]) => s !== "misconception")).toEqual([["Idea one.", "heard"]]);
    // No record for the latest message: unchanged.
    expect(notebookBeforeLatest({ ...second.notebook, lastProcessedMessageId: "other" }, second.history)).toEqual({ ...second.notebook, lastProcessedMessageId: "other" });
  });
});

describe("upgradeState", () => {
  it("upgrades a version 1 state (no history) without losing the notebook", () => {
    const { notebook } = initialState(pack);
    const old = { notebook: { ...notebook, studentTurns: 4 }, last: null, lastAssessment: null };
    const upgraded = upgradeState(old, pack.topicId)!;
    expect(upgraded).toMatchObject({ version: 2, history: [], historyFrom: 4 });
    expect(upgraded.notebook.studentTurns).toBe(4);
  });

  it("keeps a current state as it is, and rejects other topics, unknown versions and junk", () => {
    const state = initialState(pack);
    expect(upgradeState(state, pack.topicId)).toBe(state);
    expect(upgradeState(state, "another-topic")).toBeNull();
    expect(upgradeState({ ...state, version: 3 }, pack.topicId)).toBeNull();
    expect(upgradeState({ ...state, history: "nope" }, pack.topicId)).toBeNull();
    expect(upgradeState(null, pack.topicId)).toBeNull();
    expect(upgradeState("x", pack.topicId)).toBeNull();
  });

  it("history continues after an upgrade, from the next message", async () => {
    const { notebook } = initialState(pack);
    const old = upgradeState({ notebook, last: null, lastAssessment: null }, pack.topicId)!;
    const state = await teach([assessment()], old);
    expect(state.history.map((r) => r.turn)).toEqual([0]);
  });
});
