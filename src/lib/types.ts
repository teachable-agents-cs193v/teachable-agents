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
  | "psychology";

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
