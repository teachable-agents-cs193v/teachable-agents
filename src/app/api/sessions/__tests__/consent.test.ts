// The student's AI choice through the real routes, against the throwaway Postgres: it's stored
// when the session is created, the browser can't change it, and a session without AI consent
// never calls the model (a fake that records every call), even with models configured.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasDb, sessionCookie, signUp } from "@/lib/auth/__tests__/testHelpers";
import { getPool } from "@/lib/db/pool";
import type { ChatTurn, JsonCallOptions, JsonModel } from "@/lib/learner/teachable/llm";
import { assessorAnswer, noteTakerAnswer } from "@/lib/learner/teachable/__tests__/fakeTurns";
import { AI_LEARNER_ID, OFFLINE_LEARNER_ID } from "@/lib/aiData";
import type { TeachingSession } from "@/lib/types";
import { POST as create } from "../route";
import { PUT as put } from "../[id]/route";
import { POST as turn } from "../[id]/turn/route";
import { POST as deviceReply } from "../[id]/device-reply/route";

vi.mock("@/lib/auth/pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/pwned")>()),
  isPwned: vi.fn(async () => false),
}));

let requestCookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));

class RecordingModel implements JsonModel {
  readonly name = "recording";
  calls: { label: string; messages: ChatTurn[] }[] = [];
  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    this.calls.push({ label: options.label, messages });
    if (options.label === "noteTaker") return noteTakerAnswer();
    if (options.label === "assessor") return assessorAnswer();
    return { mood: "curious", text: "Fake Pip reply" };
  }
}

// Models are always configured here: only the session's choice decides whether they're used.
let model = new RecordingModel();
vi.mock("@/lib/learner/teachable/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/learner/teachable/server")>()),
  modelsFromEnv: () => ({ assessor: model, pip: model }),
}));

beforeEach(() => {
  requestCookie = undefined;
  model = new RecordingModel();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const TOPIC = "independence-vs-mutual-exclusivity";
const URL_BASE = "http://localhost:3000/api/sessions";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (method: string, body: unknown) =>
  new Request(URL_BASE, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function as<T>(cookie: string | undefined, fn: () => Promise<T>): Promise<T> {
  requestCookie = cookie;
  return fn();
}

const NAME = "Ada Lovelace-Consent";

async function student() {
  const { res, email } = await signUp({ name: NAME });
  const cookie = sessionCookie(res);
  const { rows } = await getPool().query<{ id: string }>(`select id from "users" where email = $1`, [email]);
  return { cookie, email, userId: rows[0].id };
}

async function start(cookie: string, body: Record<string, unknown>) {
  const res = await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC, ...body })));
  return { status: res.status, session: (await res.json()) as TeachingSession };
}

async function turnAs(cookie: string, id: string, body: unknown = {}) {
  const res = await as(cookie, () => turn(jsonRequest("POST", body), ctx(id)));
  return { status: res.status, body: await res.json() };
}

/** Pip's opening and two student messages. */
async function teach(cookie: string, id: string, replyOn?: "device") {
  const extra = replyOn ? { replyOn } : {};
  const results = [
    await turnAs(cookie, id, extra),
    await turnAs(cookie, id, { clientMessageId: "m1", text: "Independent means one doesn't change the other's chance.", ...extra }),
    await turnAs(cookie, id, { clientMessageId: "m2", text: "Heads doesn't change the 1/6 chance of a six.", ...extra }),
  ];
  for (const r of results) expect(r.status).toBe(200);
  return results;
}

const storedLearnerId = async (id: string) =>
  (await getPool().query<{ learner_id: string }>("select learner_id from teaching_sessions where id = $1", [id])).rows[0].learner_id;

describe.skipIf(!hasDb)("the AI choice on /api/sessions", () => {
  it("stores the choice as the session's learner id", async () => {
    const { cookie } = await student();
    const ai = await start(cookie, { learner: "ai" });
    const offline = await start(cookie, { learner: "offline" });
    expect(ai.status).toBe(201);
    expect(ai.session.learnerId).toBe(AI_LEARNER_ID);
    expect(offline.session.learnerId).toBe(OFFLINE_LEARNER_ID);
    expect(await storedLearnerId(offline.session.id)).toBe(OFFLINE_LEARNER_ID);
  });

  it("is opt-in: no choice means offline, a learnerId in the body is ignored, and unknown values are refused", async () => {
    const { cookie } = await student();
    expect((await start(cookie, {})).session.learnerId).toBe(OFFLINE_LEARNER_ID);
    expect((await start(cookie, { learner: "offline", learnerId: AI_LEARNER_ID })).session.learnerId).toBe(OFFLINE_LEARNER_ID);
    for (const learner of ["AI", "yes", true, 1, null]) expect((await start(cookie, { learner })).status).toBe(400);
  });

  it("can't be changed by the browser afterwards", async () => {
    const { cookie } = await student();
    const { session } = await start(cookie, { learner: "offline" });
    const res = await as(cookie, () => put(jsonRequest("PUT", { status: "in_progress", learnerId: AI_LEARNER_ID, learner: "ai" }), ctx(session.id)));
    expect(res.status).toBe(200);
    expect((await res.json()).learnerId).toBe(OFFLINE_LEARNER_ID);
    expect(await storedLearnerId(session.id)).toBe(OFFLINE_LEARNER_ID);
  });

  it("an offline session never calls the model and always uses the scripted learner", async () => {
    const { cookie } = await student();
    const { session } = await start(cookie, { learner: "offline" });
    const results = await teach(cookie, session.id);
    for (const r of results) {
      expect(r.body.learner.id).toBe("scripted-demo");
      expect(r.body.pip).toBeNull();
    }
    expect(model.calls).toHaveLength(0);
    const { rows } = await getPool().query("select learner_state from teaching_sessions where id = $1", [session.id]);
    expect(rows[0].learner_state).toBeNull();
  });

  it("an offline session never calls the model on the on-device path either", async () => {
    vi.stubEnv("DEVICE_PIP_EXPERIMENT", "1");
    const { cookie } = await student();
    const { session } = await start(cookie, { learner: "offline", topicId: "derivatives" });
    const results = await teach(cookie, session.id, "device");
    for (const r of results) {
      expect(r.body.device).toBeUndefined();
      expect(r.body.learner.id).toBe("scripted-demo");
    }
    const reply = await as(cookie, () => deviceReply(jsonRequest("POST", { forMessageId: "m2", text: "Hi" }), ctx(session.id)));
    expect(reply.status).toBe(409);
    expect(model.calls).toHaveLength(0);
  });

  it("an AI session uses the model, and nothing sent to it names the student", async () => {
    const { cookie, email, userId } = await student();
    const { session } = await start(cookie, { learner: "ai" });
    const results = await teach(cookie, session.id);
    expect(results.at(-1)!.body.learner.id).toBe("teachable");
    expect(model.calls.map((c) => c.label)).toEqual(["reply", "noteTaker", "assessor", "reply", "noteTaker", "assessor", "reply"]);
    const sent = JSON.stringify(model.calls.map((c) => c.messages));
    for (const identifier of [NAME, "Ada", email, userId, session.id]) expect(sent).not.toContain(identifier);
  });

  it("a session from before the choice existed (learner_id 'pip') keeps the AI learner", async () => {
    const { cookie, userId } = await student();
    const id = `session_legacy-${crypto.randomUUID()}`;
    await getPool().query(`insert into teaching_sessions (id, user_id, topic_id, learner_id) values ($1, $2, $3, 'pip')`, [id, userId, TOPIC]);
    const opening = await turnAs(cookie, id);
    expect(opening.status).toBe(200);
    expect(opening.body.learner.id).toBe("teachable");
    expect(model.calls.map((c) => c.label)).toEqual(["reply"]);
  });
});
