import "server-only";
import { getUserSessionStore } from "@/lib/persistence/server";
import type { AuthUser, TeachingSession } from "@/lib/types";

/**
 * The logged-in student's sessions for a server-rendered page, or null when
 * the database couldn't be reached (the page then shows a retry state instead
 * of crashing). Reads go through the same user-scoped store as the API.
 */
export async function loadSessions(user: AuthUser, page: string): Promise<TeachingSession[] | null> {
  try {
    return await getUserSessionStore(user).listSessions();
  } catch (error) {
    console.error(`${page}: couldn't list sessions:`, error);
    return null;
  }
}
