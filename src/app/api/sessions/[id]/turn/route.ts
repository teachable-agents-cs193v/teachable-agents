import { requireApiUser } from "@/lib/auth/server";
import { LlmError } from "@/lib/learner/teachable/llm";
import { modelsFromEnv } from "@/lib/learner/teachable/server";
import { runServerTurn } from "@/lib/learner/teachable/turnService";
import { getUserSessionStore } from "@/lib/persistence/server";
import { parseTurnRequest } from "@/lib/persistence/validate";
import { error, json, readJson } from "../../shared";

/**
 * POST /api/sessions/[id]/turn
 *   { clientMessageId, text } → saves the student's message, then Pip's reply
 *   {}                        → Pip's opening, or a reply to a saved message Pip hasn't answered
 *   { ..., replyOn: "device" } → assesses, then returns `device: { forMessageId, messages }` instead of
 *                            a reply, when the topic has an on-device Pip (POST /device-reply next)
 * → { session, reply, learner, pip, progress, device? }
 *   pip: what Pip believes, as the student may see it; progress: learning metrics and timeline
 *   (LearningProgress, same hiding rules). Both null for the scripted learner.
 *
 * The server writes the whole transcript, so the stored record is what actually
 * happened and the browser can't change what Pip "knows". Retrying a request is
 * safe: the same clientMessageId is never saved or answered twice.
 * Another user's session answers 404, like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

/** A turn can wait out a per-minute rate limit (see llm.ts), so allow more than the default. */
export const maxDuration = 60;

const BUSY = "Pip is having trouble thinking right now. Wait a moment and try again.";

export async function POST(request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const read = await readJson(request);
  if (read instanceof Response) return read;
  const parsed = parseTurnRequest(read.body);
  if (!parsed.ok) return error(parsed.error, 400);

  const id = (await params).id;
  try {
    const result = await runServerTurn({ store: getUserSessionStore(user), id, request: parsed.value, models: modelsFromEnv() });
    if (!result.ok) return json({ error: result.error, ...(result.session ? { session: result.session } : {}) }, result.status);
    return json({
      session: result.session,
      reply: result.reply,
      learner: result.learner,
      pip: result.pip,
      progress: result.progress,
      ...(result.device ? { device: result.device } : {}),
    });
  } catch (cause) {
    // Log the reason for us; the student only ever sees the friendly message (#22).
    console.error(`[turn] session ${id}:`, cause instanceof Error ? cause.message : cause);
    return error(BUSY, cause instanceof LlmError ? 503 : 500);
  }
}
