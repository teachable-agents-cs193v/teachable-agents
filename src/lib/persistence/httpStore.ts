import type { TeachingSession } from "../types";
import type { SessionStore } from "./adapter";

type Fetch = typeof fetch;

/** Messages a student may see; the raw server error is never shown (#22). */
const MESSAGES = {
  401: "You've been logged out. Log in again to keep going.",
  default: "Your session couldn't be saved or loaded. Check your connection and try again.",
} as const;

export class SessionStoreError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? MESSAGES[401] : MESSAGES.default);
    this.name = "SessionStoreError";
  }
}

/**
 * The browser's session store: calls /api/sessions, where the server scopes every
 * read and write to the logged-in user. Components use it through
 * `getSessionStore()` and don't know it's remote.
 */
export class HttpSessionStore implements SessionStore {
  readonly id = "http";

  constructor(
    private readonly base = "/api/sessions",
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        ...init,
        cache: "no-store",
        headers: init.body ? { "content-type": "application/json" } : undefined,
      });
    } catch {
      throw new SessionStoreError(0); // offline or the server is unreachable
    }
    return res;
  }

  private async json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new SessionStoreError(res.status);
    return (await res.json()) as T;
  }

  async listSessions(): Promise<TeachingSession[]> {
    return (await this.json<{ sessions: TeachingSession[] }>(await this.request(""))).sessions;
  }

  async getSession(id: string): Promise<TeachingSession | null> {
    const res = await this.request(`/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return this.json<TeachingSession>(res);
  }

  async findActiveSession(topicId: string): Promise<TeachingSession | null> {
    const res = await this.request(`?activeTopicId=${encodeURIComponent(topicId)}`);
    return (await this.json<{ sessions: TeachingSession[] }>(res)).sessions[0] ?? null;
  }

  async createSession(topicId: string, preExplanation?: string): Promise<TeachingSession> {
    const res = await this.request("", { method: "POST", body: JSON.stringify({ topicId, preExplanation }) });
    return this.json<TeachingSession>(res);
  }

  async saveSession(session: TeachingSession): Promise<void> {
    const { status, endedAt, messages, learnerCursor, reflection } = session;
    const res = await this.request(`/${encodeURIComponent(session.id)}`, {
      method: "PUT",
      body: JSON.stringify({ status, endedAt, messages, learnerCursor, reflection }),
    });
    if (!res.ok) throw new SessionStoreError(res.status);
  }

  async deleteSession(id: string): Promise<void> {
    const res = await this.request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new SessionStoreError(res.status);
  }
}
