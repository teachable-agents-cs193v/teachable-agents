/**
 * ============================ TRIFECTA BOUNDARY ============================
 *
 * The assessor is the one model call that sees sensitive data (the topic pack's
 * answer key and misconception details) while reading untrusted input (the
 * student's message, and notes paraphrased from it). A prompt-injected message
 * could try to make it copy the key into its output. So its output must not be
 * able to carry text to anything the student sees or to the reply model.
 *
 * This is enforced HERE, in code, not by the prompt. parseAssessorVerdict builds
 * a fresh object from the raw JSON, and every value in it is one of:
 * - a string from a fixed allowlist: concept ids and misconception ids from the
 *   topic pack, belief ids from the current notebook, MOVES, the correctness enum;
 * - a note index that exists in this turn's notes;
 * - a real boolean (`=== true` / `typeof === "boolean"`; "true" or 1 don't count).
 * Anything else is dropped or replaced by a fixed default. Unknown keys are
 * ignored, nested objects are never copied, and no string is passed through
 * unless it is exactly equal to an allowlisted value.
 *
 * It doesn't read language: it only compares values against sets.
 * ===========================================================================
 */

import { LlmError } from "./llm";
import { toMisconceptionId } from "./notebook";
import type { AssessorVerdict, Move, NoteGrade, Notebook, TaughtCorrectly, TopicPack } from "./types";
import { MOVES } from "./types";

export const CORRECTNESS: readonly TaughtCorrectly[] = ["correct", "incorrect", "partly", "unclear"];

const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];

/** The value itself if it's a string in `allowed`, else null. */
function allowed<T extends string>(v: unknown, allowed: ReadonlySet<T> | readonly T[]): T | null {
  if (typeof v !== "string") return null;
  const set: ReadonlySet<string> = Array.isArray(allowed) ? new Set(allowed) : (allowed as ReadonlySet<string>);
  return set.has(v) ? (v as T) : null;
}

/** Allowlisted strings from an array, deduplicated, in order. */
function allowedList(v: unknown, set: ReadonlySet<string>): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && set.has(x)))];
}

/** The ids the assessor may name, for this pack and this notebook. */
export function assessorAllowlist(pack: TopicPack, notebook: Notebook, noteCount: number) {
  const beliefIds = new Set(notebook.beliefs.map((b) => b.id));
  const misconceptionIds = new Set(pack.misconceptions.map((m) => m.id));
  return {
    conceptIds: new Set(pack.concepts.map((c) => c.id)),
    misconceptionIds,
    beliefIds,
    /** A move may be about a belief (by id) or a starting misconception (by misconception id). */
    moveTargets: new Set([...beliefIds, ...notebook.beliefs.flatMap((b) => (b.misconceptionId ? [b.misconceptionId] : []))]),
    noteCount,
  };
}

/**
 * The assessor's raw JSON → AssessorVerdict, containing only allowlisted values.
 * Throws (retryable) only if the raw value isn't a JSON object at all.
 */
export function parseAssessorVerdict(raw: unknown, ctx: { pack: TopicPack; notebook: Notebook; noteCount: number }): AssessorVerdict {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LlmError("assessor: not a JSON object", true);
  const r = raw as Record<string, unknown>;
  const allow = assessorAllowlist(ctx.pack, ctx.notebook, ctx.noteCount);

  const noteGrades: NoteGrade[] = [];
  for (const g of records(r.noteGrades)) {
    const index = g.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= allow.noteCount) continue;
    if (noteGrades.some((x) => x.index === index)) continue;
    noteGrades.push({
      index,
      conceptId: allowed(g.conceptId, allow.conceptIds),
      correctness: allowed(g.correctness, CORRECTNESS) ?? "unclear",
      explained: g.explained === true,
      // Not a boolean: keep the note (it's the note-taker's text, not the assessor's).
      faithful: typeof g.faithful === "boolean" ? g.faithful : true,
    });
  }

  const corrections: AssessorVerdict["corrections"] = [];
  for (const c of records(r.corrections)) {
    // Models sometimes write a misconception's belief id ("m:x"): map it, then it must be a pack id.
    const id = typeof c.misconceptionId === "string" ? allowed(toMisconceptionId(c.misconceptionId), allow.misconceptionIds) : null;
    if (!id || corrections.some((x) => x.misconceptionId === id)) continue;
    corrections.push({ misconceptionId: id, targeted: c.targeted === true, explained: c.explained === true });
  }

  return {
    noteGrades,
    corrections,
    nowExplainedBeliefIds: allowedList(r.nowExplainedBeliefIds, allow.beliefIds),
    offTask: r.offTask === true,
    move: allowed<Move>(r.move, MOVES) ?? "admit_confusion",
    moveTarget: allowed(r.moveTarget, allow.moveTargets),
    readyToWrapUp: r.readyToWrapUp === true,
  };
}
