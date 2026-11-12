/**
 * One Pip turn: assessor call → notebook update → reply call.
 *
 * Code here checks JSON shape and ids only. It never inspects what the
 * student or Pip said; the prompts in ./prompts.ts make those judgments.
 */

import type { ChatMessage, LearnerMood, LearnerReply, LearnerTurnKind } from "../../types";
import type { JsonModel } from "./llm";
import { LlmError } from "./llm";
import { applyAssessment, createNotebook, recordMove, recordVoiced } from "./notebook";
import { assessorMessages, replyMessages } from "./prompts";
import type { AssessedClaim, Assessment, Move, Notebook, PipReply, TaughtCorrectly, TopicPack } from "./types";
import { MOVES } from "./types";

/** Everything the server keeps between turns for one session. */
export interface TeachableState {
  notebook: Notebook;
  /** The last reply, so a retried request for the same student message returns it instead of re-running. */
  last: { studentMessageId: string | null; reply: LearnerReply } | null;
  /** The assessor's last verdict. Kept for debugging and evaluation; never shown to Pip or the student. */
  lastAssessment: Assessment | null;
}

export function initialState(pack: TopicPack): TeachableState {
  return { notebook: createNotebook(pack), last: null, lastAssessment: null };
}

/* -------------------------- Shape validation ---------------------------- */

const MOODS: LearnerMood[] = ["curious", "confused", "happy", "thinking"];
const CORRECTNESS: TaughtCorrectly[] = ["correct", "incorrect", "partly", "unclear"];
const MAX_TEXT = 600;

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown) => v === true;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const idOrNull = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "null" ? v.trim() : null);

/** Coerces the assessor's JSON into an Assessment. Throws only if it isn't an object at all. */
export function parseAssessment(raw: unknown): Assessment {
  if (!raw || typeof raw !== "object") throw new LlmError("assessor: not a JSON object", true);
  const r = raw as Record<string, unknown>;
  const claims: AssessedClaim[] = arr(r.claims)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      pipStatement: str(c.pipStatement, 300),
      conceptId: idOrNull(c.conceptId),
      correctness: CORRECTNESS.includes(c.correctness as TaughtCorrectly) ? (c.correctness as TaughtCorrectly) : "unclear",
      explained: bool(c.explained),
    }))
    .filter((c) => c.pipStatement)
    .slice(0, 3);
  return {
    analysis: str(r.analysis, 600),
    claims,
    corrections: arr(r.corrections)
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({ misconceptionId: str(c.misconceptionId, 100), targeted: bool(c.targeted), explained: bool(c.explained) }))
      .filter((c) => c.misconceptionId),
    nowExplainedBeliefIds: arr(r.nowExplainedBeliefIds).map((v) => str(v, 100)).filter(Boolean),
    offTask: bool(r.offTask),
    move: (MOVES as readonly string[]).includes(r.move as string) ? (r.move as Move) : "admit_confusion",
    moveTarget: idOrNull(r.moveTarget),
    moveNote: str(r.moveNote, 300),
    readyToWrapUp: bool(r.readyToWrapUp),
  };
}

export function parseReply(raw: unknown): PipReply {
  if (!raw || typeof raw !== "object") throw new LlmError("reply: not a JSON object", true);
  const r = raw as Record<string, unknown>;
  const text = str(r.text, MAX_TEXT);
  if (!text) throw new LlmError("reply: empty text", true);
  const mood = MOODS.includes(r.mood as LearnerMood) ? (r.mood as LearnerMood) : "curious";
  return { mood, text };
}

/* ------------------------------ The turn -------------------------------- */

const KIND: Partial<Record<Move, LearnerTurnKind>> = {
  open: "opening",
  voice_misconception: "misconception",
  summarize_back: "realization",
  wrap_up: "closing",
};

async function callJson<T>(model: JsonModel, run: () => Promise<unknown>, parse: (raw: unknown) => T): Promise<T> {
  // One extra attempt if the model returns the wrong shape (transport retries happen inside the model).
  try {
    return parse(await run());
  } catch (error) {
    if (error instanceof LlmError && !error.retryable) throw error;
    return parse(await run());
  }
}

function toLearnerReply(args: {
  pack: TopicPack;
  notebook: Notebook;
  reply: PipReply;
  move: Move;
  moveTarget: string | null;
}): LearnerReply {
  const { pack, notebook, reply, move, moveTarget } = args;
  const target = notebook.beliefs.find((b) => b.id === moveTarget || b.misconceptionId === moveTarget);
  const conceptLabel = target?.conceptId ? pack.concepts.find((c) => c.id === target.conceptId)?.label : undefined;
  const misconceptionLabel =
    move === "voice_misconception" && target?.misconceptionId
      ? pack.misconceptions.find((m) => m.id === target.misconceptionId)?.label
      : undefined;
  return {
    text: reply.text,
    kind: KIND[move] ?? "question",
    mood: reply.mood,
    concept: misconceptionLabel ? undefined : conceptLabel,
    misconception: misconceptionLabel,
    isFinal: move === "wrap_up",
    nextCursor: notebook.studentTurns,
  };
}

/** Pip's first message. One model call; nothing to assess yet. */
export async function runOpening(args: { pack: TopicPack; state: TeachableState; model: JsonModel }): Promise<{
  reply: LearnerReply;
  state: TeachableState;
}> {
  const { pack, state, model } = args;
  if (state.last && state.last.studentMessageId === null) return { reply: state.last.reply, state };
  const messages = replyMessages({
    learningGoal: pack.learningGoal,
    priorKnowledge: pack.priorKnowledge,
    notebook: state.notebook,
    messages: [],
    studentText: null,
    move: "open",
    moveNote: "Say hi, say briefly what you're trying to understand and that the words keep tripping you up, then ask the student where to start.",
    targetStatement: null,
  });
  const reply = await callJson(model, () => model.completeJson(messages, { label: "reply", temperature: 0.8, reasoningEffort: "low", maxTokens: 700 }), parseReply);
  const notebook = recordMove(state.notebook, "open");
  const learnerReply = toLearnerReply({ pack, notebook, reply, move: "open", moveTarget: null });
  return { reply: learnerReply, state: { notebook, last: { studentMessageId: null, reply: learnerReply }, lastAssessment: null } };
}

/** Pip's reply to one student message. Two model calls. */
export async function runTurn(args: {
  pack: TopicPack;
  state: TeachableState;
  /** The whole transcript, ending with the student's message. */
  messages: ChatMessage[];
  model: JsonModel;
}): Promise<{ reply: LearnerReply; state: TeachableState }> {
  const { pack, state, messages, model } = args;
  const index = messages.length - 1;
  const student = messages[index];
  if (!student || student.role !== "student") throw new Error("runTurn needs the transcript to end with a student message.");

  // Retried request for a message already answered: return the same reply.
  if (state.last?.studentMessageId === student.id) return { reply: state.last.reply, state };

  const history = messages.slice(0, index);
  const raw = await callJson(
    model,
    () =>
      model.completeJson(assessorMessages({ pack, notebook: state.notebook, messages: history, studentText: student.text }), {
        label: "assessor",
        temperature: 0.2,
        reasoningEffort: "medium",
        maxTokens: 2500,
      }),
    parseAssessment,
  );

  const studentIndex = messages.slice(0, index + 1).filter((m) => m.role === "student").length - 1;
  const applied = applyAssessment(state.notebook, raw, pack, { index: studentIndex, messageId: student.id });
  let notebook = applied.notebook;
  const assessment = applied.assessment;

  const target = notebook.beliefs.find((b) => b.id === assessment.moveTarget || b.misconceptionId === assessment.moveTarget);
  const reply = await callJson(
    model,
    () =>
      model.completeJson(
        replyMessages({
          learningGoal: pack.learningGoal,
          priorKnowledge: pack.priorKnowledge,
          notebook,
          messages: history,
          studentText: student.text,
          move: assessment.move,
          moveNote: assessment.moveNote,
          targetStatement: target?.statement ?? null,
        }),
        { label: "reply", temperature: 0.8, reasoningEffort: "low", maxTokens: 700 },
      ),
    parseReply,
  );

  if (assessment.move === "voice_misconception") notebook = recordVoiced(notebook, assessment.moveTarget);
  notebook = recordMove(notebook, assessment.move);
  const learnerReply = toLearnerReply({ pack, notebook, reply, move: assessment.move, moveTarget: assessment.moveTarget });
  return {
    reply: learnerReply,
    state: { notebook, last: { studentMessageId: student.id, reply: learnerReply }, lastAssessment: assessment },
  };
}
