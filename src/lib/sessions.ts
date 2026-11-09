import { PIP } from "./learner";
import { getSessionStore } from "./persistence";
import type { TeachingSession } from "./types";
import { createId, nowIso } from "./utils";

export function buildSession(topicId: string, preExplanation?: string): TeachingSession {
  return {
    id: createId("session"),
    topicId,
    learnerId: PIP.id,
    status: "in_progress",
    startedAt: nowIso(),
    messages: [],
    learnerCursor: 0,
    preExplanation: preExplanation?.trim() || undefined,
  };
}

/** Creates and persists a fresh session, returning it. */
export async function startSession(topicId: string, preExplanation?: string): Promise<TeachingSession> {
  const session = buildSession(topicId, preExplanation);
  await getSessionStore().saveSession(session);
  return session;
}
