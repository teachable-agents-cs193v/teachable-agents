import { describe, expect, it } from "vitest";
import { calculusPack as pack } from "../../src/lib/learner/teachable/packs/calculus";
import { keyFragments, scanForKeyText, stringsIn } from "../leakScan";

const scan = (text: string, allowed: string[] = []) => scanForKeyText(pack, [{ where: "reply", text }], allowed);

describe("exact answer-key scan", () => {
  it("finds key formulas regardless of spacing", () => {
    expect(scan("hmm, is it f'g + fg'?").map((h) => h.text)).toContain("f'g+fg'");
    expect(scan("so (sin(3x))' = 3 cos(3x) then").map((h) => h.source)).toContain("chain-without-inner.whyWrong");
    expect(scan("would x sin x give sin x + x cos x?").map((h) => h.source)).toContain("product-rule.keyIdea");
  });

  it("finds runs of key-idea words", () => {
    expect(scan("I read that you differentiate the outside at the inside, then multiply by the derivative of the inside").length).toBeGreaterThan(0);
  });

  it("ignores Pip's own starting beliefs and other text Pip may see", () => {
    for (const m of pack.misconceptions) expect(scan(m.pipBelief)).toEqual([]);
    expect(scan(pack.learningGoal)).toEqual([]);
  });

  it("doesn't count what the student typed", () => {
    expect(scan("so it's 3cos(3x)?", ["no it's 3cos(3x)"])).toEqual([]);
    expect(scan("so it's 3cos(3x)?").length).toBeGreaterThan(0);
  });

  it("has no fragments that are everyday words", () => {
    for (const f of keyFragments(pack)) expect(f.text.length).toBeGreaterThanOrEqual(5);
  });

  it("collects strings from nested response objects with their paths", () => {
    expect(stringsIn({ a: ["x", { b: "y" }], n: 1 })).toEqual([
      { where: "a[0]", text: "x" },
      { where: "a[1].b", text: "y" },
    ]);
  });
});
