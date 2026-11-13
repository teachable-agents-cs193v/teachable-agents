import { requireApiUser } from "@/lib/auth/server";
import { LlmError } from "@/lib/learner/teachable/llm";
import { learnerTurn, modelFromEnv, TurnConflictError } from "@/lib/learner/teachable/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { error, json, notFound } from "../../shared";

/**
 * POST /api/sessions/[id]/turn → { reply: LearnerReply, learner: { id, displayName } }
 *
 * Works out Pip's next message from the session as saved on the server, so the
 * browser can't change what Pip "knows". The browser saves the student's
 * message first (PUT), then calls this, then saves Pip's reply (PUT).
 * Retrying after a failure is safe: the same student message gets the same reply.
 * Another user's session answers 404, like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

const BUSY = "Pip is having trouble thinking right now. Wait a moment and try again.";

export async function POST(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const store = getUserSessionStore(user);
  const id = (await params).id;
  const session = await store.getSession(id);
  if (!session) return notFound();
  if (session.status !== "in_progress") return error("This session has ended.", 409);

  try {
    const storedState = await store.getLearnerState(id);
    const { reply, learner, state } = await learnerTurn({ session, storedState, model: modelFromEnv() });
    if (state) await store.saveLearnerState(id, state);
    return json({ reply, learner });
  } catch (cause) {
    if (cause instanceof TurnConflictError) return error(cause.message, 409);
    // Log the reason for us; the student only ever sees the friendly message (#22).
    console.error(`[turn] session ${id}:`, cause instanceof Error ? cause.message : cause);
    return error(BUSY, cause instanceof LlmError ? 503 : 500);
  }
}
