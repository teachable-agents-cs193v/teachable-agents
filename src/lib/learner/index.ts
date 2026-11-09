import type { LearnerAdapter } from "./adapter";
import { ScriptedLearnerAdapter } from "./scriptedLearner";

export type { LearnerAdapter, LearnerContext, LearnerProfile } from "./adapter";
export { PIP } from "./adapter";
export { ScriptedLearnerAdapter } from "./scriptedLearner";

let instance: LearnerAdapter | null = null;

/**
 * Single place to swap the learner implementation.
 *
 * Chase: return your real adapter here (e.g. one that POSTs the transcript to
 * `/api/learner`). The rest of the UI will not need to change.
 */
export function getLearnerAdapter(): LearnerAdapter {
  if (!instance) instance = new ScriptedLearnerAdapter();
  return instance;
}
