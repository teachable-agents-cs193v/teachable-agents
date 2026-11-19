import type { SessionReflection, TeachingSession } from "../types";

/**
 * The fields of a session the browser may change: ending it, and the reflection.
 * Everything else is fixed when the server creates the session (id, owner, topic,
 * learner, start time, pre-session explanation) or written only by the server's
 * turn route (the transcript and the learner's cursor), so the stored record is
 * what actually happened.
 */
export type SessionUpdate = Pick<TeachingSession, "status" | "endedAt" | "reflection">;

/** Rejects request bodies bigger than this (a long transcript is well under it). */
export const MAX_BODY_BYTES = 1_000_000;

const MAX_TEXT = 20_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length <= max;

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

function parseReflection(v: unknown): SessionReflection | null {
  if (!isObject(v)) return null;
  const { postExplanation, confidence, hardestToExplain, misconceptionReflection, noticedGap, noticedGapDetail, freeReflection, submittedAt } = v;
  if (![postExplanation, hardestToExplain, misconceptionReflection, noticedGapDetail, freeReflection].every((t) => isText(t))) return null;
  if (!(Number.isInteger(confidence) && (confidence as number) >= 1 && (confidence as number) <= 5)) return null;
  if (!oneOf(noticedGap, ["yes", "no", "unsure"] as const) || !isIsoDate(submittedAt)) return null;
  return { postExplanation, confidence, hardestToExplain, misconceptionReflection, noticedGap, noticedGapDetail, freeReflection, submittedAt } as SessionReflection;
}

/** Longest student message for one turn. Keeps one message from using up a free tier's per-minute token limit. */
export const MAX_TURN_TEXT = 1_500;

const CLIENT_MESSAGE_ID = /^[\w-]{1,100}$/;

/**
 * Body of POST /api/sessions/[id]/turn.
 * - `{ clientMessageId, text }`: the student's new message. The browser picks the id,
 *   so retrying the same request never adds the message twice.
 * - `{}`: answer whatever is waiting (Pip's opening, or a student message Pip hasn't answered).
 */
export interface TurnRequest {
  clientMessageId: string | null;
  text: string | null;
  /** "device": the browser will write Pip's reply on the student's device (POST /device-reply). */
  replyOn: "server" | "device";
}

export function parseTurnRequest(body: unknown): Result<TurnRequest> {
  if (!isObject(body)) return { ok: false, error: "Expected a JSON object." };
  const { clientMessageId, text } = body;
  if (body.replyOn !== undefined && body.replyOn !== "server" && body.replyOn !== "device") return { ok: false, error: "Invalid replyOn." };
  const replyOn = body.replyOn === "device" ? "device" : "server";
  if (clientMessageId === undefined && text === undefined) return { ok: true, value: { clientMessageId: null, text: null, replyOn } };
  if (typeof clientMessageId !== "string" || !CLIENT_MESSAGE_ID.test(clientMessageId)) {
    return { ok: false, error: "Invalid clientMessageId." };
  }
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Message can't be empty." };
  if (text.trim().length > MAX_TURN_TEXT) return { ok: false, error: `Messages can be at most ${MAX_TURN_TEXT} characters.` };
  return { ok: true, value: { clientMessageId, text: text.trim(), replyOn } };
}

/** The longest reply a device may save for Pip (its model is asked for one to three sentences). */
export const MAX_DEVICE_REPLY = 1_200;

export interface DeviceReply {
  /** The student message this answers, or null for Pip's opening. */
  forMessageId: string | null;
  text: string;
}

/** Checks a POST /api/sessions/[id]/device-reply body. */
export function parseDeviceReply(body: unknown): Result<DeviceReply> {
  if (!isObject(body)) return { ok: false, error: "Expected a JSON object." };
  const { forMessageId, text } = body;
  if (forMessageId !== null && (typeof forMessageId !== "string" || !CLIENT_MESSAGE_ID.test(forMessageId))) {
    return { ok: false, error: "Invalid forMessageId." };
  }
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Reply can't be empty." };
  if (text.trim().length > MAX_DEVICE_REPLY) return { ok: false, error: `Replies can be at most ${MAX_DEVICE_REPLY} characters.` };
  return { ok: true, value: { forMessageId, text: text.trim() } };
}

/**
 * Checks a PUT /api/sessions/[id] body. Unknown fields (id, userId, topicId, and
 * the transcript: messages, learnerCursor) are ignored, never stored.
 */
export function parseSessionUpdate(body: unknown): Result<SessionUpdate> {
  if (!isObject(body)) return { ok: false, error: "Expected a JSON object." };
  const { status, endedAt, reflection } = body;
  if (!oneOf(status, ["in_progress", "completed"] as const)) return { ok: false, error: "Invalid status." };
  if (endedAt !== undefined && endedAt !== null && !isIsoDate(endedAt)) return { ok: false, error: "Invalid endedAt." };
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
      reflection: parsedReflection,
    },
  };
}
