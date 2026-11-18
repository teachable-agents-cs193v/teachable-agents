import { requireApiUser } from "@/lib/auth/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { parseSessionUpdate } from "@/lib/persistence/validate";
import { error, json, notFound, NO_STORE, readJson } from "../shared";

/**
 * GET    /api/sessions/[id] → the session
 * PUT    /api/sessions/[id] { status, endedAt?, messages, learnerCursor, reflection? } → the updated session
 * DELETE /api/sessions/[id] → 204
 *
 * Another user's session answers 404, exactly like a missing one (docs/AUTH.md).
 */
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const session = await getUserSessionStore(user).getSession((await params).id);
  return session ? json(session) : notFound();
}

export async function PUT(request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const read = await readJson(request);
  if (read instanceof Response) return read;
  const update = parseSessionUpdate(read.body);
  if (!update.ok) return error(update.error, 400);

  const session = await getUserSessionStore(user).updateSession((await params).id, update.value);
  return session ? json(session) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const deleted = await getUserSessionStore(user).deleteOwnSession((await params).id);
  return deleted ? new Response(null, { status: 204, headers: NO_STORE }) : notFound();
}
