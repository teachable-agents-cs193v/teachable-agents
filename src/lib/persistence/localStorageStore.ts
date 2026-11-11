import { PIP } from "../learner";
import type { TeachingSession } from "../types";
import { createId, nowIso } from "../utils";
import type { SessionStore } from "./adapter";

export const STORAGE_KEY = "teachable-agents:sessions:v1";

/** Minimal subset of the Web Storage API we rely on (makes testing simple). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function resolveStorage(): KeyValueStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const probe = "__teachable_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // Private mode or blocked storage: fall back to memory for this tab.
  }
  return new MemoryStorage();
}

/**
 * Demo persistence backed by localStorage (with an in-memory fallback).
 * Sessions live only in this browser. Replace via `getSessionStore()`.
 */
export class LocalStorageSessionStore implements SessionStore {
  readonly id = "local-storage";
  private storage: KeyValueStorage | null;

  constructor(storage?: KeyValueStorage) {
    this.storage = storage ?? null;
  }

  private get store(): KeyValueStorage {
    if (!this.storage) this.storage = resolveStorage();
    return this.storage;
  }

  private readAll(): TeachingSession[] {
    try {
      const raw = this.store.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TeachingSession[]) : [];
    } catch {
      return [];
    }
  }

  private writeAll(sessions: TeachingSession[]): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  async listSessions(): Promise<TeachingSession[]> {
    return this.readAll().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getSession(id: string): Promise<TeachingSession | null> {
    return this.readAll().find((s) => s.id === id) ?? null;
  }

  async createSession(topicId: string, preExplanation?: string): Promise<TeachingSession> {
    const session: TeachingSession = {
      id: createId("session"),
      topicId,
      learnerId: PIP.id,
      status: "in_progress",
      startedAt: nowIso(),
      messages: [],
      learnerCursor: 0,
      preExplanation: preExplanation?.trim() || undefined,
    };
    await this.saveSession(session);
    return session;
  }

  async saveSession(session: TeachingSession): Promise<void> {
    const sessions = this.readAll();
    const index = sessions.findIndex((s) => s.id === session.id);
    const copy = structuredClone(session);
    if (index === -1) sessions.push(copy);
    else sessions[index] = copy;
    this.writeAll(sessions);
  }

  async deleteSession(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((s) => s.id !== id));
  }

  async findActiveSession(topicId: string): Promise<TeachingSession | null> {
    const active = (await this.listSessions()).filter(
      (s) => s.topicId === topicId && s.status === "in_progress",
    );
    return active[0] ?? null;
  }
}
