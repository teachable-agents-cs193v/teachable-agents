import { describe, expect, it } from "vitest";
import { ScriptedLearnerAdapter } from "../learner/scriptedLearner";
import { getScript } from "../scripts";
import { TOPICS, getTopic } from "../topics";
import type { ChatMessage } from "../types";

const adapter = new ScriptedLearnerAdapter({ minDelayMs: 0, maxDelayMs: 0 });
const probability = getTopic("independence-vs-mutual-exclusivity")!;

function studentMessage(text: string): ChatMessage {
  return { id: `m-${text}`, role: "student", text, createdAt: new Date().toISOString() };
}

describe("ScriptedLearnerAdapter", () => {
  it("has a script for every topic in the library", () => {
    for (const topic of TOPICS) {
      expect(getScript(topic.id), `missing script for ${topic.id}`).toBeDefined();
    }
  });

  it("opens with the first scripted step and advances the cursor", async () => {
    const reply = await adapter.open({ topic: probability, messages: [], cursor: 0 });
    expect(reply.kind).toBe("opening");
    expect(reply.text).toMatch(/independent/i);
    expect(reply.nextCursor).toBe(1);
    expect(reply.isFinal).toBe(false);
  });

  it("walks the script in order regardless of what the student says", async () => {
    const script = getScript(probability.id)!;
    let cursor = 1;
    const seen: string[] = [];
    for (const text of ["Not exactly.", "Sure, coin and die.", "zzz", "", "anything at all"]) {
      const reply = await adapter.respond({
        topic: probability,
        messages: [studentMessage(text)],
        cursor,
        studentMessage: text,
      });
      seen.push(reply.text);
      cursor = reply.nextCursor;
    }
    expect(seen).toEqual(script.steps.slice(1, 6).map((s) => s.text));
  });

  it("carries concept and misconception metadata from the script", async () => {
    const reply = await adapter.respond({ topic: probability, messages: [], cursor: 1 });
    expect(reply.kind).toBe("misconception");
    expect(reply.misconception).toContain("cannot happen at the same time");
  });

  it("flags the last scripted step as final and then repeats a closing line", async () => {
    const script = getScript(probability.id)!;
    const last = await adapter.respond({ topic: probability, messages: [], cursor: script.steps.length - 1 });
    expect(last.isFinal).toBe(true);
    expect(last.nextCursor).toBe(script.steps.length);

    const exhausted = await adapter.respond({ topic: probability, messages: [], cursor: script.steps.length });
    expect(exhausted.isFinal).toBe(true);
    expect(exhausted.text).toBe(script.exhaustedReply);
    expect(exhausted.nextCursor).toBe(script.steps.length);
  });

  it("rejects topics without a script instead of improvising", async () => {
    const bogus = { ...probability, id: "does-not-exist" };
    await expect(adapter.open({ topic: bogus, messages: [], cursor: 0 })).rejects.toThrow(/No scripted conversation/);
  });
});
