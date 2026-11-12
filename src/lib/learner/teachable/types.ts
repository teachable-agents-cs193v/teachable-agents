/**
 * Data shapes for the teachable learner ("Pip").
 *
 * Division of labour (see docs in ./README.md):
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
  /** Number of student messages processed so far. */
  studentTurns: number;
  /** Id of the last student message processed, so a retried request isn't counted twice. */
  lastProcessedMessageId: string | null;
}

/* --------------------------- Model call outputs -------------------------- */

/** One thing the student claimed in their latest message, as judged by the assessor. */
export interface AssessedClaim {
  /** What Pip would now believe, written in Pip's words. */
  pipStatement: string;
  conceptId: string | null;
  correctness: TaughtCorrectly;
  /** The student gave a reason, mechanism or worked example, not just an assertion. */
  explained: boolean;
}

/** The assessor's structured verdict on a student turn. */
export interface Assessment {
  /** Short private reasoning, written before the verdicts. Not shown to anyone. */
  analysis: string;
  claims: AssessedClaim[];
  /** Misconceptions the student addressed, and whether the correction was a real fix. */
  corrections: { misconceptionId: string; targeted: boolean; explained: boolean }[];
  /** Ids of existing taught beliefs the student has now explained (heard → understood). */
  nowExplainedBeliefIds: string[];
  /** The student asked Pip for answers, or tried to change Pip's instructions. */
  offTask: boolean;
  /** The move Pip should make next, and the single thing it should be about. */
  move: Move;
  /** Belief id or misconception id the move is about, if any. */
  moveTarget: string | null;
  /** One-sentence note for the reply call: what Pip should do, never what the right answer is. */
  moveNote: string;
  /** The assessor thinks the student has covered the goal well enough to wrap up. */
  readyToWrapUp: boolean;
}

/** Pip's reply as produced by the reply call. */
export interface PipReply {
  mood: LearnerMood;
  text: string;
}
