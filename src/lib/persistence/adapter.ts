import type { LearnerMode } from "../aiData";
import type { TeachingSession } from "../types";

/**
 * Integration point for session persistence (owned by Betania).
 *
 * The UI treats this as an async store so a database-backed implementation
 * can be dropped in without touching components. Methods should resolve with
 * copies, never shared mutable references.
 */
export interface SessionStore {
  readonly id: string;
  listSessions(): Promise<TeachingSession[]>;
  getSession(id: string): Promise<TeachingSession | null>;
  /** Creates and stores a new in-progress session. The store chooses its ID. `mode`: AI Pip or the offline demo. */
  createSession(topicId: string, preExplanation?: string, mode?: LearnerMode): Promise<TeachingSession>;
  /** Updates an existing session. Database-backed stores never create one here. */
  saveSession(session: TeachingSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  /** Most recent in-progress session for a topic, if any. */
  findActiveSession(topicId: string): Promise<TeachingSession | null>;
}
