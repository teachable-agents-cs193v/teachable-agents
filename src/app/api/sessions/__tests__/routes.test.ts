// /api/sessions against the throwaway Postgres, with real Better Auth sessions:
// next/headers is mocked to send each test's cookie. Covers #17's acceptance
// criteria: server-chosen IDs and owner, 404 for another user's session, and
// lists scoped to the current user.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/pool";
import { decryptField } from "@/lib/crypto/fieldEncryption";
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

const TOPIC = "derivatives";
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
  const { status, endedAt, reflection } = { ...s, ...changes };
  return { status, endedAt, reflection };
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
      { ...update(s), reflection: { confidence: 9 } },
    ];
    for (const body of bad) expect((await as(cookie, () => put(jsonRequest("PUT", body), ctx(s.id)))).status).toBe(400);
  });

  // #33: values Postgres would reject must be a 400 from validation, never a 500.
  it("answers 400 for values the database can't store", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    const bad = [
      { ...update(s), status: "completed", endedAt: "2026" },
      { ...update(s), status: "completed", endedAt: "1000" },
      { ...update(s), status: "completed", endedAt: "2026-02-30T00:00:00Z" },
    ];
    for (const body of bad) {
      const res = await as(cookie, () => put(jsonRequest("PUT", body), ctx(s.id)));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const ok = { ...update(s), status: "completed", endedAt: "2026-11-12T02:48:47+05:30" };
    expect((await as(cookie, () => put(jsonRequest("PUT", ok), ctx(s.id)))).status).toBe(200);
  });

  it("limits bodies by bytes, not characters", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    // 600k two-byte characters: under the limit in characters, over it in bytes.
    const body = { ...update(s), messages: [{ id: "m", role: "student", text: "é".repeat(600_000), createdAt: new Date().toISOString() }] };
    const req = new Request(`${URL_BASE}/${s.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await as(cookie, () => put(req, ctx(s.id)))).status).toBe(413);
    const declared = new Request(`${URL_BASE}/${s.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": "5000000" },
      body: "{}",
    });
    expect((await as(cookie, () => put(declared, ctx(s.id)))).status).toBe(413);
  });

  it("never lets PUT change the transcript: only the turn route writes it", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    const forged = { id: "msg_1", role: "learner" as const, text: "Pip never said this", createdAt: new Date().toISOString() };
    const res = await as(cookie, () => put(jsonRequest("PUT", { ...update(s), messages: [forged], learnerCursor: 7 }), ctx(s.id)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: s.id, messages: [], learnerCursor: 0 });
    const { rows } = await getPool().query("select user_id, messages, learner_cursor from teaching_sessions where id = $1", [s.id]);
    expect(JSON.parse(decryptField(rows[0].user_id, "messages", rows[0].messages))).toEqual([]);
    expect(rows[0].learner_cursor).toBe(0);
  });

  it("never reopens a completed session (its review is open), but still saves it again", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    const endedAt = new Date().toISOString();
    expect((await as(cookie, () => put(jsonRequest("PUT", update(s, { status: "completed", endedAt })), ctx(s.id)))).status).toBe(200);
    const reopen = await as(cookie, () => put(jsonRequest("PUT", update(s, { status: "in_progress", endedAt: undefined })), ctx(s.id)));
    expect(reopen.status).toBe(409);
    const again = await as(cookie, () => put(jsonRequest("PUT", update(s, { status: "completed", endedAt })), ctx(s.id)));
    expect(again.status).toBe(200);
    const { rows } = await getPool().query("select status from teaching_sessions where id = $1", [s.id]);
    expect(rows[0].status).toBe("completed");
  });

  it("saves the reflection, and finds the active session for a topic", async () => {
    const cookie = await newStudent();
    const older = await startSession(cookie);
    const newer = await startSession(cookie);

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
    await as(cookie, () => put(jsonRequest("PUT", update(newer, { status: "completed", endedAt, reflection: reflection as TeachingSession["reflection"] })), ctx(newer.id)));
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
    const hijack = { ...update(aliceSession, { status: "completed" }), messages: [], learnerCursor: 99 };
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

// Only Derivatives is offered; the other topics are hidden (src/lib/topics.ts).
describe.skipIf(!hasDb)("hidden topics", () => {
  const HIDDEN = "independence-vs-mutual-exclusivity";

  it("can't start a new session", async () => {
    const cookie = await newStudent();
    const res = await as(cookie, () => create(jsonRequest("POST", { topicId: HIDDEN })));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "That lesson isn't available right now." });
    expect((await (await as(cookie, () => list(new Request(URL_BASE)))).json()).sessions).toEqual([]);
  });

  it("an existing session on one still lists, opens, saves and deletes", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    // A session started before the topic was hidden.
    await getPool().query("update teaching_sessions set topic_id = $2 where id = $1", [s.id, HIDDEN]);

    const listed = (await (await as(cookie, () => list(new Request(URL_BASE)))).json()).sessions as TeachingSession[];
    expect(listed.map((x) => [x.id, x.topicId])).toEqual([[s.id, HIDDEN]]);
    const opened = await as(cookie, () => get(new Request(`${URL_BASE}/${s.id}`), ctx(s.id)));
    expect(opened.status).toBe(200);
    expect((await opened.json()).topicId).toBe(HIDDEN);
    const ended = await as(cookie, () => put(jsonRequest("PUT", update(s, { status: "completed", endedAt: new Date().toISOString() })), ctx(s.id)));
    expect(ended.status).toBe(200);
    expect((await as(cookie, () => remove(new Request(`${URL_BASE}/${s.id}`, { method: "DELETE" }), ctx(s.id)))).status).toBe(204);
  });
});

// User-written session data is encrypted at rest (db/migrations/0003_*, 0004_*).
// The transcript and learner state written by /turn are covered in turn.test.ts.
describe.skipIf(!hasDb)("encryption at rest", () => {
  const raw = async (id: string) =>
    (await getPool().query("select messages, pre_explanation, reflection from teaching_sessions where id = $1", [id])).rows[0];

  it("stores the transcript, pre-explanation and reflection encrypted, and returns them decrypted", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie, { topicId: TOPIC, preExplanation: "my secret guess" });
    expect((await raw(s.id)).messages).toMatch(/^v1:/); // even the empty transcript

    const reflection = {
      postExplanation: "my secret reflection",
      confidence: 3,
      hardestToExplain: "",
      misconceptionReflection: "yes",
      noticedGap: "no",
      noticedGapDetail: "",
      freeReflection: "",
      submittedAt: new Date().toISOString(),
    };
    const body = update(s, { status: "completed", endedAt: new Date().toISOString(), reflection: reflection as TeachingSession["reflection"] });
    expect((await as(cookie, () => put(jsonRequest("PUT", body), ctx(s.id)))).status).toBe(200);

    const row = await raw(s.id);
    for (const value of Object.values(row)) {
      expect(value).toMatch(/^v1:/);
      expect(value).not.toContain("secret");
    }
    const saved = (await (await as(cookie, () => get(new Request(`${URL_BASE}/${s.id}`), ctx(s.id)))).json()) as TeachingSession;
    expect(saved).toMatchObject({ messages: [], preExplanation: "my secret guess", reflection });
  });

  it("can't decrypt a value copied into another user's session", async () => {
    const alice = await newStudent();
    const bob = await newStudent();
    const aliceSession = await startSession(alice, { topicId: TOPIC, preExplanation: "Alice's notes" });
    const bobSession = await startSession(bob);
    // Someone with database access copies Alice's encrypted notes into Bob's row.
    await getPool().query(
      "update teaching_sessions set pre_explanation = (select pre_explanation from teaching_sessions where id = $1) where id = $2",
      [aliceSession.id, bobSession.id],
    );
    await expect(as(bob, () => get(new Request(`${URL_BASE}/${bobSession.id}`), ctx(bobSession.id)))).rejects.toThrow(
      "Could not decrypt pre_explanation.",
    );
  });

  // #52: one bad row mustn't hide the student's other sessions.
  it("leaves an undecryptable session out of the list, logs its id, and still lists the rest", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const alice = await newStudent();
    const bob = await newStudent();
    const good = await startSession(alice);
    const bad = await startSession(alice);
    // Simulate tampering: Bob's encrypted transcript can't be decrypted as Alice's.
    const bobSession = await startSession(bob);
    await getPool().query(
      "update teaching_sessions set messages = (select messages from teaching_sessions where id = $1) where id = $2",
      [bobSession.id, bad.id],
    );

    const res = await as(alice, () => list(new Request(URL_BASE)));
    expect(res.status).toBe(200);
    expect((await res.json()).sessions.map((s: TeachingSession) => s.id)).toEqual([good.id]);
    expect(log).toHaveBeenCalledWith(`[sessions] skipped session ${bad.id}: Could not decrypt messages.`);
    // Opening that one session directly still fails loudly rather than returning bad data.
    await expect(as(alice, () => get(new Request(`${URL_BASE}/${bad.id}`), ctx(bad.id)))).rejects.toThrow("Could not decrypt messages.");
    log.mockRestore();
  });

  it("still fails the whole list when the encryption key is missing", async () => {
    const cookie = await newStudent();
    await startSession(cookie);
    vi.stubEnv("ENCRYPTION_MASTER_KEY", undefined);
    try {
      await expect(as(cookie, () => list(new Request(URL_BASE)))).rejects.toThrow("ENCRYPTION_MASTER_KEY is not set.");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses plaintext written straight to the database", async () => {
    const cookie = await newStudent();
    const s = await startSession(cookie);
    for (const sql of [
      "update teaching_sessions set messages = '[]' where id = $1",
      "update teaching_sessions set pre_explanation = 'plain notes' where id = $1",
      `update teaching_sessions set reflection = '{"confidence":3}' where id = $1`,
      `update teaching_sessions set learner_state = '{"notebook":{}}' where id = $1`,
    ]) {
      await expect(getPool().query(sql, [s.id]), sql).rejects.toThrow(/violates check constraint/);
    }
  });

  describe("rate limits (#58)", () => {
    /** Fills the user's current windows for `action`, so the next request is over the limit. */
    async function useUpLimit(sessionId: string, action: string) {
      const { rows } = await getPool().query("select user_id from teaching_sessions where id = $1", [sessionId]);
      await getPool().query(
        `update rate_limit_counts set count = 100000 where user_id = $1 and action = $2`,
        [rows[0].user_id, action],
      );
    }

    it("refuses new sessions over the limit with a friendly 429, and creates nothing", async () => {
      const cookie = await newStudent();
      const first = await startSession(cookie);
      await useUpLimit(first.id, "session_create");

      const res = await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC })));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toMatchObject({ code: "rate_limited", error: expect.stringMatching(/too often/) });
      expect(Number(res.headers.get("retry-after"))).toBe(body.retryAfterSeconds);
      expect(body.retryAfterSeconds).toBeGreaterThan(0);
      const sessions = await as(cookie, async () => (await (await list(new Request(URL_BASE))).json()).sessions);
      expect(sessions).toHaveLength(1);
    });

    it("refuses updates over the limit, and leaves the session unchanged", async () => {
      const cookie = await newStudent();
      const s = await startSession(cookie);
      expect((await as(cookie, () => put(jsonRequest("PUT", update(s)), ctx(s.id)))).status).toBe(200);
      await useUpLimit(s.id, "session_update");

      const ended = update(s, { status: "completed", endedAt: new Date().toISOString() });
      const res = await as(cookie, () => put(jsonRequest("PUT", ended), ctx(s.id)));
      expect(res.status).toBe(429);
      const after = await as(cookie, async () => (await get(new Request(`${URL_BASE}/${s.id}`), ctx(s.id))).json());
      expect(after.status).toBe("in_progress");
    });

    it("one student's limit doesn't affect another's", async () => {
      const alice = await newStudent();
      const bob = await newStudent();
      await useUpLimit((await startSession(alice)).id, "session_create");
      await startSession(bob); // expects 201
    });

    it("invalid requests don't count", async () => {
      const cookie = await newStudent();
      for (let i = 0; i < 3; i++) {
        expect((await as(cookie, () => create(jsonRequest("POST", { topicId: "no-such-topic" })))).status).toBe(400);
      }
      const s = await startSession(cookie);
      const { rows } = await getPool().query(
        "select count from rate_limit_counts r join teaching_sessions t on t.user_id = r.user_id where t.id = $1 and r.action = 'session_create'",
        [s.id],
      );
      expect(rows.map((r) => r.count)).toEqual([1, 1]);
    });
  });
});
