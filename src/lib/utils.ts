import type { ChatMessage, SessionSummary, TeachingSession } from "./types";

export function createId(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
