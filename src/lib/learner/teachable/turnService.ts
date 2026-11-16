import "server-only";
import type { PostgresSessionStore } from "../../persistence/server";
import type { TurnRequest } from "../../persistence/validate";
import type { ChatMessage, LearnerReply, TeachingSession } from "../../types";
import { learnerMessageFrom, nowIso } from "../../utils";
import type { Models } from "./pipeline";
import { learnerTurn, type LearnerInfo } from "./server";

export type TurnResult =
  | {
      ok: true;
      session: TeachingSession;
      /** Null when this request was already answered (a retry after a lost response): the session holds the reply. */
      reply: LearnerReply | null;
      learner: LearnerInfo | null;
    }
  | { ok: false; status: 404 | 409; error: string; session?: TeachingSession };

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
      if (index < session.messages.length - 1) return { ok: true, session, reply: null, learner: null };
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

  const { reply, learner, state } = await learnerTurn({ session, storedState: context.learnerState, models });
  const saved = await store.appendToSession(id, {
    version,
    append: [learnerMessageFrom(reply)],
    learnerCursor: reply.nextCursor,
    ...(state ? { learnerState: state } : {}),
  });
  if (saved === null) return { ok: false, status: 404, error: "Not found." };
  if (saved === "conflict") return conflict(store, id);
  return { ok: true, session: saved.session, reply, learner };
}

async function conflict(store: PostgresSessionStore, id: string): Promise<TurnResult> {
  const latest = await store.getTurnContext(id);
  return { ok: false, status: 409, error: CHANGED, session: latest?.session };
}
