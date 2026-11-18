import type { ChatMessage, SessionSummary, TeachingSession } from "./types";

/**
 * A random v4 UUID from the platform's secure generator, never Math.random (#19).
 * `crypto.randomUUID` only exists in secure contexts (HTTPS and localhost), so on
 * plain HTTP it's built from `crypto.getRandomValues`, which exists everywhere.
 */
function secureUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  if (!c?.getRandomValues) throw new Error("No secure random number generator is available.");
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function createId(prefix = ""): string {
  const raw = secureUuid();
  return prefix ? `${prefix}_${raw}` : raw;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "In progress";
  if (minutes < 1) return "Under a minute";
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Unique, order-preserving list of a field across learner messages. */
function collect(messages: ChatMessage[], key: "concept" | "misconception"): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of messages) {
    const value = m.role === "learner" ? m[key] : undefined;
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/**
 * Builds the observed summary of a session from its messages. Nothing here
 * claims the student learned anything; it only counts and lists what happened.
 */
export function summarizeSession(session: TeachingSession): SessionSummary {
  const studentMessages = session.messages.filter((m) => m.role === "student").length;
  const learnerMessages = session.messages.filter((m) => m.role === "learner").length;
  const durationMinutes = session.endedAt
    ? Math.max(
        0,
        Math.round(
          (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000,
        ),
      )
    : null;
  return {
    studentMessages,
    learnerMessages,
    totalMessages: studentMessages + learnerMessages,
    durationMinutes,
    concepts: collect(session.messages, "concept"),
    misconceptions: collect(session.messages, "misconception"),
  };
}
