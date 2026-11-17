import type { LearnerReply, LearningProgress, LearningReview, StudentBelief, TeachingSession } from "../types";

type Fetch = typeof fetch;

/** Shown when the server gives no student-safe message (never the raw error, #22). */
const FALLBACK = "Pip couldn't respond. Check your connection and try again.";
/** For any server error. The server's own text is only trusted for 4xx answers, which are written for students. */
const BUSY = "Pip is having trouble thinking right now. Wait a moment and try again.";
const LOGGED_OUT = "You've been logged out. Log in again to keep going.";

/** The student's new message, or `{}` to have Pip answer whatever is waiting (its opening, or an unanswered message). */
export type TurnBody = { clientMessageId: string; text: string } | Record<string, never>;

export interface TurnResponse {
  /** The session as the server saved it: the source of truth for the transcript. */
  session: TeachingSession;
  /** Null when the request had already been answered (a retry after a lost response). */
  reply: LearnerReply | null;
  learner: { id: string; displayName: string } | null;
  /** What Pip believes now, as the student may see it. Null for the scripted learner. */
  pip: StudentBelief[] | null;
  /** Learning metrics and timeline, as the student may see them. Null for the scripted learner. */
  progress: LearningProgress | null;
}

/** A failed turn. `message` is always safe to show a student; `session` is the server's copy when it sent one. */
export class TurnError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly session?: TeachingSession,
  ) {
    super(message);
    this.name = "TurnError";
  }
}

/**
 * Asks the server for Pip's next turn (POST /api/sessions/[id]/turn). The
 * server saves the student's message and Pip's reply itself, so the browser
 * never writes the transcript. Sending the same body again is always safe.
 */
export async function postTurn(sessionId: string, body: TurnBody, fetchImpl: Fetch = (...args) => fetch(...args)): Promise<TurnResponse> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/turn`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new TurnError(FALLBACK, 0);
  }
  const data = (await res.json().catch(() => null)) as (Partial<TurnResponse> & { error?: string }) | null;
  if (!res.ok || !data?.session) {
    const message = res.status === 401 ? LOGGED_OUT : res.status >= 500 ? BUSY : (data?.error ?? FALLBACK);
    throw new TurnError(message, res.status, data?.session);
  }
  return {
    session: data.session,
    reply: data.reply ?? null,
    learner: data.learner ?? null,
    pip: data.pip ?? null,
    progress: data.progress ?? null,
  };
}

/**
 * What Pip believes right now (GET /api/sessions/[id]/pip), for the beliefs panel
 * after a reload. Null for the scripted learner, or if it can't be loaded: the
 * panel is extra, so a failure here never blocks teaching.
 */
export async function getPipBeliefs(sessionId: string, fetchImpl: Fetch = (...args) => fetch(...args)): Promise<StudentBelief[] | null> {
  try {
    const res = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/pip`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { pip?: StudentBelief[] | null }).pip ?? null;
  } catch {
    return null;
  }
}

/**
 * Learning metrics and timeline (GET /api/sessions/[id]/progress), for the
 * progress panels after a reload. Null for the scripted learner, or if it can't
 * be loaded: like the beliefs panel, it never blocks teaching.
 */
export async function getLearningProgress(sessionId: string, fetchImpl: Fetch = (...args) => fetch(...args)): Promise<LearningProgress | null> {
  try {
    const res = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/progress`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { progress?: LearningProgress | null }).progress ?? null;
  } catch {
    return null;
  }
}

/**
 * The end-of-session review (GET /api/sessions/[id]/review). Null for the
 * scripted learner, for a session that hasn't ended (the server answers 409),
 * or if it can't be loaded: the reflection page works without it.
 */
export async function getLearningReview(sessionId: string, fetchImpl: Fetch = (...args) => fetch(...args)): Promise<LearningReview | null> {
  try {
    const res = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/review`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { review?: LearningReview | null }).review ?? null;
  } catch {
    return null;
  }
}
