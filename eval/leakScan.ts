/**
 * Exact leak scan (eval code only; the app itself never does this). Looks for answer-key text
 * (the pack's keyIdea, whyWrong and correctionMustAddress strings) in anything a student can see.
 *
 * Two kinds of fragment are taken from each key string:
 * - word runs: every run of WORDS consecutive words, compared after lowercasing and collapsing spaces;
 * - formulas: each clause (split at ; : , and ". ") and each side of an "=" in it that has a
 *   formula character (^ ' / = ( +), compared with all whitespace removed, e.g. "f'g+fg'" or "3cos(3x)".
 * A fragment doesn't count when it also appears in text the student may already see by design
 * (Pip's starting beliefs, the learning goal, Pip's background) or in what the student typed.
 */

import type { TopicPack } from "../src/lib/learner/teachable/types";

export const WORDS = 6;
const MIN_FORMULA = 5;

export interface KeyFragment {
  kind: "words" | "formula";
  /** Normalized text that is searched for. */
  text: string;
  /** Where it comes from, e.g. "product-rule.keyIdea". */
  source: string;
}

export interface LeakHit extends KeyFragment {
  /** Where it was found, e.g. "reply" or "pip[2].statement". */
  where: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const compact = (s: string) => norm(s).replace(/\s+/g, "");
const words = (s: string) => norm(s).replace(/[.,;:!?"]+(?=\s|$)/g, "").split(" ").filter(Boolean);

export function keyStrings(pack: TopicPack): { source: string; text: string }[] {
  return [
    ...pack.concepts.map((c) => ({ source: `${c.id}.keyIdea`, text: c.keyIdea })),
    ...pack.misconceptions.flatMap((m) => [
      { source: `${m.id}.whyWrong`, text: m.whyWrong },
      { source: `${m.id}.correctionMustAddress`, text: m.correctionMustAddress },
    ]),
  ];
}

/** Text Pip or the student may see by design: never counted as a leak. */
export function safePackText(pack: TopicPack): string[] {
  return [pack.learningGoal, ...pack.priorKnowledge, ...pack.misconceptions.map((m) => m.pipBelief), ...pack.misconceptions.map((m) => m.label), ...pack.concepts.map((c) => c.label)];
}

export function keyFragments(pack: TopicPack, allowed: string[] = []): KeyFragment[] {
  const allowedWords = norm(words(allowed.join(" \n ")).join(" "));
  const allowedCompact = allowed.map(compact).join("\n");
  const out = new Map<string, KeyFragment>();
  for (const { source, text } of keyStrings(pack)) {
    const w = words(text);
    for (let i = 0; i + WORDS <= w.length; i++) {
      const frag = w.slice(i, i + WORDS).join(" ");
      if (!allowedWords.includes(frag)) out.set(`w:${frag}`, { kind: "words", text: frag, source });
    }
    for (const clause of text.split(/[;:,]|\.\s/)) {
      for (const part of [clause, ...clause.split("=")]) {
        const c = compact(part).replace(/^[.(]+$/, "").replace(/[.]+$/, "");
        if (c.length < MIN_FORMULA || !/[\^'/=(+]/.test(c)) continue;
        if (/^[a-z]+$/.test(c.replace(/['^/=]/g, "")) && c.length > 20) continue; // a sentence with an apostrophe, not a formula
        if (!allowedCompact.includes(c)) out.set(`f:${c}`, { kind: "formula", text: c, source });
      }
    }
  }
  return [...out.values()];
}

/** Every key fragment found in the given student-visible texts. */
export function scanForKeyText(pack: TopicPack, visible: { where: string; text: string }[], allowed: string[] = []): LeakHit[] {
  const fragments = keyFragments(pack, [...safePackText(pack), ...allowed]);
  const hits: LeakHit[] = [];
  for (const v of visible) {
    const w = words(v.text).join(" ");
    const c = compact(v.text);
    for (const f of fragments) {
      if (f.kind === "words" ? w.includes(f.text) : c.includes(f.text)) hits.push({ ...f, where: v.where });
    }
  }
  return hits;
}

/** All strings inside a JSON value, with their paths: for scanning whole response objects. */
export function stringsIn(value: unknown, path = ""): { where: string; text: string }[] {
  if (typeof value === "string") return [{ where: path || "value", text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => stringsIn(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => stringsIn(v, path ? `${path}.${k}` : k));
  return [];
}
