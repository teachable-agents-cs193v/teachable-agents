import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../../types";
import type { ChatTurn, JsonCallOptions, JsonModel } from "../llm";
import { probabilityPack as pack } from "../packs/probability";
import { initialState, parseAssessment, runOpening, runTurn } from "../pipeline";

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

const goodAssessment = {
  analysis: "Targeted, explained correction.",
  claims: [{ pipStatement: "So independent events can happen together, like a coin and a die.", conceptId: "independent-can-co-occur", correctness: "correct", explained: true }],
  corrections: [{ misconceptionId: MISC, targeted: true, explained: true }],
  nowExplainedBeliefIds: [],
  offTask: false,
  move: "try_to_apply",
  moveTarget: null,
  moveNote: "Try it on two coin flips.",
  readyToWrapUp: false,
};

describe("runTurn", () => {
  it("never sends the answer key to the reply call", async () => {
    const model = new FakeModel({ assessor: [goodAssessment], reply: [{ mood: "thinking", text: "Okay, so two coins?" }] });
    const messages = [msg("l0", "learner", "Hi"), msg("s0", "student", "Independent events can totally happen together.")];
    await runTurn({ pack, state: initialState(pack), messages, model });

    const reply = JSON.stringify(model.calls.find((c) => c.label === "reply")!.messages);
    for (const c of pack.concepts) expect(reply).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions) {
      expect(reply).not.toContain(m.whyWrong);
      expect(reply).not.toContain(m.correctionMustAddress);
    }
    // The assessor, by contrast, does see it.
    const assessor = JSON.stringify(model.calls.find((c) => c.label === "assessor")!.messages);
    expect(assessor).toContain(pack.concepts[0].keyIdea);
  });

  it("updates the notebook and returns a reply in the UI's shape", async () => {
    const model = new FakeModel({ assessor: [goodAssessment], reply: [{ mood: "thinking", text: "Okay, so two coins?" }] });
    const messages = [msg("l0", "learner", "Hi"), msg("s0", "student", "...")];
    const { reply, state } = await runTurn({ pack, state: initialState(pack), messages, model });
    expect(reply).toMatchObject({ text: "Okay, so two coins?", kind: "question", mood: "thinking", isFinal: false, nextCursor: 1 });
    expect(state.notebook.beliefs.find((b) => b.misconceptionId === MISC)!.status).toBe("corrected");
    expect(state.notebook.moves).toEqual(["try_to_apply"]);
  });

  it("returns the cached reply when the same student message is retried", async () => {
    const model = new FakeModel({ assessor: [goodAssessment], reply: [{ mood: "curious", text: "One" }] });
    const messages = [msg("s0", "student", "hello")];
    const first = await runTurn({ pack, state: initialState(pack), messages, model });
    const again = await runTurn({ pack, state: first.state, messages, model });
    expect(again.reply).toEqual(first.reply);
    expect(model.calls).toHaveLength(2);
  });

  it("retries once when the reply comes back in the wrong shape", async () => {
    const model = new FakeModel({ assessor: [goodAssessment], reply: [{ nope: 1 }, { mood: "happy", text: "Second try" }] });
    const { reply } = await runTurn({ pack, state: initialState(pack), messages: [msg("s0", "student", "x")], model });
    expect(reply.text).toBe("Second try");
  });

  it("labels voiced misconceptions for the reflection page and remembers they were voiced", async () => {
    const assessment = { ...goodAssessment, claims: [], corrections: [], move: "voice_misconception", moveTarget: MISC };
    const model = new FakeModel({ assessor: [assessment], reply: [{ mood: "confused", text: "But can't they..." }] });
    const { reply, state } = await runTurn({ pack, state: initialState(pack), messages: [msg("s0", "student", "x")], model });
    expect(reply.kind).toBe("misconception");
    expect(reply.misconception).toBe("Independent events cannot happen at the same time");
    expect(state.notebook.voicedMisconceptionIds).toEqual([MISC]);
  });
});

describe("runOpening", () => {
  it("makes one call and caches the opening", async () => {
    const model = new FakeModel({ reply: [{ mood: "curious", text: "Hi! I'm Pip." }] });
    const first = await runOpening({ pack, state: initialState(pack), model });
    expect(first.reply.kind).toBe("opening");
    const again = await runOpening({ pack, state: first.state, model });
    expect(again.reply).toEqual(first.reply);
    expect(model.calls).toHaveLength(1);
  });
});

describe("parseAssessment", () => {
  it("coerces bad fields instead of trusting them", () => {
    const a = parseAssessment({ claims: [{ pipStatement: "x", correctness: "very" }, "junk"], move: "lecture", moveTarget: "null" });
    expect(a.claims).toEqual([{ pipStatement: "x", conceptId: null, correctness: "unclear", explained: false }]);
    expect(a.move).toBe("admit_confusion");
    expect(a.moveTarget).toBeNull();
  });
});
