import "server-only";
import type { LearnerReply, TeachingSession } from "../../types";
import { ScriptedLearnerAdapter } from "../scriptedLearner";
import { getTopic } from "../../topics";
import { llmConfigFromEnv, OpenAiCompatibleModel } from "./llm";
import { getTopicPack } from "./packs";
import { initialState, runOpening, runTurn, type Models, type TeachableState } from "./pipeline";

/** Which learner answered, so the UI can say so (the "Demo mode" note). */
export interface LearnerInfo {
  id: "teachable" | "scripted-demo";
  displayName: string;
}

export const TEACHABLE: LearnerInfo = { id: "teachable", displayName: "AI learner" };
export const SCRIPTED: LearnerInfo = { id: "scripted-demo", displayName: "Scripted demo learner" };

export class TurnConflictError extends Error {
  constructor() {
    super("There's no student message for Pip to reply to.");
    this.name = "TurnConflictError";
  }
}

/**
 * The models from LLM_* env vars, or null when they aren't set (then Pip falls back to the script).
 * LLM_MODEL_ASSESSOR / LLM_MODEL_PIP pick a model per role; both default to LLM_MODEL.
 */
export function modelsFromEnv(): Models | null {
  const assessor = llmConfigFromEnv(process.env, "assessor");
  const pip = llmConfigFromEnv(process.env, "pip");
  return assessor && pip ? { assessor: new OpenAiCompatibleModel(assessor), pip: new OpenAiCompatibleModel(pip) } : null;
}

/** Pip's notebook from stored learner state, or null when the session hasn't used the AI learner. */
export function notebookOf(storedState: unknown, topicId: string) {
  return upgradeState(storedState, topicId)?.notebook ?? null;
}

/**
 * Stored learner state in the current shape, or null when the session hasn't
 * used the AI learner (or the state is for another topic).
 *
 * Version 1 (no `version` field) had no history: it upgrades with an empty
 * history that starts at the next student message, so old sessions keep working
 * and their timeline is just shorter. No database migration is needed.
 */
export function upgradeState(value: unknown, topicId: string): TeachableState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<TeachableState> & { version?: number };
  const notebook = state.notebook;
  if (!notebook || notebook.version !== 1 || notebook.topicId !== topicId || !Array.isArray(notebook.beliefs)) return null;
  if (state.version === 2 && Array.isArray(state.history) && typeof state.historyFrom === "number") return state as TeachableState;
  if (state.version !== undefined) return null;
  return {
    version: 2,
    notebook,
    last: state.last ?? null,
    lastAssessment: state.lastAssessment ?? null,
    history: [],
    historyFrom: notebook.studentTurns,
  };
}

/**
 * Pip's next message for a session, worked out on the server.
 * Uses the teachable pipeline when a model is configured and the topic has a
 * pack; otherwise the scripted demo learner, so the app always works.
 */
export async function learnerTurn(args: {
  session: TeachingSession;
  storedState: unknown;
  models: Models | null;
}): Promise<{ reply: LearnerReply; learner: LearnerInfo; state: TeachableState | null }> {
  const { session, storedState, models } = args;
  const { messages } = session;
  const last = messages.at(-1);
  if (last && last.role !== "student") throw new TurnConflictError();

  const pack = getTopicPack(session.topicId);
  if (!pack || !models) {
    const topic = getTopic(session.topicId);
    if (!topic) throw new Error(`Unknown topic "${session.topicId}".`);
    const scripted = new ScriptedLearnerAdapter({ minDelayMs: 0, maxDelayMs: 0 });
    const context = { topic, messages, cursor: session.learnerCursor, studentMessage: last?.text };
    const reply = messages.length === 0 ? await scripted.open(context) : await scripted.respond(context);
    return { reply, learner: SCRIPTED, state: null };
  }

  const state = upgradeState(storedState, pack.topicId) ?? initialState(pack);
  const result =
    messages.length === 0 ? await runOpening({ pack, state, models }) : await runTurn({ pack, state, messages, models });
  return { reply: result.reply, learner: TEACHABLE, state: result.state };
}
