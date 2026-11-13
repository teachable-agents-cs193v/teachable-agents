/**
 * Pip's notebook: the only knowledge Pip's reply call is allowed to use.
 *
 * Nothing in this file reads language. The assessor model makes every
 * judgment; this code records its structured verdicts, enforces a few
 * invariants on those fields, and decides what Pip is allowed to see.
 */

import type { Assessment, Belief, BeliefStatus, Move, Notebook, TopicPack } from "./types";
import { MOVES } from "./types";

/** Hard cap so a long session can't grow the prompt without bound. */
export const MAX_BELIEFS = 40;

const misconceptionBeliefId = (misconceptionId: string) => `m:${misconceptionId}`;

/** Models sometimes echo a misconception's belief id ("m:x") where its misconception id ("x") is wanted. */
export const toMisconceptionId = (id: string) => id.replace(/^m:/, "");

/** A fresh notebook: Pip starts out holding the topic's misconceptions and nothing else. */
export function createNotebook(pack: TopicPack): Notebook {
  return {
    version: 1,
    topicId: pack.topicId,
    beliefs: pack.misconceptions.map((m) => ({
      id: misconceptionBeliefId(m.id),
      statement: m.pipBelief,
      source: "prior_misconception",
      status: "misconception",
      conceptId: m.conceptId,
      misconceptionId: m.id,
      taughtCorrectly: null,
      evidence: [],
    })),
    voicedMisconceptionIds: [],
    moves: [],
    studentTurns: 0,
    lastProcessedMessageId: null,
  };
}

/** Misconceptions Pip still believes. */
export function activeMisconceptions(notebook: Notebook): Belief[] {
  return notebook.beliefs.filter((b) => b.status === "misconception");
}

/**
 * Records the assessor's verdict on one student message.
 *
 * Invariants enforced here (on structured fields only):
 * - A misconception flips to `corrected` only when the assessor marked the
 *   correction both targeted and explained. Bare "that's wrong" never flips it.
 * - Concept and misconception ids must exist in the topic pack.
 * - The move must be a known move, and its target must exist.
 */
export function applyAssessment(
  notebook: Notebook,
  assessment: Assessment,
  pack: TopicPack,
  student: { index: number; messageId: string },
): { notebook: Notebook; assessment: Assessment } {
  const conceptIds = new Set(pack.concepts.map((c) => c.id));
  let beliefs = notebook.beliefs.map((b) => ({ ...b, evidence: [...b.evidence] }));

  for (const correction of assessment.corrections) {
    const belief = beliefs.find((b) => b.misconceptionId === toMisconceptionId(correction.misconceptionId));
    if (!belief || belief.status !== "misconception") continue;
    belief.evidence.push(student.index);
    if (correction.targeted && correction.explained) belief.status = "corrected";
  }

  for (const id of assessment.nowExplainedBeliefIds) {
    const belief = beliefs.find((b) => b.id === id);
    if (belief && belief.source === "taught" && belief.status === "heard") {
      belief.status = "understood";
      belief.evidence.push(student.index);
    }
  }

  let next = beliefs.filter((b) => b.source === "taught").length;
  for (const claim of assessment.claims) {
    next += 1;
    beliefs.push({
      id: `t${student.index}-${next}`,
      statement: claim.pipStatement,
      source: "taught",
      status: claim.explained ? "understood" : "heard",
      conceptId: claim.conceptId && conceptIds.has(claim.conceptId) ? claim.conceptId : null,
      misconceptionId: null,
      taughtCorrectly: claim.correctness,
      evidence: [student.index],
    });
  }

  // Keep prior misconceptions; drop the oldest taught beliefs past the cap.
  if (beliefs.length > MAX_BELIEFS) {
    const priors = beliefs.filter((b) => b.source === "prior_misconception");
    const taught = beliefs.filter((b) => b.source === "taught");
    beliefs = [...priors, ...taught.slice(taught.length - (MAX_BELIEFS - priors.length))];
  }

  const updated: Notebook = {
    ...notebook,
    beliefs,
    studentTurns: notebook.studentTurns + 1,
    lastProcessedMessageId: student.messageId,
  };
  return { notebook: updated, assessment: sanitizeMove(assessment, updated) };
}

/**
 * Keeps the assessor's chosen move consistent with the notebook's state.
 * This never reinterprets what was said; it only fixes ids and states that
 * don't line up (e.g. "voice a misconception" that's already been corrected).
 */
export function sanitizeMove(assessment: Assessment, notebook: Notebook): Assessment {
  let move: Move = (MOVES as readonly string[]).includes(assessment.move) ? assessment.move : "admit_confusion";
  let moveTarget = assessment.moveTarget;
  const target = notebook.beliefs.find((b) => b.id === moveTarget || b.misconceptionId === moveTarget);
  if (!target) moveTarget = null;

  if (move === "voice_misconception") {
    const valid = target && target.status === "misconception";
    if (!valid) {
      const fallback = activeMisconceptions(notebook).find(
        (b) => !notebook.voicedMisconceptionIds.includes(b.misconceptionId!),
      );
      if (fallback) {
        moveTarget = fallback.misconceptionId;
      } else {
        move = "ask_for_example";
        moveTarget = null;
      }
    } else {
      moveTarget = target.misconceptionId;
    }
  }
  if (move === "open") move = "admit_confusion";
  return { ...assessment, move, moveTarget };
}

/** Marks a misconception as said out loud, after Pip's reply used it. */
export function recordVoiced(notebook: Notebook, misconceptionId: string | null): Notebook {
  if (!misconceptionId || notebook.voicedMisconceptionIds.includes(misconceptionId)) return notebook;
  return { ...notebook, voicedMisconceptionIds: [...notebook.voicedMisconceptionIds, misconceptionId] };
}

/** Records the move Pip just made. */
export function recordMove(notebook: Notebook, move: Move): Notebook {
  return { ...notebook, moves: [...notebook.moves, move] };
}

/* ---------------------------- What Pip sees ----------------------------- */

const PIP_STATUS: Record<BeliefStatus, string> = {
  heard: "my teacher told me this, but I don't really get why yet",
  understood: "I understand this and why it's true",
  misconception: "I believe this (nobody has told me otherwise)",
  corrected: "I USED TO think this, but my teacher showed me it's wrong",
};

export interface PipBelief {
  id: string;
  statement: string;
  howSure: string;
}

/**
 * The notebook as Pip may see it: statements and how sure Pip is.
 * Correctness verdicts, concept ids and the answer key are stripped out.
 */
export function pipView(notebook: Notebook): PipBelief[] {
  return notebook.beliefs.map((b) => ({ id: b.id, statement: b.statement, howSure: PIP_STATUS[b.status] }));
}
