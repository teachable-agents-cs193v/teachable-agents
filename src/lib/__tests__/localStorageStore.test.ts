import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageSessionStore, STORAGE_KEY, type KeyValueStorage } from "../persistence/localStorageStore";
import { buildSession } from "../sessions";

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("LocalStorageSessionStore", () => {
  let storage: FakeStorage;
  let store: LocalStorageSessionStore;

  beforeEach(() => {
    storage = new FakeStorage();
    store = new LocalStorageSessionStore(storage);
  });

  it("starts empty", async () => {
    expect(await store.listSessions()).toEqual([]);
    expect(await store.getSession("nope")).toBeNull();
  });

  it("saves, reads back, and updates a session", async () => {
    const session = buildSession("recursion", "  my first guess  ");
    expect(session.preExplanation).toBe("my first guess");
    await store.saveSession(session);
    expect(await store.getSession(session.id)).toEqual(session);

    await store.saveSession({ ...session, status: "completed", endedAt: "2026-01-01T00:00:00.000Z" });
    const all = await store.listSessions();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("completed");
  });

  it("lists newest first and finds the active session for a topic", async () => {
    const older = { ...buildSession("recursion"), startedAt: "2026-01-01T00:00:00.000Z" };
    const newer = { ...buildSession("recursion"), startedAt: "2026-02-01T00:00:00.000Z" };
    const done = { ...buildSession("recursion"), status: "completed" as const, startedAt: "2026-03-01T00:00:00.000Z" };
    await store.saveSession(older);
    await store.saveSession(newer);
    await store.saveSession(done);

    expect((await store.listSessions()).map((s) => s.id)).toEqual([done.id, newer.id, older.id]);
    expect((await store.findActiveSession("recursion"))?.id).toBe(newer.id);
    expect(await store.findActiveSession("photosynthesis")).toBeNull();
  });

  it("deletes a session", async () => {
    const session = buildSession("photosynthesis");
    await store.saveSession(session);
    await store.deleteSession(session.id);
    expect(await store.listSessions()).toEqual([]);
  });

  it("survives corrupted storage", async () => {
    storage.setItem(STORAGE_KEY, "{not json");
    expect(await store.listSessions()).toEqual([]);
  });

  it("stores copies, not references", async () => {
    const session = buildSession("recursion");
    await store.saveSession(session);
    session.messages.push({ id: "x", role: "student", text: "mutated", createdAt: "now" });
    expect((await store.getSession(session.id))?.messages).toHaveLength(0);
  });
});
