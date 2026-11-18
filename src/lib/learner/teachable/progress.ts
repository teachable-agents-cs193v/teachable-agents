/**
 * Learning metrics for the student: a live view during the session and a
 * fuller review once it's over.
 *
 * Everything is counted from structured fields (notebook statuses and the
 * per-turn history, which records the assessor's verdicts). Nothing here reads
 * what the student or Pip said; statements are only passed through for display.
 */

import type {
  LearningFlag,
  LearningProgress,
  LearningReview,
  ProgressMisconception,
  ReviewMisconception,
  ReviewTaught,
  StudentBelief,
  TaughtCorrectness,
  TeachingCounts,
  TimelineEntry,
  TimelineEvent,
} from "../../types";
import { studentView, toStudentStatus, visibleToStudent } from "./notebook";
import type { TeachableState } from "./pipeline";
import type { Belief, Notebook, TopicPack, TurnRecord } from "./types";

const emptyStatusCounts = (): Record<StudentBelief["status"], number> => ({ heard: 0, understood: 0, believes: 0, changed_mind: 0 });

function countStatuses(statuses: StudentBelief["status"][]) {
  const counts = emptyStatusCounts();
  for (const s of statuses) counts[s] += 1;
  return counts;
}

/** Explained vs just asserted, from the assessor's `explained` verdicts as recorded in the history. */
function teachingCounts(history: TurnRecord[]): TeachingCounts {
  const added = history.flatMap((r) => r.added);
  const explained = added.filter((a) => a.status === "understood").length;
  const explainedLater = history.flatMap((r) => r.changed).filter((c) => c.from === "heard" && c.to === "understood").length;
  return { claims: added.length, explained, asserted: added.length - explained, explainedLater };
}

/** When a starting misconception was voiced and corrected, from the history. */
function misconceptionTurns(belief: Belief, history: TurnRecord[]) {
  const id = belief.misconceptionId;
  const voicedAtTurn = history.find((r) => id !== null && r.voiced.includes(id))?.turn ?? null;
  const correctedAtTurn = history.find((r) => r.changed.some((c) => c.beliefId === belief.id && c.to === "corrected"))?.turn ?? null;
  const turnsBetween = voicedAtTurn !== null && correctedAtTurn !== null && correctedAtTurn >= voicedAtTurn ? correctedAtTurn - voicedAtTurn : null;
  return { voicedAtTurn, correctedAtTurn, turnsBetween };
}

/**
 * The history as a timeline. `show` decides which starting misconceptions may
 * appear; taught beliefs always may. With `withCorrectness`, `learned` events
 * carry the assessor's hidden verdict (only after the session).
 */
function buildTimeline(
  history: TurnRecord[],
  notebook: Notebook,
  show: (belief: Belief) => boolean,
  withCorrectness: boolean,
): TimelineEntry[] {
  const byMisconception = new Map(notebook.beliefs.filter((b) => b.misconceptionId).map((b) => [b.misconceptionId!, b]));
  const byId = new Map(notebook.beliefs.map((b) => [b.id, b]));
  const entries: TimelineEntry[] = [];
  for (const record of history) {
    const events: TimelineEvent[] = [];
    for (const a of record.added) {
      if (a.status !== "heard" && a.status !== "understood") continue;
      events.push({
        type: "learned",
        beliefId: a.beliefId,
        statement: a.statement,
        status: a.status,
        ...(withCorrectness && a.correctness ? { correctness: a.correctness } : {}),
      });
    }
    for (const c of record.changed) {
      if (c.from === "heard" && c.to === "understood") {
        events.push({ type: "explained", beliefId: c.beliefId, statement: c.statement });
      } else if (c.from === "misconception" && c.to === "corrected") {
        const belief = byId.get(c.beliefId);
        if (belief && show(belief)) events.push({ type: "changed_mind", beliefId: c.beliefId, statement: c.statement });
      }
    }
    for (const id of record.voiced) {
      const belief = byMisconception.get(id);
      if (belief && show(belief)) events.push({ type: "voiced", beliefId: belief.id, statement: belief.statement });
    }
    if (events.length) entries.push({ turn: record.turn, events });
  }
  return entries;
}

/**
 * What the student may see during the session (GET /progress and each turn).
 * Same hiding rules as studentView(): no correctness, no answer key, and no
 * starting misconception until Pip has voiced it or been talked out of it.
 */
export function buildProgress(state: TeachableState): LearningProgress {
  const { notebook, history } = state;
  const visible = studentView(notebook);
  const misconceptions: ProgressMisconception[] = notebook.beliefs
    .filter((b) => b.source === "prior_misconception" && visibleToStudent(b, notebook))
    .map((b) => {
      const turns = misconceptionTurns(b, history);
      return {
        id: b.id,
        statement: b.statement,
        status: b.status === "corrected" ? "changed_mind" : "believes",
        voicedAtTurn: turns.voicedAtTurn,
        changedAtTurn: turns.correctedAtTurn,
        turnsToChange: turns.turnsBetween,
        // The notebook adds a student message to a misconception's evidence each time one addresses it.
        attempts: b.evidence.length,
      };
    });
  return {
    studentTurns: notebook.studentTurns,
    recordedFromTurn: state.historyFrom,
    beliefs: countStatuses(visible.map((b) => b.status)),
    teaching: teachingCounts(history),
    misconceptions,
    timeline: buildTimeline(history, notebook, (b) => visibleToStudent(b, notebook), false),
    flags: latestFlags(state),
    wrongTaught: notebook.beliefs
      .filter((b) => b.source === "taught" && (b.taughtCorrectly === "incorrect" || b.taughtCorrectly === "partly"))
      .map((b) => ({
        id: b.id,
        statement: b.statement,
        turn: history.find((r) => r.added.some((a) => a.beliefId === b.id))?.turn ?? null,
        verdict: b.taughtCorrectly === "incorrect" ? ("wrong" as const) : ("partly" as const),
        fixed: b.status === "corrected",
      })),
  };
}

/**
 * Side notes about the latest student message, from structured fields only: misconceptions Pip
 * voiced in its reply (and still holds), and taught ideas the assessor judged wrong or partly wrong.
 */
function latestFlags(state: TeachableState): LearningFlag[] {
  const { notebook, history } = state;
  const latest = history.at(-1);
  if (!latest || latest.turn !== notebook.studentTurns - 1) return [];
  const flags: LearningFlag[] = [];
  for (const id of latest.voiced) {
    const belief = notebook.beliefs.find((b) => b.misconceptionId === id && b.status === "misconception");
    if (belief) flags.push({ kind: "pip_wrong_idea", beliefId: belief.id, statement: belief.statement });
  }
  for (const added of latest.added) {
    if (added.correctness === "incorrect" || added.correctness === "partly") {
      flags.push({ kind: "taught_wrong", beliefId: added.beliefId, statement: added.statement, verdict: added.correctness === "incorrect" ? "wrong" : "partly" });
    }
  }
  return flags;
}

/**
 * The full picture, for after the session: every starting misconception and
 * whether it was corrected, everything taught with the assessor's verdict on
 * it, and the whole timeline. The answer key itself (key ideas, why a
 * misconception is wrong, what a correction must address) is never included.
 * Only call this for a completed session.
 */
export function buildReview(state: TeachableState, pack: TopicPack): LearningReview {
  const { notebook, history } = state;
  const conceptLabel = (id: string | null) => (id ? (pack.concepts.find((c) => c.id === id)?.label ?? null) : null);

  const misconceptions: ReviewMisconception[] = pack.misconceptions.map((m) => {
    const belief = notebook.beliefs.find((b) => b.misconceptionId === m.id);
    const turns = belief ? misconceptionTurns(belief, history) : { voicedAtTurn: null, correctedAtTurn: null, turnsBetween: null };
    return {
      id: belief?.id ?? `m:${m.id}`,
      label: m.label,
      statement: belief?.statement ?? m.pipBelief,
      outcome: belief?.status === "corrected" ? "corrected" : "still_held",
      voiced: notebook.voicedMisconceptionIds.includes(m.id),
      voicedAtTurn: turns.voicedAtTurn,
      correctedAtTurn: turns.correctedAtTurn,
      turnsToCorrect: turns.turnsBetween,
      attempts: history.flatMap((r) =>
        r.corrections
          .filter((c) => c.misconceptionId === m.id)
          .map((c) => ({ turn: r.turn, targeted: c.targeted, explained: c.explained, accepted: c.accepted })),
      ),
    };
  });

  // Taught beliefs from the history (so ones dropped by the belief cap still count), then any from before it began.
  const current = new Map(notebook.beliefs.map((b) => [b.id, b]));
  const laterExplained = new Set(history.flatMap((r) => r.changed).filter((c) => c.to === "understood").map((c) => c.beliefId));
  const taught: ReviewTaught[] = [];
  const seen = new Set<string>();
  for (const record of history) {
    for (const a of record.added) {
      if (seen.has(a.beliefId)) continue;
      seen.add(a.beliefId);
      const now = current.get(a.beliefId);
      const status = now?.status ?? (laterExplained.has(a.beliefId) ? "understood" : a.status);
      taught.push({
        id: a.beliefId,
        statement: a.statement,
        turn: record.turn,
        status: status === "understood" ? "understood" : "heard",
        explainedWhenTaught: a.status === "understood",
        correctness: a.correctness ?? "unclear",
        concept: conceptLabel(a.conceptId),
      });
    }
  }
  for (const b of notebook.beliefs) {
    if (b.source !== "taught" || seen.has(b.id)) continue;
    taught.push({
      id: b.id,
      statement: b.statement,
      turn: b.evidence[0] ?? 0,
      status: b.status === "understood" ? "understood" : "heard",
      explainedWhenTaught: null,
      correctness: b.taughtCorrectly ?? "unclear",
      concept: conceptLabel(b.conceptId),
    });
  }
  taught.sort((a, b) => a.turn - b.turn);

  const correctness: Record<TaughtCorrectness, number> = { correct: 0, incorrect: 0, partly: 0, unclear: 0 };
  for (const t of taught) correctness[t.correctness] += 1;

  const corrected = misconceptions.filter((m) => m.outcome === "corrected").length;
  return {
    studentTurns: notebook.studentTurns,
    recordedFromTurn: state.historyFrom,
    metrics: {
      beliefs: countStatuses(notebook.beliefs.map((b) => toStudentStatus(b.status))),
      teaching: teachingCounts(history),
      correctness,
      misconceptions: {
        total: misconceptions.length,
        voiced: misconceptions.filter((m) => m.voiced).length,
        corrected,
        stillHeld: misconceptions.length - corrected,
      },
      offTaskTurns: history.filter((r) => r.offTask).length,
    },
    misconceptions,
    taught,
    timeline: buildTimeline(history, notebook, () => true, true),
  };
}
