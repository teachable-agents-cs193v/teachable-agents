import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../../types";
import type { ChatTurn, JsonCallOptions, JsonModel } from "../llm";
import { createNotebook } from "../notebook";
import { probabilityPack as pack } from "../packs/probability";
import { assessTurn, buildAssessment, initialState, parseNotes, replyFromServer, runOpening, runTurn, sameModel } from "../pipeline";
import { assessorAnswer, noteTakerAnswer, type FakeTurn } from "./fakeTurns";

/** Fake model: records every call and answers from a queue keyed by call label. */
class FakeModel implements JsonModel {
  readonly name = "fake";
  calls: { label: string; messages: ChatTurn[] }[] = [];
  constructor(private readonly answers: Record<string, unknown[]>) {}
  async completeJson(messages: ChatTurn[], options: JsonCallOptions) {
    this.calls.push({ label: options.label, messages });
    const queue = this.answers[options.label];
    if (!queue?.length) throw new Error(`no fake answer for ${options.label}`);
    return queue.shift();
  }
}

const msg = (id: string, role: ChatMessage["role"], text: string): ChatMessage => ({ id, role, text, createdAt: "" });
const MISC = "independent-means-cannot-co-occur";

const goodTurn: FakeTurn = {
  claims: [{ pipStatement: "So independent events can happen together, like a coin and a die.", conceptId: "independent-can-co-occur", correctness: "correct", explained: true }],
  corrections: [{ misconceptionId: MISC, targeted: true, explained: true }],
  move: "try_to_apply",
};
const answers = (turn: FakeTurn, reply: unknown[]) => ({ noteTaker: [noteTakerAnswer(turn)], assessor: [assessorAnswer(turn)], reply });

describe("runTurn", () => {
  it("runs note-taker, assessor, reply, in that order, each on its role's model", async () => {
    const assessor = new FakeModel({ assessor: [assessorAnswer(goodTurn)] });
    const pip = new FakeModel({ noteTaker: [noteTakerAnswer(goodTurn)], reply: [{ mood: "thinking", text: "Okay, so two coins?" }] });
    await runTurn({ pack, state: initialState(pack), messages: [msg("s0", "student", "x")], models: { assessor, pip } });
    expect(assessor.calls.map((c) => c.label)).toEqual(["assessor"]);
    expect(pip.calls.map((c) => c.label)).toEqual(["noteTaker", "reply"]);
  });

  it("never sends the answer key to the note-taker or the reply call", async () => {
    const model = new FakeModel(answers(goodTurn, [{ mood: "thinking", text: "Okay, so two coins?" }]));
    const messages = [msg("l0", "learner", "Hi"), msg("s0", "student", "Independent events can totally happen together.")];
    await runTurn({ pack, state: initialState(pack), messages, models: sameModel(model) });

    for (const label of ["noteTaker", "reply"]) {
      const prompt = JSON.stringify(model.calls.find((c) => c.label === label)!.messages);
      for (const c of pack.concepts) expect(prompt).not.toContain(c.keyIdea);
      for (const m of pack.misconceptions) {
        expect(prompt).not.toContain(m.whyWrong);
        expect(prompt).not.toContain(m.correctionMustAddress);
      }
    }
    // The note-taker doesn't even see Pip's starting misconceptions before Pip has said them.
    const noteTaker = JSON.stringify(model.calls.find((c) => c.label === "noteTaker")!.messages);
    for (const m of pack.misconceptions) expect(noteTaker).not.toContain(m.pipBelief);
    // The assessor, by contrast, sees the key, and gets the notes by index.
    const assessor = JSON.stringify(model.calls.find((c) => c.label === "assessor")!.messages);
    expect(assessor).toContain(pack.concepts[0].keyIdea);
    expect(assessor).toContain('[0] \\"So independent events can happen together, like a coin and a die.\\"');
  });

  it("updates the notebook from the notes and grades, and returns a reply in the UI's shape", async () => {
    const model = new FakeModel(answers(goodTurn, [{ mood: "thinking", text: "Okay, so two coins?" }]));
    const messages = [msg("l0", "learner", "Hi"), msg("s0", "student", "...")];
    const { reply, state } = await runTurn({ pack, state: initialState(pack), messages, models: sameModel(model) });
    expect(reply).toMatchObject({ text: "Okay, so two coins?", kind: "question", mood: "thinking", isFinal: false, nextCursor: 1 });
    expect(state.notebook.beliefs.find((b) => b.misconceptionId === MISC)!.status).toBe("corrected");
    expect(state.notebook.beliefs.find((b) => b.source === "taught")).toMatchObject({
      statement: "So independent events can happen together, like a coin and a die.",
      status: "understood",
      conceptId: "independent-can-co-occur",
      taughtCorrectly: "correct",
    });
    expect(state.notebook.moves).toEqual(["try_to_apply"]);
  });

  it("returns the cached reply when the same student message is retried", async () => {
    const model = new FakeModel(answers(goodTurn, [{ mood: "curious", text: "One" }]));
    const messages = [msg("s0", "student", "hello")];
    const first = await runTurn({ pack, state: initialState(pack), messages, models: sameModel(model) });
    const again = await runTurn({ pack, state: first.state, messages, models: sameModel(model) });
    expect(again.reply).toEqual(first.reply);
    expect(model.calls).toHaveLength(3);
  });

  it("doesn't take notes or assess again when only the reply failed", async () => {
    const model = new FakeModel(answers(goodTurn, []));
    const messages = [msg("s0", "student", "hello")];
    const state = initialState(pack);
    // The reply fails after the message was assessed (the device flow saves this pending state).
    const assessed = await assessTurn({ pack, state, messages, models: sameModel(model) });
    await expect(replyFromServer({ pack, assessed, messages, models: sameModel(model) })).rejects.toThrow();
    const retried = new FakeModel({ reply: [{ mood: "curious", text: "Second time" }] });
    const { reply } = await runTurn({ pack, state: assessed.state, messages, models: sameModel(retried) });
    expect(reply.text).toBe("Second time");
    expect(retried.calls.map((c) => c.label)).toEqual(["reply"]);
  });

  it("retries once when the reply comes back in the wrong shape", async () => {
    const model = new FakeModel(answers(goodTurn, [{ nope: 1 }, { mood: "happy", text: "Second try" }]));
    const { reply } = await runTurn({ pack, state: initialState(pack), messages: [msg("s0", "student", "x")], models: sameModel(model) });
    expect(reply.text).toBe("Second try");
  });

  it("labels voiced misconceptions for the reflection page and remembers they were voiced", async () => {
    const turn = { move: "voice_misconception", moveTarget: MISC };
    const model = new FakeModel(answers(turn, [{ mood: "confused", text: "But can't they..." }]));
    const { reply, state } = await runTurn({ pack, state: initialState(pack), messages: [msg("s0", "student", "x")], models: sameModel(model) });
    expect(reply.kind).toBe("misconception");
    expect(reply.misconception).toBe("Independent events cannot happen at the same time");
    expect(state.notebook.voicedMisconceptionIds).toEqual([MISC]);
    // The reply is told the move and the target belief's statement, from the notebook.
    const user = model.calls.find((c) => c.label === "reply")!.messages[1].content;
    expect(user).toContain("YOUR MOVE THIS TURN: voice_misconception");
    expect(user).toContain(pack.misconceptions[0].pipBelief);
  });
});

describe("runOpening", () => {
  it("makes one call and caches the opening", async () => {
    const model = new FakeModel({ reply: [{ mood: "curious", text: "Hi! I'm Pip." }] });
    const first = await runOpening({ pack, state: initialState(pack), models: sameModel(model) });
    expect(first.reply.kind).toBe("opening");
    const again = await runOpening({ pack, state: first.state, models: sameModel(model) });
    expect(again.reply).toEqual(first.reply);
    expect(model.calls).toHaveLength(1);
  });
});

describe("parseNotes", () => {
  it("keeps up to 3 non-empty notes, trimmed and capped, and only taught belief ids", () => {
    const nb = createNotebook(pack);
    const withTaught = { ...nb, beliefs: [...nb.beliefs, { ...nb.beliefs[0], id: "t0-1", source: "taught" as const, status: "heard" as const, misconceptionId: null }] };
    const parsed = parseNotes(
      { notes: [{ text: "  a  " }, "junk", { text: "" }, { text: 5 }, { text: "b" }, { text: "c" }, { text: "d" }, { text: "x".repeat(400) }], revisedBeliefIds: ["t0-1", `m:${MISC}`, "t9-9", 3, "t0-1"], extra: "ignored" },
      withTaught,
    );
    expect(parsed).toEqual({ notes: [{ text: "a" }, { text: "b" }, { text: "c" }], revisedBeliefIds: ["t0-1"] });
    expect(parseNotes({ notes: [{ text: "x".repeat(400) }] }, nb).notes[0].text).toHaveLength(300);
    expect(() => parseNotes("nope", nb)).toThrow();
  });
});

describe("buildAssessment", () => {
  const verdict = { noteGrades: [], corrections: [], nowExplainedBeliefIds: [], offTask: false, move: "ask_why" as const, moveTarget: null, readyToWrapUp: false };
  it("drops unfaithful notes, and keeps ungraded ones as unclear and not explained", () => {
    const a = buildAssessment(
      { notes: [{ text: "graded" }, { text: "unfaithful" }, { text: "ungraded" }], revisedBeliefIds: ["t0-1"] },
      {
        ...verdict,
        noteGrades: [
          { index: 0, conceptId: "independence-definition", correctness: "incorrect", explained: true, faithful: true },
          { index: 1, conceptId: null, correctness: "correct", explained: true, faithful: false },
        ],
      },
    );
    expect(a.claims).toEqual([
      { pipStatement: "graded", conceptId: "independence-definition", correctness: "incorrect", explained: true },
      { pipStatement: "ungraded", conceptId: null, correctness: "unclear", explained: false },
    ]);
    expect(a.revisedBeliefIds).toEqual(["t0-1"]);
    expect(Object.keys(a).sort()).toEqual(["claims", "corrections", "moveTarget", "move", "nowExplainedBeliefIds", "offTask", "readyToWrapUp", "revisedBeliefIds"].sort());
  });
});
