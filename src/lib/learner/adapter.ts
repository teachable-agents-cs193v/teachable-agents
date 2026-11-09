import type { ChatMessage, LearnerReply, Topic } from "../types";

/**
 * Everything the AI learner needs in order to produce its next turn.
 * A real backend would send `messages` (the transcript so far) to a model.
 */
export interface LearnerContext {
  topic: Topic;
  messages: ChatMessage[];
  /** Adapter-specific position marker stored on the session. */
  cursor: number;
  /** The student's newest message, if this is a reply (absent for the opening turn). */
  studentMessage?: string;
}

/**
 * Integration point for the AI learner (owned by Chase).
 *
 * The UI only ever talks to this interface. To plug in a real model, implement
 * it (likely by calling a Next.js route handler that holds the API key) and
 * return it from `getLearnerAdapter()` in `./index.ts`.
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
