import type { Subject, SubjectId } from "./types";

/**
 * Subject accents stay inside the green family so every page reads as one
 * product (style tile: no unrelated accent colors). Depth comes from the
 * shade, and the subject doodle does the rest of the telling-apart.
 */
export const SUBJECTS: Subject[] = [
  { id: "probability", label: "Probability", accent: "#204f3e", accentSoft: "#dde9df" },
  { id: "economics", label: "Economics", accent: "#4d8b6a", accentSoft: "#e3efe6" },
  { id: "biology", label: "Biology", accent: "#3f7558", accentSoft: "#e0ecd9" },
  { id: "computer-science", label: "Computer Science", accent: "#2d5f4b", accentSoft: "#dbe9e1" },
  { id: "psychology", label: "Psychology", accent: "#5f8f6c", accentSoft: "#e7f0e4" },
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
