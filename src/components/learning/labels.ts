/**
 * Words and colours for the learning panels, in one place so they're easy to
 * restyle or reword. Tones are the existing Badge tones (src/components/ui/Badge.tsx).
 */
import type { StudentBelief, TaughtCorrectness, TimelineEvent } from "@/lib/types";

type Tone = "sage" | "butter" | "leaf" | "forest" | "neutral";

export const BELIEF_STATUS: Record<StudentBelief["status"], { label: string; hint: string; tone: Tone }> = {
  heard: { label: "Heard it", hint: "You said it, but haven't said why yet", tone: "butter" },
  understood: { label: "Gets why", hint: "You explained why, or gave an example", tone: "sage" },
  believes: { label: "Still believes", hint: "Pip started out thinking this", tone: "leaf" },
  changed_mind: { label: "Changed its mind", hint: "Your explanation changed Pip's mind", tone: "forest" },
};

/** Order the beliefs panel groups by: what needs attention first. */
export const STATUS_ORDER: StudentBelief["status"][] = ["believes", "heard", "understood", "changed_mind"];

export const CORRECTNESS: Record<TaughtCorrectness, { label: string; tone: Tone }> = {
  correct: { label: "Correct", tone: "sage" },
  partly: { label: "Partly right", tone: "butter" },
  incorrect: { label: "Not right", tone: "leaf" },
  unclear: { label: "Unclear", tone: "neutral" },
};

/** Student messages are numbered from 1 on screen; the data counts from 0. */
export const messageLabel = (turn: number) => `message ${turn + 1}`;

export function eventLabel(event: TimelineEvent): string {
  switch (event.type) {
    case "learned":
      return event.status === "understood" ? "Pip learned, with your reason" : "Pip heard";
    case "explained":
      return "You explained why";
    case "voiced":
      return "Pip said what it believes";
    case "changed_mind":
      return "Pip changed its mind";
    case "taken_back":
      return "You took something back";
  }
}

export const EVENT_DOT: Record<TimelineEvent["type"], string> = {
  learned: "bg-butter-deep",
  explained: "bg-sage-deep",
  voiced: "bg-leaf",
  changed_mind: "bg-forest",
  taken_back: "bg-line",
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
