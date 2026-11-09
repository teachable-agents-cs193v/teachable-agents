import type { Subject, SubjectId } from "./types";

export const SUBJECTS: Subject[] = [
  { id: "probability", label: "Probability", accent: "#254d3c", accentSoft: "#dde9dc" },
  { id: "economics", label: "Economics", accent: "#b2654d", accentSoft: "#f6e2d8" },
  { id: "biology", label: "Biology", accent: "#4e7a3f", accentSoft: "#e2eed6" },
  { id: "computer-science", label: "Computer Science", accent: "#3e5d86", accentSoft: "#dfe7f2" },
  { id: "psychology", label: "Psychology", accent: "#7d4b6a", accentSoft: "#efe0ea" },
];

export function getSubject(id: SubjectId): Subject {
  const subject = SUBJECTS.find((s) => s.id === id);
  if (!subject) throw new Error(`Unknown subject: ${id}`);
  return subject;
}

/** CSS custom properties consumed by the `accent-*` utilities in globals.css. */
export function accentStyle(subject: Subject): React.CSSProperties {
  return {
    "--accent": subject.accent,
    "--accent-soft": subject.accentSoft,
  } as React.CSSProperties;
}
