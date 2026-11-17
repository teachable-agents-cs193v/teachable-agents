import { requireApiUser } from "@/lib/auth/server";
import { buildProgress } from "@/lib/learner/teachable/progress";
import { upgradeState } from "@/lib/learner/teachable/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { json, notFound } from "../../shared";

/**
 * GET /api/sessions/[id]/progress → { progress: LearningProgress | null }
 *
 * Learning metrics and the turn-by-turn timeline, as the student may see them
 * during a session: no correctness verdicts, no answer key, and no misconception
 * Pip hasn't voiced yet (the same rules as GET /pip). Each turn response carries
 * the same object; this is for after a reload. Null for the scripted learner.
 * Another user's session answers 404, like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const context = await getUserSessionStore(user).getTurnContext((await params).id);
  if (!context) return notFound();
  const state = upgradeState(context.learnerState, context.session.topicId);
  return json({ progress: state ? buildProgress(state) : null });
}
