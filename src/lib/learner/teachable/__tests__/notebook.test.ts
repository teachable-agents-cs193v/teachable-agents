import { describe, expect, it } from "vitest";
import { applyAssessment, createNotebook, MAX_BELIEFS, pipView, recordVoiced, sanitizeMove } from "../notebook";
import { probabilityPack as pack } from "../packs/probability";
import type { Assessment } from "../types";

const MISC = "independent-means-cannot-co-occur";

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    analysis: "",
    claims: [],
    corrections: [],
    nowExplainedBeliefIds: [],
    offTask: false,
    move: "ask_why",
    moveTarget: null,
    moveNote: "",
    readyToWrapUp: false,
    ...overrides,
  };
}

const student = (index: number) => ({ index, messageId: `msg_${index}` });

describe("createNotebook", () => {
  it("starts with only the topic's misconceptions", () => {
    const nb = createNotebook(pack);
    expect(nb.beliefs).toHaveLength(pack.misconceptions.length);
    expect(nb.beliefs.every((b) => b.status === "misconception" && b.source === "prior_misconception")).toBe(true);
    expect(nb.studentTurns).toBe(0);
  });
});

describe("applyAssessment", () => {
  it("records claims as heard or understood depending on whether they were explained", () => {
    const { notebook } = applyAssessment(
      createNotebook(pack),
      assessment({
        claims: [
          { pipStatement: "A", conceptId: "independence-definition", correctness: "correct", explained: false },
          { pipStatement: "B", conceptId: "not-a-real-concept", correctness: "incorrect", explained: true },
        ],
      }),
      pack,
      student(0),
    );
    const taught = notebook.beliefs.filter((b) => b.source === "taught");
    expect(taught.map((b) => [b.statement, b.status, b.conceptId, b.taughtCorrectly])).toEqual([
      ["A", "heard", "independence-definition", "correct"],
      ["B", "understood", null, "incorrect"],
    ]);
    expect(notebook.studentTurns).toBe(1);
    expect(notebook.lastProcessedMessageId).toBe("msg_0");
  });

  it("does not flip a misconception on a correction that isn't targeted and explained", () => {
    for (const c of [
      { targeted: false, explained: true },
      { targeted: true, explained: false },
      { targeted: false, explained: false },
    ]) {
      const { notebook } = applyAssessment(
        createNotebook(pack),
        assessment({ corrections: [{ misconceptionId: MISC, ...c }] }),
        pack,
        student(0),
      );
      expect(notebook.beliefs.find((b) => b.misconceptionId === MISC)!.status).toBe("misconception");
    }
  });

  it("flips a misconception on a targeted, explained correction", () => {
    const { notebook } = applyAssessment(
      createNotebook(pack),
      assessment({ corrections: [{ misconceptionId: MISC, targeted: true, explained: true }] }),
      pack,
      student(3),
    );
    const belief = notebook.beliefs.find((b) => b.misconceptionId === MISC)!;
    expect(belief.status).toBe("corrected");
    expect(belief.evidence).toEqual([3]);
  });

  it("accepts a misconception's belief id where its misconception id is expected", () => {
    const { notebook } = applyAssessment(
      createNotebook(pack),
      assessment({ corrections: [{ misconceptionId: "m:" + MISC, targeted: true, explained: true }] }),
      pack,
      student(0),
    );
    expect(notebook.beliefs.find((b) => b.misconceptionId === MISC)!.status).toBe("corrected");
  });

  it("upgrades a heard belief to understood when the assessor says it's now explained", () => {
    const first = applyAssessment(
      createNotebook(pack),
      assessment({ claims: [{ pipStatement: "A", conceptId: null, correctness: "correct", explained: false }] }),
      pack,
      student(0),
    ).notebook;
    const id = first.beliefs.find((b) => b.source === "taught")!.id;
    const { notebook } = applyAssessment(first, assessment({ nowExplainedBeliefIds: [id, "m:" + MISC] }), pack, student(1));
    expect(notebook.beliefs.find((b) => b.id === id)!.status).toBe("understood");
    // Prior misconceptions can't be "explained" into understood.
    expect(notebook.beliefs.find((b) => b.misconceptionId === MISC)!.status).toBe("misconception");
  });

  it("caps taught beliefs but always keeps prior misconceptions", () => {
    let nb = createNotebook(pack);
    for (let i = 0; i < 30; i++) {
      nb = applyAssessment(
        nb,
        assessment({
          claims: [0, 1].map((j) => ({ pipStatement: `${i}.${j}`, conceptId: null, correctness: "correct" as const, explained: false })),
        }),
        pack,
        student(i),
      ).notebook;
    }
    expect(nb.beliefs).toHaveLength(MAX_BELIEFS);
    expect(nb.beliefs.filter((b) => b.source === "prior_misconception")).toHaveLength(pack.misconceptions.length);
    expect(nb.beliefs.at(-1)!.statement).toBe("29.1");
    expect(new Set(nb.beliefs.map((b) => b.id)).size).toBe(MAX_BELIEFS);
  });
});

describe("sanitizeMove", () => {
  it("replaces an unknown move", () => {
    const a = sanitizeMove(assessment({ move: "explain_answer" as never }), createNotebook(pack));
    expect(a.move).toBe("admit_confusion");
  });

  it("points voice_misconception at an unvoiced active misconception when the target is invalid", () => {
    const nb = recordVoiced(createNotebook(pack), pack.misconceptions[0].id);
    const a = sanitizeMove(assessment({ move: "voice_misconception", moveTarget: "nonsense" }), nb);
    expect(a.moveTarget).toBe(pack.misconceptions[1].id);
  });

  it("falls back to asking for an example when no misconception is left", () => {
    let nb = createNotebook(pack);
    nb = { ...nb, beliefs: nb.beliefs.map((b) => ({ ...b, status: "corrected" as const })) };
    const a = sanitizeMove(assessment({ move: "voice_misconception", moveTarget: MISC }), nb);
    expect([a.move, a.moveTarget]).toEqual(["ask_for_example", null]);
  });
});

describe("pipView", () => {
  it("hides correctness verdicts, concept ids and the answer key", () => {
    const { notebook } = applyAssessment(
      createNotebook(pack),
      assessment({ claims: [{ pipStatement: "A", conceptId: "independence-definition", correctness: "incorrect", explained: true }] }),
      pack,
      student(0),
    );
    const text = JSON.stringify(pipView(notebook));
    expect(text).not.toMatch(/incorrect|independence-definition|conceptId|taughtCorrectly/);
    for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions) expect(text).not.toContain(m.whyWrong);
  });
});
