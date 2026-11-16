export type { LearnerAdapter, LearnerContext, LearnerProfile } from "./adapter";
export { PIP } from "./adapter";
export { ScriptedLearnerAdapter } from "./scriptedLearner";
export { postTurn, TurnError, type TurnBody, type TurnResponse } from "./httpLearner";

/*
 * Which learner answers is decided on the server, in learnerTurn()
 * (src/lib/learner/teachable/server.ts): the AI learner when LLM_* env vars are
 * set and the topic has a pack, the scripted demo learner otherwise. The browser
 * only ever calls postTurn().
 */
