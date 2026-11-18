import { requireApiUser } from "@/lib/auth/server";
import { deviceExperiment, runDeviceReply } from "@/lib/learner/teachable/turnService";
import { getUserSessionStore } from "@/lib/persistence/server";
import { parseDeviceReply } from "@/lib/persistence/validate";
import { error, json, readJson } from "../../shared";

/**
 * POST /api/sessions/[id]/device-reply
 *   { forMessageId, text } → saves the reply the student's device wrote for Pip, after
 *   POST /turn with replyOn "device" returned `device: { forMessageId, messages }`.
 * → { session, reply, learner, pip, progress }
 *
 * The server already assessed the message and updated Pip's notebook; this only adds Pip's
 * words, tagged `generatedOn: "device"`. A reply for any other message answers 409.
 */
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!deviceExperiment()) return error("Not found.", 404); // an experiment; off for students
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const read = await readJson(request);
  if (read instanceof Response) return read;
  const parsed = parseDeviceReply(read.body);
  if (!parsed.ok) return error(parsed.error, 400);
  const id = (await params).id;
  const result = await runDeviceReply({ store: getUserSessionStore(user), id, body: parsed.value });
  if (!result.ok) return json({ error: result.error, ...(result.session ? { session: result.session } : {}) }, result.status);
  return json({ session: result.session, reply: result.reply, learner: result.learner, pip: result.pip, progress: result.progress });
}
