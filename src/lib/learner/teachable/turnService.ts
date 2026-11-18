import "server-only";
import type { PostgresSessionStore } from "../../persistence/server";
import type { DeviceReply, TurnRequest } from "../../persistence/validate";
import type { ChatMessage, LearnerReply, LearningProgress, StudentBelief, TeachingSession } from "../../types";
import { learnerMessageFrom, nowIso } from "../../utils";
import type { Models } from "./pipeline";
import { studentView } from "./notebook";
import { buildProgress } from "./progress";
import type { ChatTurn } from "./llm";
import { getTopicPack } from "./packs";
import { replyFromDevice } from "./pipeline";
import { deviceTurn, learnerTurn, notebookOf, TEACHABLE, upgradeState, type LearnerInfo } from "./server";

export type TurnResult =
  | {
      ok: true;
      session: TeachingSession;
      /** Null when this request was already answered (a retry after a lost response): the session holds the reply. */
      reply: LearnerReply | null;
      learner: LearnerInfo | null;
      /** What Pip believes now, as the student may see it. Null for the scripted learner. */
      pip: StudentBelief[] | null;
      /** Learning metrics and timeline, as the student may see them. Null for the scripted learner. */
      progress: LearningProgress | null;
      /**
       * Set when the browser asked to write Pip's reply on the device (replyOn "device") and this
       * topic supports it: the prompt for the device model (Pip's notebook only, no answer key).
       * Post the result to /device-reply. Absent means the server already replied.
       */
      device?: DeviceTurn;
    }
  | { ok: false; status: 404 | 409; error: string; session?: TeachingSession };

/** On-device Pip is an experiment, off unless DEVICE_PIP_EXPERIMENT=1; off, the server always replies. */
export const deviceExperiment = () => process.env.DEVICE_PIP_EXPERIMENT === "1";

export interface DeviceTurn {
  forMessageId: string | null;
  messages: ChatTurn[];
}

const CHANGED = "This session changed in another tab or window. Reload to see the latest.";

/**
 * One turn, worked out and saved entirely on the server, so the stored
 * transcript is what actually happened:
 *
 * 1. The student's message is saved before any model call. If the model then
 *    fails, it stays saved, and retrying (the same request, or `{}`) answers it.
 * 2. Pip's reply, cursor and learner state are saved together.
 *
 * Both writes are conditional on the version read before them, so two tabs (or
 * a double click) can't interleave turns: the loser gets a 409 and the session.
 * Retrying with the same `clientMessageId` never adds the message twice.
 * Errors from the model are thrown for the route to report.
 */
export async function runServerTurn(args: {
  store: PostgresSessionStore;
  id: string;
  request: TurnRequest;
  models: Models | null;
}): Promise<TurnResult> {
  const { store, id, request, models } = args;
  const context = await store.getTurnContext(id);
  if (!context) return { ok: false, status: 404, error: "Not found." };
  let { session, version } = context;
  if (session.status !== "in_progress") return { ok: false, status: 409, error: "This session has ended.", session };

  const last = session.messages.at(-1);
  if (request.text !== null && request.clientMessageId !== null) {
    const index = session.messages.findIndex((m) => m.id === request.clientMessageId);
    const existing = session.messages[index];
    if (existing) {
      if (existing.role !== "student" || existing.text !== request.text) {
        return { ok: false, status: 409, error: "That message id was already used.", session };
      }
      // Already answered: the browser lost the response. Nothing to redo.
      if (index < session.messages.length - 1) {
        const stored = upgradeState(context.learnerState, session.topicId);
        return {
          ok: true,
          session,
          reply: null,
          learner: null,
          pip: stored ? studentView(stored.notebook) : null,
          progress: stored ? buildProgress(stored) : null,
        };
      }
    } else {
      if (last?.role === "student") {
        return { ok: false, status: 409, error: "Pip hasn't answered your last message yet.", session };
      }
      const message: ChatMessage = { id: request.clientMessageId, role: "student", text: request.text, createdAt: nowIso() };
      const saved = await store.appendToSession(id, { version, append: [message] });
      if (saved === null) return { ok: false, status: 404, error: "Not found." };
      if (saved === "conflict") return conflict(store, id);
      ({ session, version } = saved);
    }
  } else if (last?.role === "learner") {
    return { ok: false, status: 409, error: "There's no student message for Pip to reply to.", session };
  }

  if (request.replyOn === "device" && deviceExperiment()) {
    const device = await deviceTurn({ session, storedState: context.learnerState, models });
    if (device) {
      const saved = await store.appendToSession(id, { version, append: [], learnerState: device.state });
      if (saved === null) return { ok: false, status: 404, error: "Not found." };
      if (saved === "conflict") return conflict(store, id);
      return {
        ok: true,
        session: saved.session,
        reply: null,
        learner: TEACHABLE,
        pip: studentView(device.state.notebook, notebookOf(context.learnerState, session.topicId)),
        progress: buildProgress(device.state),
        device: { forMessageId: device.forMessageId, messages: device.prompt },
      };
    }
  }

  const { reply, learner, state } = await learnerTurn({ session, storedState: context.learnerState, models });
  const saved = await store.appendToSession(id, {
    version,
    append: [learnerMessageFrom(reply)],
    learnerCursor: reply.nextCursor,
    ...(state ? { learnerState: state } : {}),
  });
  if (saved === null) return { ok: false, status: 404, error: "Not found." };
  if (saved === "conflict") return conflict(store, id);
  const before = notebookOf(context.learnerState, session.topicId);
  return {
    ok: true,
    session: saved.session,
    reply,
    learner,
    pip: state ? studentView(state.notebook, before) : null,
    progress: state ? buildProgress(state) : null,
  };
}

/**
 * Step 2 of an on-device turn: saves the reply the device wrote for the pending message.
 * Only the reply the server asked for is accepted: the text must answer the message it was
 * prepared for, and the notebook is the server's, so the device can only change Pip's wording.
 */
export async function runDeviceReply(args: { store: PostgresSessionStore; id: string; body: DeviceReply }): Promise<TurnResult> {
  const { store, id, body } = args;
  const context = await store.getTurnContext(id);
  if (!context) return { ok: false, status: 404, error: "Not found." };
  const { session, version } = context;
  if (session.status !== "in_progress") return { ok: false, status: 409, error: "This session has ended.", session };
  const pack = getTopicPack(session.topicId);
  const state = upgradeState(context.learnerState, session.topicId);
  const pending = state?.pending;
  const last = session.messages.at(-1);
  const waiting =
    pending &&
    body.forMessageId === pending.forMessageId &&
    (pending.forMessageId === null ? session.messages.length === 0 : last?.role === "student" && last.id === pending.forMessageId);
  if (!pack || !state || !waiting) return { ok: false, status: 409, error: "No reply is waiting for this message.", session };

  const { reply, state: next } = replyFromDevice({ pack, state, text: body.text });
  const message: ChatMessage = { ...learnerMessageFrom(reply), generatedOn: "device" };
  const saved = await store.appendToSession(id, { version, append: [message], learnerCursor: reply.nextCursor, learnerState: next });
  if (saved === null) return { ok: false, status: 404, error: "Not found." };
  if (saved === "conflict") return conflict(store, id);
  return { ok: true, session: saved.session, reply, learner: TEACHABLE, pip: studentView(next.notebook), progress: buildProgress(next) };
}

async function conflict(store: PostgresSessionStore, id: string): Promise<TurnResult> {
  const latest = await store.getTurnContext(id);
  return { ok: false, status: 409, error: CHANGED, session: latest?.session };
}
