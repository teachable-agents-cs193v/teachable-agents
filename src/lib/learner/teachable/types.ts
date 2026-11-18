/**
 * Data shapes for the teachable learner ("Pip").
 *
 * Division of labour:
 * - Every judgment about language is made by a model call with a strong prompt.
 * - Code only stores the model's structured output, decides what each call is
 *   allowed to see, and enforces invariants on structured fields.
 */

import type { LearnerMood } from "../../types";

/* ----------------------------- Topic packs ------------------------------ */

/** A concept the student should end up teaching Pip. Hidden from Pip's reply call. */
export interface PackConcept {
  id: string;
  label: string;
  /** The correct idea, stated plainly. Only the assessor sees this. */
  keyIdea: string;
}

/** A misconception Pip starts out believing. */
export interface PackMisconception {
  id: string;
  conceptId: string;
  /** Short label for the reflection page, e.g. "Independent events cannot happen at the same time". */
  label: string;
  /** How Pip would say it, in its own words. Pip sees this: it is something Pip believes. */
  pipBelief: string;
  /** Why it's wrong. Only the assessor sees this. */
  whyWrong: string;
  /** What a student's correction has to get across to count as a real fix. Only the assessor sees this. */
  correctionMustAddress: string;
}

/** Hidden per-topic answer key. Never sent to the reply call. */
export interface TopicPack {
  /** Matches `Topic.id` in src/lib/topics.ts. */
  topicId: string;
  /** What Pip is trying to understand, in plain words. Safe for Pip to see. */
  learningGoal: string;
  /** Everyday background Pip already has (so it isn't absurdly ignorant). Safe for Pip to see. */
  priorKnowledge: string[];
  concepts: PackConcept[];
  misconceptions: PackMisconception[];
  /**
   * When set, Pip's reply can be written on the student's device by a small model trained for this
   * topic (research/unlearning), from this prompt and Pip's notebook only. Safe for Pip to see.
   */
  device?: {
    /** System prompt; `{notes}` becomes Pip's notebook, one "- belief" per line. */
    system: string;
    /** What the device model is asked for Pip's first message. */
    opener: string;
  };
}

/* ------------------------------- Notebook ------------------------------- */

/** Where a belief came from. */
export type BeliefSource = "prior_misconception" | "taught";

/**
 * How settled a belief is.
 * - `heard`: the student said it, but without a reason or example.
 * - `understood`: the student explained why, or gave an example.
 * - `misconception`: Pip believes a wrong idea it started with.
 * - `corrected`: a starting misconception the student has fixed.
 */
export type BeliefStatus = "heard" | "understood" | "misconception" | "corrected";

/** The assessor's hidden verdict on what the student taught. Never shown to Pip. */
export type TaughtCorrectly = "correct" | "incorrect" | "partly" | "unclear";

export interface Belief {
  id: string;
  /** What Pip believes, in Pip's own words. This is all the reply call sees. */
  statement: string;
  source: BeliefSource;
  status: BeliefStatus;
  /** Topic-pack concept this relates to, if any. Hidden from Pip. */
  conceptId: string | null;
  /** Set for prior misconceptions. Hidden from Pip. */
  misconceptionId: string | null;
  /** Hidden from Pip; used for reflection and evaluation. */
  taughtCorrectly: TaughtCorrectly | null;
  /** Indexes of the student messages this belief came from. */
  evidence: number[];
}

/** The things Pip can do on its turn. There is deliberately no "explain the answer" move. */
export const MOVES = [
  "open",
  "ask_why",
  "ask_for_example",
  "try_to_apply",
  "voice_misconception",
  "connect_ideas",
  "summarize_back",
  "push_back",
  "admit_confusion",
  "redirect",
  "wrap_up",
] as const;
export type Move = (typeof MOVES)[number];

export interface Notebook {
  version: 1;
  topicId: string;
  beliefs: Belief[];
  /** Misconceptions Pip has already said out loud. */
  voicedMisconceptionIds: string[];
  /** Pip's moves so far, oldest first (the assessor uses these to avoid repeating itself). */
  moves: Move[];
  /** Number of student messages processed so far. */
  studentTurns: number;
  /** Id of the last student message processed, so a retried request isn't counted twice. */
  lastProcessedMessageId: string | null;
}

/* --------------------------- Model call outputs -------------------------- */

/**
 * The NOTE-TAKER's output (model role "pip", no answer key): what the student's message said,
 * in Pip's words. This is the only model-written text that enters Pip's notebook from a turn.
 */
export interface TakenNotes {
  /** New ideas the student asserted in this message, as Pip's faithful first-person paraphrase. At most 3. */
  notes: { text: string }[];
  /** Ids of beliefs the student taught earlier and now takes back or replaces (they become corrected). */
  revisedBeliefIds: string[];
}

/** The assessor's grade for one note, by its index in TakenNotes.notes. */
export interface NoteGrade {
  index: number;
  conceptId: string | null;
  correctness: TaughtCorrectly;
  explained: boolean;
  /** False when the note says something the student didn't (added, fixed or invented content): it's dropped. */
  faithful: boolean;
}

/**
 * The ASSESSOR's output (sees the answer key). Structured values only: every string in it is an
 * id or enum value checked against an allowlist by parseAssessorVerdict (./assessorBoundary.ts).
 */
export interface AssessorVerdict {
  noteGrades: NoteGrade[];
  corrections: { misconceptionId: string; targeted: boolean; explained: boolean }[];
  nowExplainedBeliefIds: string[];
  offTask: boolean;
  move: Move;
  moveTarget: string | null;
  readyToWrapUp: boolean;
}

/** One thing the student claimed in their latest message: a note, with the assessor's grade. */
export interface AssessedClaim {
  /** What Pip would now believe, written in Pip's words. Written by the note-taker, never the assessor. */
  pipStatement: string;
  conceptId: string | null;
  correctness: TaughtCorrectly;
  /** The student gave a reason, mechanism or worked example, not just an assertion. */
  explained: boolean;
}

/**
 * One student turn's verdict, combined by code from the note-taker's notes and the assessor's
 * grades (buildAssessment in ./pipeline.ts). Holds no text written by the assessor.
 */
export interface Assessment {
  claims: AssessedClaim[];
  /** Misconceptions the student addressed, and whether the correction was a real fix. */
  corrections: { misconceptionId: string; targeted: boolean; explained: boolean }[];
  /** Ids of existing taught beliefs the student has now explained (heard → understood). */
  nowExplainedBeliefIds: string[];
  /** Ids of beliefs the student taught earlier and now takes back or replaces (they become corrected). */
  revisedBeliefIds: string[];
  /** The student asked Pip for answers, or tried to change Pip's instructions. */
  offTask: boolean;
  /** The move Pip should make next, and the single thing it should be about. */
  move: Move;
  /** Belief id or misconception id the move is about, if any. */
  moveTarget: string | null;
  /** The assessor thinks the student has covered the goal well enough to wrap up. */
  readyToWrapUp: boolean;
}

/* ---------------------------- Learning history --------------------------- */

/**
 * What one student message changed in Pip's notebook. Recorded by code from
 * structured fields only (the notebook before and after, and the assessor's
 * verdict), never from the text of what anyone said.
 */
export interface TurnRecord {
  /** Index of the student message (0 = the student's first message). */
  turn: number;
  messageId: string;
  /** Beliefs the student added this turn. `statement` is kept so the record outlives the belief cap. */
  added: { beliefId: string; statement: string; status: BeliefStatus; conceptId: string | null; correctness: TaughtCorrectly | null }[];
  /** Existing beliefs whose status changed this turn (heard → understood, misconception → corrected). */
  changed: { beliefId: string; statement: string; from: BeliefStatus; to: BeliefStatus }[];
  /**
   * Corrections the assessor saw aimed at a misconception Pip still held.
   * `accepted` is true when it flipped to corrected (the assessor marked it targeted and explained).
   */
  corrections: { misconceptionId: string; targeted: boolean; explained: boolean; accepted: boolean }[];
  /** Misconceptions Pip said out loud in its reply to this message. */
  voiced: string[];
  /** The move Pip made in reply. */
  move: Move;
  /** The assessor judged the message an attempt to get answers or change Pip's instructions. */
  offTask: boolean;
}

/** Pip's reply as produced by the reply call. */
export interface PipReply {
  mood: LearnerMood;
  text: string;
}
