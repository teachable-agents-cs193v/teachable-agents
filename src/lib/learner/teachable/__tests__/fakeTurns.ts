/**
 * Test helper (not a test file): describe what a turn decided in one object, and get the raw
 * answers the note-taker and assessor fakes should give for it. Fakes answer by `options.label`.
 */

export interface FakeClaim {
  pipStatement: string;
  conceptId?: string | null;
  correctness?: string;
  explained?: boolean;
  faithful?: boolean;
}

export interface FakeTurn {
  claims?: FakeClaim[];
  corrections?: { misconceptionId: string; targeted: boolean; explained: boolean }[];
  nowExplainedBeliefIds?: string[];
  revisedBeliefIds?: string[];
  offTask?: boolean;
  move?: string;
  moveTarget?: string | null;
  readyToWrapUp?: boolean;
}

/** The note-taker's raw answer for a turn. */
export function noteTakerAnswer(turn: FakeTurn = {}) {
  return { notes: (turn.claims ?? []).map((c) => ({ text: c.pipStatement })), revisedBeliefIds: turn.revisedBeliefIds ?? [] };
}

/** The assessor's raw answer for a turn: grades for the notes by index, and structured values only. */
export function assessorAnswer(turn: FakeTurn = {}) {
  return {
    noteGrades: (turn.claims ?? []).map((c, index) => ({
      index,
      conceptId: c.conceptId ?? null,
      correctness: c.correctness ?? "unclear",
      explained: c.explained ?? false,
      faithful: c.faithful ?? true,
    })),
    corrections: turn.corrections ?? [],
    nowExplainedBeliefIds: turn.nowExplainedBeliefIds ?? [],
    offTask: turn.offTask ?? false,
    move: turn.move ?? "ask_why",
    moveTarget: turn.moveTarget ?? null,
    readyToWrapUp: turn.readyToWrapUp ?? false,
  };
}

/** Answer queues for several turns, keyed by call label. */
export function turnAnswers(turns: FakeTurn[]) {
  return { noteTaker: turns.map(noteTakerAnswer), assessor: turns.map(assessorAnswer) };
}
