// Ported from Anahi's A10 tests/unit/password-strength.test.mjs.
import { describe, expect, it } from "vitest";
import { MIN_SCORE, SCORE_LABELS, SITE_WORDS, checkStrength, userInputsFor } from "../passwordStrength";

describe("checkStrength", () => {
  it("requires a score of at least 3 out of 4", () => {
    expect(MIN_SCORE).toBe(3);
  });

  it("passes a long passphrase of unrelated words with no advice", () => {
    const r = checkStrength("lantern-quokka-marigold-zephyr", ["someuser"]);
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(MIN_SCORE);
    expect(r.label).toBe(SCORE_LABELS[r.score]);
    expect(r.suggestions).toEqual([]);
  });

  it("rejects weak passwords with a warning and suggestions", () => {
    const r = checkStrength("password", []);
    expect(r.ok).toBe(false);
    expect(r.label).toBe("Very weak");
    expect(r.warning).toMatch(/common password/);
    expect(r.suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("gives different, relevant advice for different weaknesses", () => {
    const l33t = checkStrength("P@ssw0rd", []);
    const seq = checkStrength("abcdefgh123", []);
    const rep = checkStrength("aaaaaaaaaa", []);
    const user = checkStrength("jordanlee7pw", ["jordanlee7"]);
    const year = checkStrength("johnsmith1990", []);
    expect(l33t.suggestions.some((s) => /substitutions/.test(s))).toBe(true);
    expect(l33t.suggestions.some((s) => /Capitalization/.test(s))).toBe(true);
    expect(seq.suggestions.some((s) => /sequences/.test(s))).toBe(true);
    expect(rep.suggestions.some((s) => /repeated/.test(s))).toBe(true);
    expect(user.suggestions.some((s) => /your name, your email address/.test(s))).toBe(true);
    // zxcvbn's own feedback doesn't mention the year here; ours does.
    expect(year.suggestions.some((s) => /dates and years/.test(s))).toBe(true);
    const all = [l33t, seq, rep, user].map((r) => JSON.stringify([r.warning, r.suggestions]));
    expect(new Set(all).size).toBe(all.length);
  });

  it("puts specific advice before general advice, without duplicates, at most 4", () => {
    for (const pw of ["P@ssw0rd", "abcdefgh123", "drowssap99", "Password1", "qwertyuiop"]) {
      const { suggestions } = checkStrength(pw, []);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(new Set(suggestions).size).toBe(suggestions.length);
      const general = suggestions.findIndex((s) => /^Add another word/.test(s));
      const tail = general === -1 ? [] : suggestions.slice(general);
      expect(tail.every((s) => /^(Add another word|Consider using a longer)/.test(s)), pw).toBe(true);
    }
  });

  it("never includes the password in its feedback", () => {
    for (const pw of ["Tr0ub4dor", "qwertyuiop", "johnsmith1990", "protegejordan"]) {
      const r = checkStrength(pw, ["jordan"]);
      expect(JSON.stringify(r).toLowerCase()).not.toContain(pw.toLowerCase());
      expect(Object.keys(r).sort()).toEqual(["label", "ok", "score", "suggestions", "warning"]);
    }
  });

  it("checks very long passwords quickly (zxcvbn sees at most 72 characters)", () => {
    const started = Date.now();
    checkStrength("x".repeat(5) + "lantern-quokka-marigold-zephyr-".repeat(8), []);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("userInputsFor", () => {
  it("includes the name, its parts, the email, its local part and the site words", () => {
    const inputs = userInputsFor({ name: "Jordan Lee", email: "jordan.lee@example.com" });
    expect(inputs).toEqual(
      expect.arrayContaining(["Jordan Lee", "JordanLee", "Jordan", "Lee", "jordan.lee@example.com", "jordan.lee", "jordan", "lee"]),
    );
    expect(inputs).toEqual(expect.arrayContaining(SITE_WORDS));
  });

  it("makes passwords built from the user's own details or the site name weaker", () => {
    const user = { name: "Jordan Lee", email: "jordan.lee@example.com" };
    expect(checkStrength("jordanlee2026!", userInputsFor(user)).ok).toBe(false);
    // Strong on its own; weak once the site name counts against it.
    expect(checkStrength("protege2026", []).ok).toBe(true);
    expect(checkStrength("protege2026", userInputsFor({})).ok).toBe(false);
  });

  it("copes with a missing name or email", () => {
    expect(userInputsFor({})).toEqual(SITE_WORDS);
  });
});
