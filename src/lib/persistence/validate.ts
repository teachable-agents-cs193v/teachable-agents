import type { ChatMessage, SessionReflection, TeachingSession } from "../types";

/**
 * The fields of a session the browser may change. Everything else (id, owner,
 * topic, learner, start time, pre-session explanation) is fixed when the server
 * creates the session.
 */
export type SessionUpdate = Pick<TeachingSession, "status" | "endedAt" | "messages" | "learnerCursor" | "reflection">;

/** Rejects request bodies bigger than this (a long transcript is well under it). */
export const MAX_BODY_BYTES = 1_000_000;

const MAX_TEXT = 20_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length <= max;
const optionalText = (v: unknown, max = MAX_TEXT) => v === undefined || isText(v, max);
/** Postgres `integer` max; learner_cursor is an integer column. */
export const MAX_LEARNER_CURSOR = 2_147_483_647;

// Full ISO-8601 timestamps only, e.g. 2026-11-12T02:48:47.123Z or ...+05:30. Date.parse
// alone accepts "2026" and rolls 2026-02-30 over to March, both of which Postgres rejects.
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
const isIsoDate = (v: unknown): v is string => {
  const m = typeof v === "string" ? ISO_TIMESTAMP.exec(v) : null;
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => options.includes(v as T);

const ROLES = ["student", "learner"] as const;
const KINDS = ["opening", "question", "misconception", "realization", "closing"] as const;
const MOODS = ["curious", "confused", "happy", "thinking"] as const;

function parseMessage(v: unknown): ChatMessage | null {
  if (!isObject(v)) return null;
  const { id, role, text, createdAt, kind, concept, misconception, mood } = v;
  if (!isText(id, 200) || !oneOf(role, ROLES) || !isText(text) || !isIsoDate(createdAt)) return null;
  if (kind !== undefined && !oneOf(kind, KINDS)) return null;
  if (mood !== undefined && !oneOf(mood, MOODS)) return null;
  if (!optionalText(concept, 500) || !optionalText(misconception, 500)) return null;
  // Rebuild the object so unknown keys are dropped rather than stored.
  return { id, role, text, createdAt, kind, concept, misconception, mood } as ChatMessage;
}

function parseReflection(v: unknown): SessionReflection | null {
  if (!isObject(v)) return null;
  const { postExplanation, confidence, hardestToExplain, misconceptionReflection, noticedGap, noticedGapDetail, freeReflection, submittedAt } = v;
  if (![postExplanation, hardestToExplain, misconceptionReflection, noticedGapDetail, freeReflection].every((t) => isText(t))) return null;
  if (!(Number.isInteger(confidence) && (confidence as number) >= 1 && (confidence as number) <= 5)) return null;
  if (!oneOf(noticedGap, ["yes", "no", "unsure"] as const) || !isIsoDate(submittedAt)) return null;
  return { postExplanation, confidence, hardestToExplain, misconceptionReflection, noticedGap, noticedGapDetail, freeReflection, submittedAt } as SessionReflection;
}

/** Checks a PUT /api/sessions/[id] body. Unknown fields (id, userId, topicId, ...) are ignored. */
export function parseSessionUpdate(body: unknown): Result<SessionUpdate> {
  if (!isObject(body)) return { ok: false, error: "Expected a JSON object." };
  const { status, endedAt, messages, learnerCursor, reflection } = body;
  if (!oneOf(status, ["in_progress", "completed"] as const)) return { ok: false, error: "Invalid status." };
  if (endedAt !== undefined && endedAt !== null && !isIsoDate(endedAt)) return { ok: false, error: "Invalid endedAt." };
  if (!Number.isInteger(learnerCursor) || (learnerCursor as number) < 0 || (learnerCursor as number) > MAX_LEARNER_CURSOR) {
    return { ok: false, error: "Invalid learnerCursor." };
  }
  if (!Array.isArray(messages) || messages.length > 1_000) return { ok: false, error: "Invalid messages." };
  const parsedMessages = messages.map(parseMessage);
  if (parsedMessages.some((m) => m === null)) return { ok: false, error: "Invalid message." };
  let parsedReflection: SessionReflection | undefined;
  if (reflection !== undefined && reflection !== null) {
    const r = parseReflection(reflection);
    if (!r) return { ok: false, error: "Invalid reflection." };
    parsedReflection = r;
  }
  return {
    ok: true,
    value: {
      status,
      endedAt: (endedAt as string | null | undefined) ?? undefined,
      messages: parsedMessages as ChatMessage[],
      learnerCursor: learnerCursor as number,
      reflection: parsedReflection,
    },
  };
}
