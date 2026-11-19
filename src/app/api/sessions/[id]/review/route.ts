import { requireApiUser } from "@/lib/auth/server";
import { getTopicPack } from "@/lib/learner/teachable/packs";
import { buildReview } from "@/lib/learner/teachable/progress";
import { upgradeState } from "@/lib/learner/teachable/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { error, json, notFound } from "../../shared";

/**
 * GET /api/sessions/[id]/review → { review: LearningReview | null }
 *
 * The end-of-session picture: which of Pip's misconceptions were corrected or
 * are still held, what the student taught and the assessor's verdict on whether
 * it was correct, and the full timeline. Correctness is revealed only here, so
 * it answers 409 until the session is completed. It never includes the answer
 * key itself. Null for the scripted learner.
 * Another user's session answers 404, like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const context = await getUserSessionStore(user).getTurnContext((await params).id);
  if (!context) return notFound();
  const { session, learnerState } = context;
  if (session.status !== "completed") return error("The review is ready once the session has ended.", 409);

  const pack = getTopicPack(session.topicId);
  const state = pack ? upgradeState(learnerState, pack.topicId) : null;
  return json({ review: pack && state ? buildReview(state, pack) : null });
}
