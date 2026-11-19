import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentFacingError, studentMessage } from "../errors";
import { ScriptedLearnerAdapter } from "../learner";
import { SessionStoreError } from "../persistence";
import type { Topic } from "../types";

const FALLBACK = "Something went wrong. Please try again.";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("studentMessage (#22)", () => {
  it("shows a StudentFacingError's own message", () => {
    expect(studentMessage(new StudentFacingError("Pip is busy."), FALLBACK)).toBe("Pip is busy.");
  });

  it("shows the session store's friendly messages", () => {
    expect(studentMessage(new SessionStoreError(401), FALLBACK)).toBe(new SessionStoreError(401).message);
    expect(studentMessage(new SessionStoreError(500), FALLBACK)).toBe(new SessionStoreError(500).message);
  });

  it.each([
    ["a plain Error", new Error('relation "teaching_sessions" does not exist')],
    ["a TypeError", new TypeError("Cannot read properties of undefined (reading 'text')")],
    ["a thrown string", "Groq API key invalid"],
    ["undefined", undefined],
  ])("hides the details of %s behind the fallback", (_label, error) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(studentMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it("logs the hidden error to the console for debugging", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("internal detail");
    studentMessage(error, FALLBACK);
    expect(log).toHaveBeenCalledWith(error);
  });

  it("doesn't log student-facing errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    studentMessage(new SessionStoreError(0), FALLBACK);
    expect(log).not.toHaveBeenCalled();
  });

  it("hides the demo learner's internal error for an unscripted topic", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const topic = { id: "no-such-topic" } as Topic;
    const error = await new ScriptedLearnerAdapter().open({ topic, messages: [], cursor: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(studentMessage(error, FALLBACK)).toBe(FALLBACK);
  });
});
