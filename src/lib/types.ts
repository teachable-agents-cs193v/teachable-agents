/**
 * Shared TypeScript interfaces for the Teachable Agents frontend.
 *
 * These are the contracts the UI is written against. Teammates integrating
 * real systems (AI learner, persistence, auth) should satisfy these shapes
 * rather than changing the components.
 */

export type SubjectId =
  | "probability"
  | "economics"
  | "biology"
  | "computer-science"
  | "psychology"
  | "calculus";

export interface Subject {
  id: SubjectId;
  label: string;
  /** Strong accent used for icons, labels and borders. */
  accent: string;
  /** Soft tint used for card headers and badges. */
  accentSoft: string;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  title: string;
  description: string;
  learningObjective: string;
  /** How the learner introduces itself for this topic. */
  learnerIntro: string;
  teachingTips: [string, string, string];
  /** Prompt used for the optional pre-session explanation. */
  preSessionPrompt: string;
  /** Prompt used for the end-of-session explanation. */
  postSessionPrompt: string;
  /** Marks the most complete demo scenario. */
  featured?: boolean;
  /**
   * Not offered to students: left out of every list and picker, and new sessions can't
   * start on it. Its pack and script stay, and existing sessions on it still open.
   */
  hidden?: boolean;
  /** Pip can be run on the student's device for this topic (its pack has an on-device prompt). */
  onDevice?: boolean;
}

export type MessageRole = "student" | "learner";

/** What a learner turn is doing in the conversation. */
export type LearnerTurnKind =
  | "opening"
  | "question"
  | "misconception"
  | "realization"
  | "closing";

export type LearnerMood = "curious" | "confused" | "happy" | "thinking";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  /** Learner-only metadata. Used by the reflection page to list what came up. */
  kind?: LearnerTurnKind;
  concept?: string;
  misconception?: string;
  mood?: LearnerMood;
  /** "device": Pip's text was written by the small model on the student's device, not the server. */
  generatedOn?: "device";
}

export interface LearnerReply {
  text: string;
  kind: LearnerTurnKind;
  mood: LearnerMood;
  concept?: string;
  misconception?: string;
  /**
   * True when the learner has nothing further scripted/planned. The UI uses
   * this to nudge the student toward ending the session.
   */
  isFinal: boolean;
  /** Opaque adapter state carried on the session (e.g. script index). */
  nextCursor: number;
  /** Which learner produced this reply, when the adapter knows (the server-side learner does). */
  learner?: { id: string; displayName: string };
}

export type SessionStatus = "in_progress" | "completed";

export type ConfidenceRating = 1 | 2 | 3 | 4 | 5;

export interface SessionReflection {
  /** Student explains a key concept without notes, after teaching. */
  postExplanation: string;
  confidence: ConfidenceRating;
  hardestToExplain: string;
  /** Did the learner's misconceptions reveal anything about the student's own understanding? */
  misconceptionReflection: string;
  /** Did the interaction help the student notice something they didn't understand? */
  noticedGap: "yes" | "no" | "unsure";
  noticedGapDetail: string;
  freeReflection: string;
  submittedAt: string;
}

export interface TeachingSession {
  id: string;
  topicId: string;
  learnerId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  messages: ChatMessage[];
  /** Adapter cursor (for the scripted learner, the next script step). */
  learnerCursor: number;
  /** Optional explanation written before the session started. */
  preExplanation?: string;
  reflection?: SessionReflection;
}

/** Derived view of a session used by results and dashboard screens. */
export interface SessionSummary {
  studentMessages: number;
  learnerMessages: number;
  totalMessages: number;
  durationMinutes: number | null;
  concepts: string[];
  misconceptions: string[];
}

/** The logged-in user, as returned by the auth helpers in src/lib/auth/server.ts. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * One of Pip's beliefs, as the student may see it (the "what Pip believes" panel).
 * Built on the server by studentView() in src/lib/learner/teachable/notebook.ts.
 * It never says whether a belief is correct: that is revealed only after the session.
 */
export interface StudentBelief {
  id: string;
  /** What Pip believes, in Pip's words. */
  statement: string;
  /**
   * - `heard`: the student said it, but hasn't explained why yet.
   * - `understood`: the student explained why, or gave an example.
   * - `believes`: something Pip started out believing and has said out loud.
   * - `changed_mind`: Pip started out believing this, and the student's explanation changed its mind.
   */
  status: "heard" | "understood" | "believes" | "changed_mind";
  /** Pip believed this before the session (rather than being taught it). */
  startedWith: boolean;
  /** Added or changed by the student's latest message. */
  changedThisTurn: boolean;
  /** Which student messages it came from: 0 is the student's first message. */
  evidence: number[];
}

/* ------------------------- Learning progress (Pip) ------------------------ */

/** The assessor's verdict on something the student taught. In full after the session; during it, only as wrong-idea flags (LearningProgress.flags). */
export type TaughtCorrectness = "correct" | "incorrect" | "partly" | "unclear";

/**
 * One thing that changed in Pip's notebook because of a student message.
 * - `learned`: Pip took on something the student said (`status` says whether they explained it).
 * - `explained`: something Pip had only heard, the student has now explained.
 * - `voiced`: Pip said out loud one of the misconceptions it started with.
 * - `changed_mind`: the student's explanation changed Pip's mind about a misconception.
 */
export type TimelineEvent =
  | { type: "learned"; beliefId: string; statement: string; status: "heard" | "understood"; correctness?: TaughtCorrectness }
  | { type: "explained"; beliefId: string; statement: string }
  | { type: "voiced"; beliefId: string; statement: string }
  | { type: "changed_mind"; beliefId: string; statement: string }
  /** The student took back or replaced something they taught earlier. */
  | { type: "taken_back"; beliefId: string; statement: string };

/** Everything one student message changed. `turn` is the student message index (0 = first). */
export interface TimelineEntry {
  turn: number;
  events: TimelineEvent[];
}

/** How much of the student's teaching came with a reason or example. Counts of the assessor's structured verdicts. */
export interface TeachingCounts {
  /** Ideas Pip took on from the student. */
  claims: number;
  /** ...that came with a reason, mechanism or example. */
  explained: number;
  /** ...that were just asserted. */
  asserted: number;
  /** Asserted ideas the student explained in a later message. */
  explainedLater: number;
}

/** A starting misconception Pip has said out loud (or been talked out of), during a session. */
export interface ProgressMisconception {
  /** Same id as the belief in the "what Pip believes" list. */
  id: string;
  statement: string;
  status: "believes" | "changed_mind";
  /** The student message Pip voiced it in reply to; null if not voiced, or voiced before the timeline began. */
  voicedAtTurn: number | null;
  /** The student message that changed Pip's mind; null while Pip still believes it. */
  changedAtTurn: number | null;
  /** Student messages from voicing to the change of mind; null unless both are known. */
  turnsToChange: number | null;
  /** Student messages that addressed it. */
  attempts: number;
}

/**
 * GET /api/sessions/[id]/progress, and `progress` on each turn response.
 * Student-safe: no answer key, no correctness verdicts beyond the wrong-idea flags, and no misconception
 * Pip hasn't voiced yet (same rules as StudentBelief).
 */
export interface LearningProgress {
  studentTurns: number;
  /** The first student message the timeline covers (0 unless the session predates the timeline). */
  recordedFromTurn: number;
  /** Visible beliefs by status. */
  beliefs: Record<StudentBelief["status"], number>;
  teaching: TeachingCounts;
  misconceptions: ProgressMisconception[];
  /** Oldest first; only turns where something visible changed. */
  timeline: TimelineEntry[];
  /**
   * Side notes for the student about the latest message, never said by Pip: Pip just voiced one of
   * its wrong starting ideas, or the student just taught something the assessor judged wrong.
   * They say that something isn't right, never what the right answer is.
   */
  flags: LearningFlag[];
  /** Ideas the student taught that the assessor judged wrong, which Pip still holds. */
  wrongTaught: { id: string; statement: string; turn: number | null; verdict: "wrong" | "partly"; fixed: boolean }[];
}

export type LearningFlag =
  | { kind: "pip_wrong_idea"; beliefId: string; statement: string }
  | { kind: "taught_wrong"; beliefId: string; statement: string; verdict: "wrong" | "partly" };

/** A starting misconception, after the session. */
export interface ReviewMisconception {
  id: string;
  /** Short label from the topic pack. */
  label: string;
  /** How Pip put it. */
  statement: string;
  outcome: "corrected" | "still_held";
  voiced: boolean;
  voicedAtTurn: number | null;
  correctedAtTurn: number | null;
  turnsToCorrect: number | null;
  /** Each student message that addressed it, and how the assessor saw it. */
  attempts: { turn: number; targeted: boolean; explained: boolean; accepted: boolean }[];
}

/** Something the student taught Pip, after the session. */
export interface ReviewTaught {
  id: string;
  statement: string;
  /** The student message it came from. */
  turn: number;
  /** taken_back: the student later took it back or replaced it, so Pip dropped it. */
  status: "heard" | "understood" | "taken_back";
  /** Whether it came with a reason when first taught; null if taught before the timeline began. */
  explainedWhenTaught: boolean | null;
  correctness: TaughtCorrectness;
  /** The topic concept it relates to, if the assessor linked one. */
  concept: string | null;
}

/** GET /api/sessions/[id]/review, once the session is completed. */
export interface LearningReview {
  studentTurns: number;
  recordedFromTurn: number;
  metrics: {
    /** All beliefs by status, including misconceptions Pip never voiced. */
    beliefs: Record<StudentBelief["status"], number>;
    teaching: TeachingCounts;
    correctness: Record<TaughtCorrectness, number>;
    misconceptions: { total: number; voiced: number; corrected: number; stillHeld: number };
    /** Messages the assessor judged were asking for answers or trying to change Pip's instructions. */
    offTaskTurns: number;
  };
  misconceptions: ReviewMisconception[];
  taught: ReviewTaught[];
  /** Every change, including misconceptions never voiced; `learned` events carry correctness. */
  timeline: TimelineEntry[];
}

