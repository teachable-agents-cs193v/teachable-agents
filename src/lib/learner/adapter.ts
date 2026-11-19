import type { ChatMessage, LearnerReply, Topic } from "../types";

/**
 * Everything the AI learner needs in order to produce its next turn.
 * A real backend would send `messages` (the transcript so far) to a model.
 */
export interface LearnerContext {
  /** The session being taught. Server-backed learners look the session up by this. */
  sessionId?: string;
  topic: Topic;
  messages: ChatMessage[];
  /** Adapter-specific position marker stored on the session. */
  cursor: number;
  /** The student's newest message, if this is a reply (absent for the opening turn). */
  studentMessage?: string;
}

/**
 * A learner that answers from the conversation alone. The scripted demo learner
 * implements it, and the server uses it when no model is configured or the topic
 * has no pack (learnerTurn() in ./teachable/server.ts). The AI learner runs
 * through the turn pipeline instead (./teachable/pipeline.ts).
 */
export interface LearnerAdapter {
  /** Stable identifier shown in the UI so demo vs. real behavior is transparent. */
  readonly id: string;
  readonly displayName: string;
  /** First turn of a session: the learner introduces its confusion. */
  open(context: LearnerContext): Promise<LearnerReply>;
  /** Every subsequent turn. */
  respond(context: LearnerContext): Promise<LearnerReply>;
}

export interface LearnerProfile {
  id: string;
  name: string;
  tagline: string;
  personality: string[];
}

export const PIP: LearnerProfile = {
  id: "pip",
  name: "Pip",
  tagline: "A curious learner who needs you to explain things.",
  personality: [
    "Asks follow-up questions until an idea actually makes sense.",
    "Makes plausible mistakes that you will need to catch and correct.",
    "Tries to say concepts back in its own words to check understanding.",
  ],
};
