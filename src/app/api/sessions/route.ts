import { requireApiUser } from "@/lib/auth/server";
import { getUserSessionStore } from "@/lib/persistence/server";
import { getTopic } from "@/lib/topics";
import { error, json, readJson } from "./shared";

/**
 * GET  /api/sessions                    → { sessions }: the user's sessions, newest first
 * GET  /api/sessions?activeTopicId=<id> → { sessions }: the in-progress session for a topic (0 or 1)
 * POST /api/sessions { topicId, preExplanation?, learner? } → 201 with the new session.
 *      learner: "ai" (AI Pip, the student agreed to send this session to the AI provider) or
 *      "offline" (the scripted demo, nothing sent). Missing means "offline": AI is opt-in.
 *      Stored as the session's learnerId and fixed from then on (src/lib/aiData.ts).
 */
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const store = getUserSessionStore(user);
  const topicId = new URL(request.url).searchParams.get("activeTopicId");
  if (topicId !== null) {
    const active = await store.findActiveSession(topicId);
    return json({ sessions: active ? [active] : [] });
  }
  return json({ sessions: await store.listSessions() });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const read = await readJson(request);
  if (read instanceof Response) return read;
  const { topicId, preExplanation, learner = "offline" } = (read.body ?? {}) as Record<string, unknown>;
  if (typeof topicId !== "string" || !getTopic(topicId)) return error("Unknown topic.", 400);
  if (preExplanation !== undefined && (typeof preExplanation !== "string" || preExplanation.length > 20_000)) {
    return error("Invalid preExplanation.", 400);
  }
  if (learner !== "ai" && learner !== "offline") return error("Invalid learner.", 400);

  // Any id or user id in the body is ignored: the server picks both.
  const session = await getUserSessionStore(user).createSession(topicId, preExplanation, learner);
  return json(session, 201);
}
