import { requireApiUser } from "@/lib/auth/server";
import { studentView } from "@/lib/learner/teachable/notebook";
import { notebookOf } from "@/lib/learner/teachable/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { json, notFound } from "../../shared";

/**
 * GET /api/sessions/[id]/pip → { pip: StudentBelief[] | null }
 *
 * What Pip believes right now, as the student may see it (the beliefs panel),
 * so the panel survives a reload. Same view as the turn route returns: never the
 * hidden verdicts or the answer key. Null when the session uses the scripted learner.
 * Another user's session answers 404, like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const context = await getUserSessionStore(user).getTurnContext((await params).id);
  if (!context) return notFound();
  const notebook = notebookOf(context.learnerState, context.session.topicId);
  return json({ pip: notebook ? studentView(notebook) : null });
}
