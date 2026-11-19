// AI use, enforced where the models are used: a session whose learner id doesn't allow AI (an
// old "pip-offline" test row, or anything unknown) never reaches a model, whatever models the
// server has configured. New sessions are always "pip".
import { describe, expect, it } from "vitest";
import { AI_LEARNER_ID, aiAllowed } from "@/lib/aiData";
import type { TeachingSession } from "@/lib/types";
import type { ChatTurn, JsonCallOptions, JsonModel } from "../llm";
import { deviceTurn, learnerTurn, modelsFor, SCRIPTED, TEACHABLE } from "../server";
import { assessorAnswer, noteTakerAnswer } from "./fakeTurns";

class RecordingModel implements JsonModel {
  readonly name = "recording";
  calls: { label: string; messages: ChatTurn[] }[] = [];
  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    this.calls.push({ label: options.label, messages });
    if (options.label === "noteTaker") return noteTakerAnswer();
    if (options.label === "assessor") return assessorAnswer();
    return { mood: "curious", text: "Fake Pip reply" };
  }
}

const session = (learnerId: string, messages: TeachingSession["messages"] = []): TeachingSession => ({
  id: "session_1",
  topicId: "independence-vs-mutual-exclusivity",
  learnerId,
  status: "in_progress",
  startedAt: "2026-11-19T10:00:00.000Z",
  messages,
  learnerCursor: messages.length ? 1 : 0,
});

const opened = (learnerId: string) =>
  session(learnerId, [
    { id: "l1", role: "learner", text: "Hi!", createdAt: "2026-11-19T10:00:01.000Z" },
    { id: "s1", role: "student", text: "Independent means one doesn't change the other.", createdAt: "2026-11-19T10:00:02.000Z" },
  ]);

/** Left over from testing the removed offline-demo choice; still readable, never AI. */
const NO_AI_ID = "pip-offline";

describe("the stored learner id", () => {
  it("only the AI id allows AI; unknown ids fail closed", () => {
    expect(aiAllowed(AI_LEARNER_ID)).toBe(true);
    // Sessions made before the choice existed were all "pip": they keep the AI learner.
    expect(aiAllowed("pip")).toBe(true);
    for (const id of [NO_AI_ID, "", "PIP", "pip ", "teachable", "anything-else"]) expect(aiAllowed(id)).toBe(false);
  });

  it("modelsFor hands out no models to a learner id that does not allow AI", () => {
    const model = new RecordingModel();
    const models = { assessor: model, pip: model };
    expect(modelsFor({ learnerId: NO_AI_ID }, models)).toBeNull();
    expect(modelsFor({ learnerId: AI_LEARNER_ID }, models)).toBe(models);
  });
});

describe("a session whose learner id does not allow AI", () => {
  it("never calls a model: the opening and every reply come from the scripted learner", async () => {
    const model = new RecordingModel();
    const models = { assessor: model, pip: model };
    const opening = await learnerTurn({ session: session(NO_AI_ID), storedState: null, models });
    const reply = await learnerTurn({ session: opened(NO_AI_ID), storedState: null, models });
    expect(opening.learner).toEqual(SCRIPTED);
    expect(reply.learner).toEqual(SCRIPTED);
    expect(reply.state).toBeNull();
    expect(model.calls).toHaveLength(0);
  });

  it("never prepares an on-device turn (that would call the assessor)", async () => {
    const model = new RecordingModel();
    const derivatives = { ...opened(NO_AI_ID), topicId: "derivatives" };
    expect(await deviceTurn({ session: derivatives, storedState: null, models: { assessor: model, pip: model } })).toBeNull();
    expect(model.calls).toHaveLength(0);
  });

  it("an AI session with the same models does call them (so the test above means something)", async () => {
    const model = new RecordingModel();
    const reply = await learnerTurn({ session: opened(AI_LEARNER_ID), storedState: null, models: { assessor: model, pip: model } });
    expect(reply.learner).toEqual(TEACHABLE);
    expect(model.calls.map((c) => c.label)).toEqual(["noteTaker", "assessor", "reply"]);
  });
});
