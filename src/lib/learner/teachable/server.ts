import "server-only";
import type { LearnerReply, TeachingSession } from "../../types";
import { ScriptedLearnerAdapter } from "../scriptedLearner";
import { getTopic } from "../../topics";
import { aiAllowed } from "../../aiData";
import { llmConfigFromEnv, OpenAiCompatibleModel } from "./llm";
import { getTopicPack } from "./packs";
import { initialState, prepareDeviceTurn, runOpening, runTurn, type Models, type TeachableState } from "./pipeline";
import type { Assessment } from "./types";

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

/**
 * The models a session may use: none unless its student chose AI Pip when starting it.
 * The choice is the session's learnerId, set by the server at creation and never updated
 * (src/lib/aiData.ts), so a session without consent can't reach the provider. Every model
 * call for a session goes through learnerTurn or deviceTurn, which both start here.
 */
export function modelsFor(session: Pick<TeachingSession, "learnerId">, models: Models | null): Models | null {
  return aiAllowed(session.learnerId) ? models : null;
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
  if (state.version === 2 && Array.isArray(state.history) && typeof state.historyFrom === "number") {
    const current = state as TeachableState;
    const lastAssessment = withoutAssessorText(current.lastAssessment);
    return lastAssessment === current.lastAssessment ? current : { ...current, lastAssessment };
  }
  if (state.version !== undefined) return null;
  return {
    version: 2,
    notebook,
    last: state.last ?? null,
    lastAssessment: withoutAssessorText(state.lastAssessment ?? null),
    history: [],
    historyFrom: notebook.studentTurns,
  };
}

/**
 * States saved before the note-taker split kept the assessor's free text (`analysis`, `moveNote`)
 * in `lastAssessment`. Nothing reads them any more; drop them so stored state carries no assessor text.
 * Returns the same object when there's nothing to drop.
 */
function withoutAssessorText(assessment: Assessment | null): Assessment | null {
  if (!assessment || typeof assessment !== "object") return null;
  if (!("analysis" in assessment) && !("moveNote" in assessment)) return assessment;
  const rest: Record<string, unknown> = { ...assessment };
  delete rest.analysis;
  delete rest.moveNote;
  return { revisedBeliefIds: [], ...rest } as unknown as Assessment;
}

/**
 * Step 1 of an on-device turn: assess, save nothing yet, and return the device model's prompt.
 * Null when this topic has no on-device prompt or no model is configured, so the caller falls
 * back to a reply written on the server.
 */
export async function deviceTurn(args: { session: TeachingSession; storedState: unknown; models: Models | null }) {
  const { session, storedState } = args;
  const models = modelsFor(session, args.models);
  const pack = getTopicPack(session.topicId);
  if (!pack?.device || !models) return null;
  const last = session.messages.at(-1);
  if (last && last.role !== "student") throw new TurnConflictError();
  const state = upgradeState(storedState, pack.topicId) ?? initialState(pack);
  return prepareDeviceTurn({ pack, state, messages: session.messages, models });
}

/**
 * Pip's next message for a session, worked out on the server.
 * Uses the teachable pipeline when the student chose AI Pip for this session, a model is
 * configured and the topic has a pack; otherwise the scripted demo learner, so the app always works.
 */
export async function learnerTurn(args: {
  session: TeachingSession;
  storedState: unknown;
  models: Models | null;
}): Promise<{ reply: LearnerReply; learner: LearnerInfo; state: TeachableState | null }> {
  const { session, storedState } = args;
  const models = modelsFor(session, args.models);
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
