import type { LearnerAdapter } from "./adapter";
import { HttpLearnerAdapter } from "./httpLearner";

export type { LearnerAdapter, LearnerContext, LearnerProfile } from "./adapter";
export { PIP } from "./adapter";
export { ScriptedLearnerAdapter } from "./scriptedLearner";
export { HttpLearnerAdapter } from "./httpLearner";

let instance: LearnerAdapter | null = null;

/**
 * Single place to swap the learner implementation.
 *
 * The browser always talks to the server (POST /api/sessions/[id]/turn). The
 * server runs the AI learner (src/lib/learner/teachable) when LLM_* env vars are
 * set and the topic has a pack, and the scripted demo learner otherwise.
 */
export function getLearnerAdapter(): LearnerAdapter {
  if (!instance) instance = new HttpLearnerAdapter();
  return instance;
}
