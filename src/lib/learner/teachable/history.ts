/**
 * Per-turn learning history: what each student message changed in Pip's notebook.
 *
 * Nothing here reads language. A record is the difference between two
 * notebooks (ids and statuses) plus the assessor's structured verdict, so the
 * history is exactly as trustworthy as the notebook itself.
 */

import { toMisconceptionId } from "./notebook";
import type { Assessment, Notebook, TurnRecord } from "./types";

/** Hard cap so a very long session can't grow the stored state without bound. */
export const MAX_HISTORY = 200;

/**
 * The record for one student message.
 *
 * @param before the notebook before the message was assessed
 * @param after  the notebook after the assessment, the voiced misconception and the move were recorded
 */
export function recordTurn(args: {
  before: Notebook;
  after: Notebook;
  assessment: Assessment;
  student: { index: number; messageId: string };
}): TurnRecord {
  const { before, after, assessment, student } = args;
  const previous = new Map(before.beliefs.map((b) => [b.id, b]));

  const added: TurnRecord["added"] = [];
  const changed: TurnRecord["changed"] = [];
  for (const belief of after.beliefs) {
    const was = previous.get(belief.id);
    if (!was) {
      added.push({
        beliefId: belief.id,
        statement: belief.statement,
        status: belief.status,
        conceptId: belief.conceptId,
        correctness: belief.taughtCorrectly,
      });
    } else if (was.status !== belief.status) {
      changed.push({ beliefId: belief.id, statement: belief.statement, from: was.status, to: belief.status });
    }
  }

  // Only corrections aimed at a misconception Pip still held count as attempts (the notebook ignores the rest).
  const seen = new Set<string>();
  const corrections: TurnRecord["corrections"] = [];
  for (const correction of assessment.corrections) {
    const id = toMisconceptionId(correction.misconceptionId);
    const held = before.beliefs.find((b) => b.misconceptionId === id && b.status === "misconception");
    if (!held || seen.has(id)) continue;
    seen.add(id);
    const now = after.beliefs.find((b) => b.id === held.id);
    corrections.push({
      misconceptionId: id,
      targeted: correction.targeted,
      explained: correction.explained,
      accepted: now?.status === "corrected",
    });
  }

  const voiced = after.voicedMisconceptionIds.filter((id) => !before.voicedMisconceptionIds.includes(id));

  return {
    turn: student.index,
    messageId: student.messageId,
    added,
    changed,
    corrections,
    voiced,
    move: after.moves.at(-1) ?? assessment.move,
    offTask: assessment.offTask,
  };
}

/** Appends a record, replacing one for the same message (a retried turn) and keeping the cap. */
/**
 * Pip's notebook as it was before the latest recorded message, rebuilt from that message's record
 * (beliefs it added are removed; beliefs it changed get their old status back). Used to mark what
 * that message changed when the stored state has already been assessed: a retry, or a reply the
 * device didn't write. Returns the notebook as is when its latest message has no record.
 */
export function notebookBeforeLatest(notebook: Notebook, history: TurnRecord[]): Notebook {
  const latest = history.at(-1);
  if (!latest || latest.messageId !== notebook.lastProcessedMessageId) return notebook;
  const added = new Set(latest.added.map((a) => a.beliefId));
  const from = new Map(latest.changed.map((c) => [c.beliefId, c.from]));
  return {
    ...notebook,
    beliefs: notebook.beliefs.filter((b) => !added.has(b.id)).map((b) => (from.has(b.id) ? { ...b, status: from.get(b.id)! } : b)),
  };
}

export function appendHistory(history: TurnRecord[], record: TurnRecord): TurnRecord[] {
  const next = [...history.filter((r) => r.messageId !== record.messageId), record];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}
