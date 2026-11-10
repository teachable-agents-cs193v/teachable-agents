import type { LearnerMood, LearnerTurnKind } from "../types";

export interface LearnerScriptStep {
  id: string;
  kind: LearnerTurnKind;
  mood: LearnerMood;
  text: string;
  /** Concept this turn surfaces (listed on the reflection page). */
  concept?: string;
  /** Misconception Pip voices on this turn, if any. */
  misconception?: string;
}

export interface LearnerScript {
  topicId: string;
  steps: LearnerScriptStep[];
  /** What Pip says once every scripted turn has been used. */
  exhaustedReply: string;
}
