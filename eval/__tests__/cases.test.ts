import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTopicPack } from "../../src/lib/learner/teachable/packs";
import { buildNotebook, loadSet, resolveMessageCase, type AssessorCase, type NotesCase, type ScenarioCase } from "../cases";
import { renderCatalog } from "../sets/catalog.mjs";

describe("eval case files", () => {
  const A = loadSet("A") as AssessorCase[];
  const B = loadSet("B") as NotesCase[];
  const C = loadSet("C") as ScenarioCase[];
  const D = loadSet("D") as ScenarioCase[];

  it("load and validate, with the planned sizes", () => {
    const derivatives = (cs: { topicId: string }[]) => cs.filter((c) => c.topicId === "derivatives").length;
    expect(A.length).toBeGreaterThanOrEqual(40);
    expect(A.length).toBeLessThanOrEqual(60);
    expect(B.length).toBeGreaterThanOrEqual(25);
    expect(B.length).toBeLessThanOrEqual(40);
    expect(derivatives(C)).toBeGreaterThanOrEqual(15);
    expect(derivatives(C)).toBeLessThanOrEqual(25);
    expect(D.length).toBeGreaterThanOrEqual(15);
    expect(D.length).toBeLessThanOrEqual(25);
  });

  it("every single-message case resolves to a notebook, a conversation and a message", () => {
    for (const c of [...A, ...B]) {
      const r = resolveMessageCase(c);
      expect(r.student.length, c.id).toBeGreaterThan(0);
      // Every expected revised id is a taught belief in the notebook.
      const revised = "revised" in c.expect ? (c.expect.revised ?? []) : [];
      for (const id of revised) expect(r.notebook.beliefs.find((b) => b.id === id && b.source === "taught"), `${c.id}: ${id}`).toBeTruthy();
      // Voiced misconceptions are ones Pip still holds.
      for (const id of r.notebook.voicedMisconceptionIds) expect(r.notebook.beliefs.find((b) => b.misconceptionId === id)?.status).toBe("misconception");
    }
  });

  it("rebuilds a real session's notebook from its history", () => {
    const c = A.find((x) => x.id === "A-human-first-rule-wrong")!;
    const r = resolveMessageCase(c);
    expect(r.student).toBe("the first rule i taught was wrong");
    expect(r.notebook.studentTurns).toBe(6);
    expect(r.notebook.beliefs.filter((b) => b.source === "taught").map((b) => b.id)).toEqual(["t2-1", "t3-2", "t4-3"]);
    expect(r.conversation.filter((m) => m.role === "student")).toHaveLength(6);
  });

  it("buildNotebook marks voiced and corrected misconceptions and adds taught beliefs", () => {
    const pack = getTopicPack("derivatives")!;
    const nb = buildNotebook(pack, { voiced: ["exp-as-power"], corrected: ["chain-without-inner"], taught: [{ id: "t0-1", statement: "s", status: "heard" }] }, 1);
    expect(nb.voicedMisconceptionIds).toEqual(["exp-as-power"]);
    expect(nb.beliefs.find((b) => b.misconceptionId === "chain-without-inner")!.status).toBe("corrected");
    expect(nb.beliefs.at(-1)).toMatchObject({ id: "t0-1", source: "taught", evidence: [0] });
    expect(nb.moves).toEqual(["open", "ask_why"]);
  });

  it("eval/sets/CATALOG.md is up to date (npm run eval:catalog)", () => {
    expect(readFileSync(join(process.cwd(), "eval", "sets", "CATALOG.md"), "utf8")).toBe(renderCatalog());
  });
});
