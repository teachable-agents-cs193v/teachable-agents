/**
 * One Pip turn: note-taker call → assessor call → notebook update → reply call.
 *
 * Code here checks JSON shape and ids only. It never inspects what the
 * student or Pip said; the prompts in ./prompts.ts make those judgments.
 *
 * Who sees what (the "lethal trifecta" split, docs/AI_LEARNER.md):
 * - note-taker (models.pip): the student's message and what the student can already see of Pip's
 *   notebook. No answer key. Writes the text that becomes Pip's new beliefs.
 * - assessor (models.assessor): the answer key, the message and the notes. Its output goes through
 *   parseAssessorVerdict (./assessorBoundary.ts), which lets only allowlisted ids, enums and booleans
 *   through, so nothing it writes can reach the student or the reply model as text.
 * - reply (models.pip): Pip's notebook, the move and the conversation. No answer key.
 */

import type { ChatMessage, LearnerMood, LearnerReply, LearnerTurnKind } from "../../types";
import type { JsonModel } from "./llm";

/** The models a turn uses: the assessor sees the answer key; `pip` only ever sees Pip's notebook. */
export interface Models {
  assessor: JsonModel;
  pip: JsonModel;
}

/** One model for every role (tests, and setups with a single model). */
export const sameModel = (model: JsonModel): Models => ({ assessor: model, pip: model });
import { LlmError } from "./llm";
import { parseAssessorVerdict } from "./assessorBoundary";
import { applyAssessment, createNotebook, pipView, recordMove, recordVoiced } from "./notebook";
import type { ChatTurn } from "./llm";
import { assessorMessages, deviceReplyMessages, noteTakerMessages, replyMessages } from "./prompts";
import { appendHistory, recordTurn } from "./history";
import type { AssessedClaim, Assessment, AssessorVerdict, Move, Notebook, PipReply, TakenNotes, TopicPack, TurnRecord } from "./types";

/**
 * Everything the server keeps between turns for one session (`teaching_sessions.learner_state`).
 * Version 1 had no `version` field and no history; `upgradeState()` in ./server.ts reads both.
 */
export interface TeachableState {
  version: 2;
  notebook: Notebook;
  /** The last reply, so a retried request for the same student message returns it instead of re-running. */
  last: { studentMessageId: string | null; reply: LearnerReply } | null;
  /**
   * The last turn's verdict (buildAssessment: the note-taker's notes with the assessor's allowlisted
   * grades; no text the assessor wrote). Kept for retries, debugging and evaluation; never shown to
   * Pip or the student. States saved before the split may carry `analysis`/`moveNote`; upgradeState drops them.
   */
  lastAssessment: Assessment | null;
  /** What each student message changed, oldest first (./history.ts). Never shown to Pip. */
  history: TurnRecord[];
  /**
   * The first student message the history covers: 0, unless the session started
   * before history was recorded, in which case earlier turns have no record.
   */
  historyFrom: number;
  /**
   * Set between the two steps of a turn: the message was assessed (or, for the opening, there
   * was nothing to assess), and its reply hasn't been saved yet. `changed` is what the reply
   * reacts to. Absent in states saved before this field existed.
   */
  pending?: { forMessageId: string | null; changed: ReturnType<typeof pipView> } | null;
}

export function initialState(pack: TopicPack): TeachableState {
  return { version: 2, notebook: createNotebook(pack), last: null, lastAssessment: null, history: [], historyFrom: 0 };
}

/* -------------------------- Shape validation ---------------------------- */

const MOODS: LearnerMood[] = ["curious", "confused", "happy", "thinking"];
const MAX_TEXT = 600;
/** Notes per student message, and each note's length (the limits the assessor's claims had). */
export const MAX_NOTES = 3;
const MAX_NOTE_TEXT = 300;

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Coerces the note-taker's JSON. Its text is let through: it's the one call that writes Pip's new
 * notes, and it never sees the answer key. Belief ids must be taught beliefs still in the notebook.
 * Throws only if it isn't an object at all.
 */
export function parseNotes(raw: unknown, notebook: Notebook): TakenNotes {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LlmError("noteTaker: not a JSON object", true);
  const r = raw as Record<string, unknown>;
  const notes = (Array.isArray(r.notes) ? r.notes : [])
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => ({ text: str(n.text, MAX_NOTE_TEXT) }))
    .filter((n) => n.text)
    .slice(0, MAX_NOTES);
  const taught = new Set(notebook.beliefs.filter((b) => b.source === "taught" && b.status !== "corrected").map((b) => b.id));
  const revised = Array.isArray(r.revisedBeliefIds) ? r.revisedBeliefIds : [];
  return { notes, revisedBeliefIds: [...new Set(revised.filter((v): v is string => typeof v === "string" && taught.has(v)))] };
}

/**
 * The turn's verdict from the two calls: each note becomes a claim with its grade. A note graded
 * unfaithful is dropped; one with no grade stays, as "unclear" and not explained. The statement is
 * always the note-taker's text; the assessor contributes only the allowlisted values in `verdict`.
 */
export function buildAssessment(taken: TakenNotes, verdict: AssessorVerdict): Assessment {
  const claims: AssessedClaim[] = [];
  taken.notes.forEach((note, index) => {
    const grade = verdict.noteGrades.find((g) => g.index === index);
    if (grade && !grade.faithful) return;
    claims.push({
      pipStatement: note.text,
      conceptId: grade?.conceptId ?? null,
      correctness: grade?.correctness ?? "unclear",
      explained: grade?.explained ?? false,
    });
  });
  return {
    claims,
    corrections: verdict.corrections,
    nowExplainedBeliefIds: verdict.nowExplainedBeliefIds,
    revisedBeliefIds: taken.revisedBeliefIds,
    offTask: verdict.offTask,
    move: verdict.move,
    moveTarget: verdict.moveTarget,
    readyToWrapUp: verdict.readyToWrapUp,
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
export async function runOpening(args: { pack: TopicPack; state: TeachableState; models: Models }): Promise<{
  reply: LearnerReply;
  state: TeachableState;
}> {
  const { pack, state, models } = args;
  const model = models.pip;
  if (state.last && state.last.studentMessageId === null) return { reply: state.last.reply, state };
  const messages = replyMessages({
    learningGoal: pack.learningGoal,
    priorKnowledge: pack.priorKnowledge,
    notebook: state.notebook,
    messages: [],
    studentText: null,
    move: "open",
    targetStatement: null,
  });
  const reply = await callJson(model, () => model.completeJson(messages, { label: "reply", temperature: 0.8, reasoningEffort: "low", maxTokens: 500 }), parseReply);
  const notebook = recordMove(state.notebook, "open");
  const learnerReply = toLearnerReply({ pack, notebook, reply, move: "open", moveTarget: null });
  return { reply: learnerReply, state: { ...state, notebook, pending: null, last: { studentMessageId: null, reply: learnerReply }, lastAssessment: null } };
}

/** What an assessed student message leaves for the reply: the move, and the notebook Pip replies from. */
interface Assessed {
  state: TeachableState;
  /** The notebook the reply sees (before the move is recorded, as before the split). */
  replyNotebook: Notebook;
  move: Move;
  moveTarget: string | null;
  changed: ReturnType<typeof pipView>;
  studentId: string;
}

/**
 * Step 1 of a turn: the note-taker and assessor calls and the notebook update, saved as a pending
 * reply. The reply (step 2) comes from the server (`replyFromServer`) or the student's device
 * (`replyFromDevice`); either way neither call is run twice for one message.
 */
export async function assessTurn(args: {
  pack: TopicPack;
  state: TeachableState;
  messages: ChatMessage[];
  models: Models;
}): Promise<Assessed> {
  const { pack, state, messages, models } = args;
  const index = messages.length - 1;
  const student = messages[index];
  if (!student || student.role !== "student") throw new Error("A turn needs the transcript to end with a student message.");

  // Already assessed (a retry, or the device's reply never arrived): reuse it.
  const pending = state.pending;
  if (pending && pending.forMessageId === student.id && state.lastAssessment) {
    const assessment = state.lastAssessment;
    return {
      state,
      replyNotebook: state.notebook,
      move: assessment.move,
      moveTarget: assessment.moveTarget,
      changed: pending.changed,
      studentId: student.id,
    };
  }

  const history = messages.slice(0, index);
  // 1. Note-taker: what the student said, in Pip's words. Never sees the answer key.
  const taken = await callJson(
    models.pip,
    () =>
      models.pip.completeJson(
        noteTakerMessages({ learningGoal: pack.learningGoal, notebook: state.notebook, messages: history, studentText: student.text }),
        { label: "noteTaker", temperature: 0.2, reasoningEffort: "low", maxTokens: 800 },
      ),
    (raw) => parseNotes(raw, state.notebook),
  );
  // 2. Assessor: grades those notes against the answer key. Structured values only (./assessorBoundary.ts).
  const verdict = await callJson(
    models.assessor,
    () =>
      models.assessor.completeJson(
        assessorMessages({ pack, notebook: state.notebook, messages: history, studentText: student.text, notes: taken.notes, revisedBeliefIds: taken.revisedBeliefIds }),
        { label: "assessor", temperature: 0.2, reasoningEffort: "medium", maxTokens: 1500 },
      ),
    (raw) => parseAssessorVerdict(raw, { pack, notebook: state.notebook, noteCount: taken.notes.length }),
  );

  const studentIndex = messages.slice(0, index + 1).filter((m) => m.role === "student").length - 1;
  const applied = applyAssessment(state.notebook, buildAssessment(taken, verdict), pack, { index: studentIndex, messageId: student.id });
  const replyNotebook = applied.notebook;
  const assessment = applied.assessment;
  const beforeStatus = new Map(state.notebook.beliefs.map((b) => [b.id, b.status]));
  const changedIds = new Set(replyNotebook.beliefs.filter((b) => beforeStatus.get(b.id) !== b.status).map((b) => b.id));
  const changed = pipView(replyNotebook).filter((b) => changedIds.has(b.id));

  let notebook = replyNotebook;
  if (assessment.move === "voice_misconception") notebook = recordVoiced(notebook, assessment.moveTarget);
  notebook = recordMove(notebook, assessment.move);
  const record = recordTurn({ before: state.notebook, after: notebook, assessment, student: { index: studentIndex, messageId: student.id } });
  return {
    state: {
      ...state,
      notebook,
      lastAssessment: assessment,
      history: appendHistory(state.history, record),
      pending: { forMessageId: student.id, changed },
    },
    replyNotebook,
    move: assessment.move,
    moveTarget: assessment.moveTarget,
    changed,
    studentId: student.id,
  };
}

function finish(pack: TopicPack, a: { state: TeachableState; move: Move; moveTarget: string | null; studentId: string | null }, reply: PipReply) {
  const learnerReply = toLearnerReply({ pack, notebook: a.state.notebook, reply, move: a.move, moveTarget: a.moveTarget });
  return { reply: learnerReply, state: { ...a.state, pending: null, last: { studentMessageId: a.studentId, reply: learnerReply } } };
}

/**
 * Step 2 on the server: the reply model, from the notebook only. It gets the move, the fixed
 * guide for that move and the target belief's statement from the notebook: nothing the assessor wrote.
 */
export async function replyFromServer(args: { pack: TopicPack; assessed: Assessed; messages: ChatMessage[]; models: Models }) {
  const { pack, assessed, messages, models } = args;
  const student = messages.at(-1)!;
  const target = assessed.replyNotebook.beliefs.find((b) => b.id === assessed.moveTarget || b.misconceptionId === assessed.moveTarget);
  const reply = await callJson(
    models.pip,
    () =>
      models.pip.completeJson(
        replyMessages({
          learningGoal: pack.learningGoal,
          priorKnowledge: pack.priorKnowledge,
          notebook: assessed.replyNotebook,
          messages: messages.slice(0, -1),
          studentText: student.text,
          move: assessed.move,
          targetStatement: target?.statement ?? null,
          changed: assessed.changed,
        }),
        // Applying a rule is arithmetic: a bit more thought keeps it to the rule as taught.
        { label: "reply", temperature: 0.8, reasoningEffort: assessed.move === "try_to_apply" ? "medium" : "low", maxTokens: 700 },
      ),
    parseReply,
  );
  return finish(pack, assessed, reply);
}

/** Pip's reply to one student message. Three model calls: note-taker, assessor, reply. */
export async function runTurn(args: {
  pack: TopicPack;
  state: TeachableState;
  /** The whole transcript, ending with the student's message. */
  messages: ChatMessage[];
  models: Models;
}): Promise<{ reply: LearnerReply; state: TeachableState }> {
  const { pack, state, messages, models } = args;
  const student = messages.at(-1);
  // Retried request for a message already answered: return the same reply.
  if (student && state.last?.studentMessageId === student.id) return { reply: state.last.reply, state };
  const assessed = await assessTurn({ pack, state, messages, models });
  return replyFromServer({ pack, assessed, messages, models });
}

/* ---------------------------- On-device reply --------------------------- */

/**
 * Step 1 for an on-device reply: assess (or, for the opening, nothing to assess), save the
 * pending reply, and return the prompt for the device model. It sees Pip's notebook only.
 */
export async function prepareDeviceTurn(args: {
  pack: TopicPack;
  state: TeachableState;
  messages: ChatMessage[];
  models: Models;
}): Promise<{ state: TeachableState; prompt: ChatTurn[]; forMessageId: string | null }> {
  const { pack, state, messages, models } = args;
  if (!pack.device) throw new Error(`Topic "${pack.topicId}" has no on-device prompt.`);
  if (messages.length === 0) {
    return {
      state: { ...state, pending: { forMessageId: null, changed: [] } },
      prompt: deviceReplyMessages({ device: pack.device, notebook: state.notebook, studentText: null }),
      forMessageId: null,
    };
  }
  const assessed = await assessTurn({ pack, state, messages, models });
  const student = messages.at(-1)!;
  return {
    state: assessed.state,
    // The notebook after the move is recorded, so a misconception Pip voices this turn is in its notes.
    prompt: deviceReplyMessages({ device: pack.device, notebook: assessed.state.notebook, studentText: student.text, messages: messages.slice(0, -1) }),
    forMessageId: student.id,
  };
}

/** Step 2 from the device: Pip's text, written on the student's device, becomes the reply. */
export function replyFromDevice(args: { pack: TopicPack; state: TeachableState; text: string }): { reply: LearnerReply; state: TeachableState } {
  const { pack, state, text } = args;
  const pending = state.pending;
  if (!pending) throw new Error("No reply is pending.");
  const opening = pending.forMessageId === null;
  const notebook = opening ? recordMove(state.notebook, "open") : state.notebook;
  const move: Move = opening ? "open" : (state.lastAssessment?.move ?? "admit_confusion");
  const moveTarget = opening ? null : (state.lastAssessment?.moveTarget ?? null);
  return finish(pack, { state: { ...state, notebook }, move, moveTarget, studentId: pending.forMessageId }, { mood: "curious", text });
}
