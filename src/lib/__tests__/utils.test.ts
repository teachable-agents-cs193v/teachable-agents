import { afterEach, describe, expect, it, vi } from "vitest";
import { createId, formatDuration, summarizeSession } from "../utils";
import { buildSession } from "../sessions";
import type { ChatMessage } from "../types";

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, "role" | "text">): ChatMessage {
  return { id: Math.random().toString(36).slice(2), createdAt: "2026-01-01T00:00:00.000Z", ...partial };
}

describe("summarizeSession", () => {
  it("counts messages by role and dedupes concepts and misconceptions in order", () => {
    const session = {
      ...buildSession("independence-vs-mutual-exclusivity"),
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:12:30.000Z",
      messages: [
        msg({ role: "learner", text: "q1", kind: "opening", concept: "Definition" }),
        msg({ role: "student", text: "a1" }),
        msg({ role: "learner", text: "q2", kind: "misconception", misconception: "They can't co-occur" }),
        msg({ role: "student", text: "a2" }),
        msg({ role: "learner", text: "q3", kind: "question", concept: "Definition" }),
        msg({ role: "learner", text: "q4", kind: "question", concept: "Multiplication rule" }),
      ],
    };
    const summary = summarizeSession(session);
    expect(summary.studentMessages).toBe(2);
    expect(summary.learnerMessages).toBe(4);
    expect(summary.totalMessages).toBe(6);
    expect(summary.durationMinutes).toBe(13);
    expect(summary.concepts).toEqual(["Definition", "Multiplication rule"]);
    expect(summary.misconceptions).toEqual(["They can't co-occur"]);
  });

  it("reports no duration for an in-progress session", () => {
    expect(summarizeSession(buildSession("recursion")).durationMinutes).toBeNull();
  });

  it("ignores concept metadata on student messages", () => {
    const session = { ...buildSession("recursion"), messages: [msg({ role: "student", text: "x", concept: "sneaky" })] };
    expect(summarizeSession(session).concepts).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats edge cases readably", () => {
    expect(formatDuration(null)).toBe("In progress");
    expect(formatDuration(0)).toBe("Under a minute");
    expect(formatDuration(1)).toBe("1 minute");
    expect(formatDuration(7)).toBe("7 minutes");
  });
});

describe("createId (#19)", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  afterEach(() => vi.unstubAllGlobals());

  it("uses crypto.randomUUID when it exists", () => {
    expect(createId("msg")).toMatch(new RegExp(`^msg_${UUID_V4.source.slice(1)}`));
  });

  it("without randomUUID (plain HTTP), builds a v4 UUID from getRandomValues, not Math.random", () => {
    const random = vi.spyOn(Math, "random");
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("refuses to make an ID without a secure generator", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createId()).toThrow(/secure random/);
  });
});
