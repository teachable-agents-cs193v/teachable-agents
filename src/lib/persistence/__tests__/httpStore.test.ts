import { describe, expect, it, vi } from "vitest";
import type { TeachingSession } from "../../types";
import { HttpSessionStore, SessionStoreError } from "../httpStore";

const session: TeachingSession = {
  id: "session_1",
  topicId: "recursion",
  learnerId: "pip",
  status: "in_progress",
  startedAt: "2026-01-01T00:00:00.000Z",
  messages: [],
  learnerCursor: 0,
};

function storeReturning(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!);
  return { store: new HttpSessionStore("/api/sessions", fetchImpl), fetchImpl };
}

describe("HttpSessionStore", () => {
  it("reads a session, and treats 404 as missing", async () => {
    const { store, fetchImpl } = storeReturning(Response.json(session), new Response(null, { status: 404 }));
    expect(await store.getSession("session_1")).toEqual(session);
    expect(await store.getSession("a/b?c")).toBeNull();
    expect(fetchImpl.mock.calls[1][0]).toBe("/api/sessions/a%2Fb%3Fc");
  });

  it("creates through POST and finds the active session through the list route", async () => {
    const { store, fetchImpl } = storeReturning(Response.json(session, { status: 201 }), Response.json({ sessions: [session] }));
    expect(await store.createSession("recursion", "guess")).toEqual(session);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ topicId: "recursion", preExplanation: "guess" }) });
    expect(await store.findActiveSession("recursion")).toEqual(session);
    expect(fetchImpl.mock.calls[1][0]).toBe("/api/sessions?activeTopicId=recursion");
  });

  it("sends only the changeable fields when saving", async () => {
    const { store, fetchImpl } = storeReturning(Response.json(session));
    await store.saveSession({ ...session, preExplanation: "fixed at creation" });
    const body = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
    expect(Object.keys(body).sort()).toEqual(["learnerCursor", "messages", "status"]);
  });

  it("shows students a friendly message, never the server's error", async () => {
    const { store } = storeReturning(
      Response.json({ error: "relation teaching_sessions does not exist" }, { status: 500 }),
      Response.json({ error: "Not logged in." }, { status: 401 }),
    );
    await expect(store.listSessions()).rejects.toThrow(/couldn't be saved or loaded/);
    await expect(store.saveSession(session)).rejects.toThrow(/logged out/);
  });

  it("reports a network failure as a SessionStoreError", async () => {
    const store = new HttpSessionStore("/api/sessions", (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch);
    await expect(store.listSessions()).rejects.toBeInstanceOf(SessionStoreError);
  });
});
