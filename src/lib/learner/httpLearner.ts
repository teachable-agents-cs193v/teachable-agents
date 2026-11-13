import type { LearnerReply } from "../types";
import type { LearnerAdapter, LearnerContext } from "./adapter";

type Fetch = typeof fetch;

/** Shown when the server gives no student-safe message (never the raw error, #22). */
const FALLBACK = "Pip couldn't respond. Check your connection and try again.";

/**
 * The browser's learner: asks POST /api/sessions/[id]/turn for Pip's next
 * message. The server holds the model key and Pip's notebook, and falls back to
 * the scripted demo learner when no model is configured. The reply says which
 * learner answered (`reply.learner`).
 */
export class HttpLearnerAdapter implements LearnerAdapter {
  readonly id = "http";
  readonly displayName = "Pip";

  constructor(
    private readonly base = "/api/sessions",
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  open(context: LearnerContext): Promise<LearnerReply> {
    return this.turn(context);
  }

  respond(context: LearnerContext): Promise<LearnerReply> {
    return this.turn(context);
  }

  private async turn(context: LearnerContext): Promise<LearnerReply> {
    if (!context.sessionId) throw new Error(FALLBACK);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/${encodeURIComponent(context.sessionId)}/turn`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch {
      throw new Error(FALLBACK);
    }
    const body = (await res.json().catch(() => null)) as
      | { reply?: LearnerReply; learner?: LearnerReply["learner"]; error?: string }
      | null;
    if (!res.ok || !body?.reply) {
      throw new Error(res.status === 401 ? "You've been logged out. Log in again to keep going." : (body?.error ?? FALLBACK));
    }
    return { ...body.reply, learner: body.learner };
  }
}
