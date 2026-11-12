// /api/sessions against the throwaway Postgres, with real Better Auth sessions:
// next/headers is mocked to send each test's cookie. Covers #17's acceptance
// criteria: server-chosen IDs and owner, 404 for another user's session, and
// lists scoped to the current user.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/pool";
import { hasDb, sessionCookie, signUp } from "@/lib/auth/__tests__/testHelpers";
import type { TeachingSession } from "@/lib/types";
import { GET as list, POST as create } from "../route";
import { DELETE as remove, GET as get, PUT as put } from "../[id]/route";

vi.mock("@/lib/auth/pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/pwned")>()),
  isPwned: vi.fn(async () => false),
}));

let requestCookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));
beforeEach(() => {
  requestCookie = undefined;
});

const TOPIC = "independence-vs-mutual-exclusivity";
const URL_BASE = "http://localhost:3000/api/sessions";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (method: string, body: unknown, url = URL_BASE) =>
  new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function newStudent() {
  const { res } = await signUp();
  return sessionCookie(res);
}

async function as<T>(cookie: string, fn: () => Promise<T>): Promise<T> {
  requestCookie = cookie;
  return fn();
}

async function startSession(cookie: string, body: Record<string, unknown> = { topicId: TOPIC }) {
  const res = await as(cookie, () => create(jsonRequest("POST", body)));
  expect(res.status).toBe(201);
  return (await res.json()) as TeachingSession;
}

const update = (s: TeachingSession, changes: Partial<TeachingSession> = {}) => {
  const { status, endedAt, messages, learnerCursor, reflection } = { ...s, ...changes };
  return { status, endedAt, messages, learnerCursor, reflection };
};

describe("logged out", () => {
  it("every route answers 401", async () => {
    expect((await list(new Request(URL_BASE))).status).toBe(401);
    expect((await create(jsonRequest("POST", { topicId: TOPIC }))).status).toBe(401);
    expect((await get(new Request(`${URL_BASE}/x`), ctx("x"))).status).toBe(401);
    expect((await put(jsonRequest("PUT", {}), ctx("x"))).status).toBe(401);
    expect((await remove(new Request(`${URL_BASE}/x`, { method: "DELETE" }), ctx("x"))).status).toBe(401);
  });
});

describe.skipIf(!hasDb)("/api/sessions", () => {
  it("creates a session with a server-chosen id and owner, ignoring ids from the body", async () => {
    const cookie = await newStudent();
    const session = await startSession(cookie, {
      topicId: TOPIC,
      preExplanation: "  my guess  ",
      id: "session_chosen-by-browser",
      userId: "someone-else",
    });
    expect(session.id).toMatch(/^session_[0-9a-f-]{36}$/);
    expect(session).toMatchObject({ topicId: TOPIC, status: "in_progress", messages: [], learnerCursor: 0, preExplanation: "my guess" });

    const { rows } = await getPool().query("select user_id from teaching_sessions where id = $1", [session.id]);
    const me = await as(cookie, async () => (await (await list(new Request(URL_BASE))).json()).sessions);
    expect(me.map((s: TeachingSession) => s.id)).toEqual([session.id]);
    expect(rows[0].user_id).not.toBe("someone-else");
    expect((await getPool().query("select 1 from teaching_sessions where id = 'session_chosen-by-browser'")).rowCount).toBe(0);
  });

  it("rejects unknown topics, non-JSON bodies and invalid updates", async () => {
    const cookie = await newStudent();
    expect((await as(cookie, () => create(jsonRequest("POST", { topicId: "not-a-topic" })))).status).toBe(400);
    const form = new Request(URL_BASE, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "topicId=x" });
    expect((await as(cookie, () => create(form))).status).toBe(415);

    const s = await startSession(cookie);
    const bad = [
      { ...update(s), status: "archived" },
      { ...update(s), learnerCursor: -1 },
      { ...update(s), messages: [{ id: "m", role: "teacher", text: "hi", createdAt: new Date().toISOString() }] },
      { ...update(s), reflection: { confidence: 9 } },
    ];
    for (const body of bad) expect((await as(cookie, () => put(jsonRequest("PUT", body), ctx(s.id)))).status).toBe(400);
  });

  it("saves a transcript and reflection, and finds the active session for a topic", async () => {
    const cookie = await newStudent();
    const older = await startSession(cookie);
    const newer = await startSession(cookie);
    const message = { id: "msg_1", role: "student" as const, text: "Independent means…", createdAt: new Date().toISOString() };

    const res = await as(cookie, () => put(jsonRequest("PUT", update(newer, { messages: [message], learnerCursor: 1 })), ctx(newer.id)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: newer.id, messages: [message], learnerCursor: 1 });

    const active = await as(cookie, () => list(new Request(`${URL_BASE}?activeTopicId=${TOPIC}`)));
    expect((await active.json()).sessions.map((s: TeachingSession) => s.id)).toEqual([newer.id]);

    const reflection = {
      postExplanation: "P(A and B) = P(A)P(B)",
      confidence: 4,
      hardestToExplain: "disjoint vs independent",
      misconceptionReflection: "yes",
      noticedGap: "yes",
      noticedGapDetail: "",
      freeReflection: "",
      submittedAt: new Date().toISOString(),
    };
    const endedAt = new Date().toISOString();
    await as(cookie, () => put(jsonRequest("PUT", update(newer, { status: "completed", endedAt, messages: [message], learnerCursor: 1, reflection: reflection as TeachingSession["reflection"] })), ctx(newer.id)));
    const saved = (await (await as(cookie, () => get(new Request(`${URL_BASE}/${newer.id}`), ctx(newer.id)))).json()) as TeachingSession;
    expect(saved).toMatchObject({ status: "completed", endedAt, reflection });

    const nowActive = await as(cookie, () => list(new Request(`${URL_BASE}?activeTopicId=${TOPIC}`)));
    expect((await nowActive.json()).sessions.map((s: TeachingSession) => s.id)).toEqual([older.id]);
  });

  it("user B can't see, change or delete user A's session, and A's data is unchanged", async () => {
    const alice = await newStudent();
    const bob = await newStudent();
    const aliceSession = await startSession(alice, { topicId: TOPIC, preExplanation: "Alice's notes" });
    const before = (await getPool().query("select * from teaching_sessions where id = $1", [aliceSession.id])).rows[0];

    const id = aliceSession.id;
    const hijack = update(aliceSession, { status: "completed", messages: [] , learnerCursor: 99 });
    expect((await as(bob, () => get(new Request(`${URL_BASE}/${id}`), ctx(id)))).status).toBe(404);
    expect((await as(bob, () => put(jsonRequest("PUT", hijack), ctx(id)))).status).toBe(404);
    expect((await as(bob, () => remove(new Request(`${URL_BASE}/${id}`, { method: "DELETE" }), ctx(id)))).status).toBe(404);
    // Missing and foreign look the same, so ids can't be probed.
    expect((await as(bob, () => get(new Request(`${URL_BASE}/session_missing`), ctx("session_missing")))).status).toBe(404);

    const bobList = await as(bob, () => list(new Request(URL_BASE)));
    expect((await bobList.json()).sessions).toEqual([]);
    const bobActive = await as(bob, () => list(new Request(`${URL_BASE}?activeTopicId=${TOPIC}`)));
    expect((await bobActive.json()).sessions).toEqual([]);

    const after = (await getPool().query("select * from teaching_sessions where id = $1", [id])).rows[0];
    expect(after).toEqual(before);
    expect((await as(alice, () => get(new Request(`${URL_BASE}/${id}`), ctx(id)))).status).toBe(200);
  });

  it("deletes the owner's session", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    expect((await as(cookie, () => remove(new Request(`${URL_BASE}/${s.id}`, { method: "DELETE" }), ctx(s.id)))).status).toBe(204);
    expect((await as(cookie, () => get(new Request(`${URL_BASE}/${s.id}`), ctx(s.id)))).status).toBe(404);
  });

  it("deleting a user deletes their sessions", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    await getPool().query("delete from users where id = (select user_id from teaching_sessions where id = $1)", [s.id]);
    expect((await getPool().query("select 1 from teaching_sessions where id = $1", [s.id])).rowCount).toBe(0);
  });
});
