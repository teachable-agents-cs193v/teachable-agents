import "server-only";
import type { LearnerReply, TeachingSession } from "../../types";
import { ScriptedLearnerAdapter } from "../scriptedLearner";
import { getTopic } from "../../topics";
import type { JsonModel } from "./llm";
import { llmConfigFromEnv, OpenAiCompatibleModel } from "./llm";
import { getTopicPack } from "./packs";
import { initialState, runOpening, runTurn, type TeachableState } from "./pipeline";

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

/** The model from LLM_* env vars, or null when they aren't set (then Pip falls back to the script). */
export function modelFromEnv(): JsonModel | null {
  const config = llmConfigFromEnv();
  return config ? new OpenAiCompatibleModel(config) : null;
}

function isTeachableState(value: unknown, topicId: string): value is TeachableState {
  if (!value || typeof value !== "object") return false;
  const notebook = (value as TeachableState).notebook;
  return !!notebook && notebook.version === 1 && notebook.topicId === topicId && Array.isArray(notebook.beliefs);
}

/**
 * Pip's next message for a session, worked out on the server.
 * Uses the teachable pipeline when a model is configured and the topic has a
 * pack; otherwise the scripted demo learner, so the app always works.
 */
export async function learnerTurn(args: {
  session: TeachingSession;
  storedState: unknown;
  model: JsonModel | null;
}): Promise<{ reply: LearnerReply; learner: LearnerInfo; state: TeachableState | null }> {
  const { session, storedState, model } = args;
  const { messages } = session;
  const last = messages.at(-1);
  if (last && last.role !== "student") throw new TurnConflictError();

  const pack = getTopicPack(session.topicId);
  if (!pack || !model) {
    const topic = getTopic(session.topicId);
    if (!topic) throw new Error(`Unknown topic "${session.topicId}".`);
    const scripted = new ScriptedLearnerAdapter({ minDelayMs: 0, maxDelayMs: 0 });
    const context = { topic, messages, cursor: session.learnerCursor, studentMessage: last?.text };
    const reply = messages.length === 0 ? await scripted.open(context) : await scripted.respond(context);
    return { reply, learner: SCRIPTED, state: null };
  }

  const state = isTeachableState(storedState, pack.topicId) ? storedState : initialState(pack);
  const result =
    messages.length === 0 ? await runOpening({ pack, state, model }) : await runTurn({ pack, state, messages, model });
  return { reply: result.reply, learner: TEACHABLE, state: result.state };
}
