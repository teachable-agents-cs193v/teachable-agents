// POST /api/sessions/[id]/turn against the throwaway Postgres, with real Better Auth
// sessions. The model is a fake injected through modelFromEnv(); no network calls.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasDb, sessionCookie, signUp } from "@/lib/auth/__tests__/testHelpers";
import { getPool } from "@/lib/db/pool";
import type { ChatTurn, JsonCallOptions, JsonModel } from "@/lib/learner/teachable/llm";
import type { ChatMessage, TeachingSession } from "@/lib/types";
import { POST as create } from "../route";
import { GET as get, PUT as put } from "../[id]/route";
import { POST as turn } from "../[id]/turn/route";

vi.mock("@/lib/auth/pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/pwned")>()),
  isPwned: vi.fn(async () => false),
}));

let requestCookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));

/** Fake model: answers assessor and reply calls from fixed objects, counting calls. */
class FakeModel implements JsonModel {
  readonly name = "fake";
  calls: string[] = [];
  async completeJson(_messages: ChatTurn[], options: JsonCallOptions) {
    this.calls.push(options.label);
    if (options.label === "assessor") {
      return { analysis: "", claims: [], corrections: [], nowExplainedBeliefIds: [], offTask: false, move: "ask_why", moveTarget: null, moveNote: "Ask why.", readyToWrapUp: false };
    }
    return { mood: "curious", text: `Pip reply ${this.calls.length}` };
  }
}

let model: FakeModel | null = null;
vi.mock("@/lib/learner/teachable/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/learner/teachable/server")>()),
  modelFromEnv: () => model,
}));

beforeEach(() => {
  requestCookie = undefined;
  model = null;
});

const TOPIC = "independence-vs-mutual-exclusivity";
const URL_BASE = "http://localhost:3000/api/sessions";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = () => new Request(`${URL_BASE}/x/turn`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
const jsonRequest = (method: string, body: unknown) =>
  new Request(URL_BASE, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function as<T>(cookie: string | undefined, fn: () => Promise<T>): Promise<T> {
  requestCookie = cookie;
  return fn();
}

async function newStudentWithSession() {
  const cookie = sessionCookie((await signUp()).res);
  const res = await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC })));
  return { cookie, session: (await res.json()) as TeachingSession };
}

async function addMessage(cookie: string, session: TeachingSession, message: ChatMessage, learnerCursor = session.learnerCursor) {
  const messages = [...session.messages, message];
  const res = await as(cookie, () =>
    put(jsonRequest("PUT", { status: session.status, messages, learnerCursor, reflection: session.reflection }), ctx(session.id)),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as TeachingSession;
}

const student = (id: string, text: string): ChatMessage => ({ id, role: "student", text, createdAt: new Date().toISOString() });
const learner = (id: string, text: string): ChatMessage => ({ id, role: "learner", text, createdAt: new Date().toISOString() });

describe("POST /api/sessions/[id]/turn logged out", () => {
  it("answers 401", async () => {
    expect((await turn(post(), ctx("x"))).status).toBe(401);
  });
});

describe.skipIf(!hasDb)("POST /api/sessions/[id]/turn", () => {
  it("answers 404 for another user's session", async () => {
    const { session } = await newStudentWithSession();
    const other = sessionCookie((await signUp()).res);
    expect((await as(other, () => turn(post(), ctx(session.id)))).status).toBe(404);
  });

  it("falls back to the scripted learner when no model is configured", async () => {
    const { cookie, session } = await newStudentWithSession();
    const res = await as(cookie, () => turn(post(), ctx(session.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.learner.id).toBe("scripted-demo");
    expect(body.reply).toMatchObject({ kind: "opening", nextCursor: 1 });
  });

  it("runs the AI learner, saves its state server-side and never returns it from GET", async () => {
    model = new FakeModel();
    const { cookie, session: s0 } = await newStudentWithSession();

    const opening = await (await as(cookie, () => turn(post(), ctx(s0.id)))).json();
    expect(opening.learner.id).toBe("teachable");
    expect(opening.reply.kind).toBe("opening");

    let s = await addMessage(cookie, s0, learner("l0", opening.reply.text), opening.reply.nextCursor);
    s = await addMessage(cookie, s, student("s0", "Independent means they don't affect each other."));
    const reply = await (await as(cookie, () => turn(post(), ctx(s.id)))).json();
    expect(reply.reply.text).toMatch(/^Pip reply/);
    expect(model.calls).toEqual(["reply", "assessor", "reply"]);

    const { rows } = await getPool().query("select learner_state from teaching_sessions where id = $1", [s.id]);
    expect(rows[0].learner_state.notebook.studentTurns).toBe(1);
    const fetched = await (await as(cookie, () => get(new Request(`${URL_BASE}/${s.id}`), ctx(s.id)))).json();
    expect(JSON.stringify(fetched)).not.toMatch(/learner_?[sS]tate|notebook|taughtCorrectly/);
  });

  it("returns the same reply when a turn is retried, without calling the model again", async () => {
    model = new FakeModel();
    const { cookie, session: s0 } = await newStudentWithSession();
    const s = await addMessage(cookie, s0, student("s0", "hello"));
    const first = await (await as(cookie, () => turn(post(), ctx(s.id)))).json();
    const again = await (await as(cookie, () => turn(post(), ctx(s.id)))).json();
    expect(again.reply).toEqual(first.reply);
    expect(model.calls).toEqual(["assessor", "reply"]);
  });

  it("answers 409 when the last message is already Pip's, or the session has ended", async () => {
    model = new FakeModel();
    const { cookie, session: s0 } = await newStudentWithSession();
    const s = await addMessage(cookie, s0, learner("l0", "Hi"));
    expect((await as(cookie, () => turn(post(), ctx(s.id)))).status).toBe(409);

    const ended = await as(cookie, () =>
      put(jsonRequest("PUT", { status: "completed", endedAt: new Date().toISOString(), messages: s.messages, learnerCursor: 0 }), ctx(s.id)),
    );
    expect(ended.status).toBe(200);
    expect((await as(cookie, () => turn(post(), ctx(s.id)))).status).toBe(409);
  });

  it("shows a friendly message, not the provider's error, when the model fails", async () => {
    model = new FakeModel();
    model.completeJson = async () => {
      const { LlmError } = await import("@/lib/learner/teachable/llm");
      throw new LlmError("assessor: provider returned 429", true);
    };
    const { cookie, session: s0 } = await newStudentWithSession();
    const s = await addMessage(cookie, s0, student("s0", "hello"));
    const res = await as(cookie, () => turn(post(), ctx(s.id)));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Pip is having trouble/);
    expect(JSON.stringify(body)).not.toMatch(/429|provider/);
  });
});
