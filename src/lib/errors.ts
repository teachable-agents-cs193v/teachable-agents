/**
 * Errors whose message was written for students and is safe to show on screen (#22).
 *
 * Throw (or extend) this when you have a friendly message for the UI. Any other
 * error's message may contain server or library details, so screens never show it:
 * they go through `studentMessage()`, which falls back to a generic message instead.
 */
export class StudentFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentFacingError";
  }
}

/**
 * The message to show a student for `error`: its own message if it's a
 * StudentFacingError, otherwise `fallback`. Unexpected errors are logged to the
 * console for debugging but never shown in the UI.
 */
export function studentMessage(error: unknown, fallback: string): string {
  if (error instanceof StudentFacingError) return error.message;
  console.error(error);
  return fallback;
}
