// On-device Pip: POST /turn with replyOn "device", then POST /device-reply, against the
// throwaway Postgres. The model is a fake injected through modelsFromEnv(); no network calls.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasDb, sessionCookie, signUp } from "@/lib/auth/__tests__/testHelpers";
import type { ChatTurn, JsonCallOptions, JsonModel } from "@/lib/learner/teachable/llm";
import type { TeachingSession } from "@/lib/types";
import { POST as create } from "../route";
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

/** Fake model: fixed assessor verdicts and replies, recording every call's label and prompt. */
class FakeModel implements JsonModel {
  readonly name = "fake";
  calls: { label: string; messages: ChatTurn[] }[] = [];
  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    this.calls.push({ label: options.label, messages });
    if (options.label === "assessor") {
      return { analysis: "", claims: [], corrections: [], nowExplainedBeliefIds: [], offTask: false, move: "ask_why", moveTarget: null, moveNote: "Ask why.", readyToWrapUp: false };
    }
    return { mood: "curious", text: "Server Pip reply" };
  }
  labels = () => this.calls.map((c) => c.label);
}

let model: FakeModel | null = null;
vi.mock("@/lib/learner/teachable/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/learner/teachable/server")>()),
  modelsFromEnv: () => (model ? { assessor: model, pip: model } : null),
}));

beforeEach(() => {
  requestCookie = undefined;
  model = new FakeModel();
});

const URL_BASE = "http://localhost:3000/api/sessions";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request(URL_BASE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function as<T>(cookie: string | undefined, fn: () => Promise<T>): Promise<T> {
  requestCookie = cookie;
  return fn();
}

async function newSession(topicId: string) {
  const cookie = sessionCookie((await signUp()).res);
  const res = await as(cookie, () => create(post({ topicId })));
  return { cookie, session: (await res.json()) as TeachingSession };
}

const turnAs = async (cookie: string, id: string, body: unknown) => {
  const res = await as(cookie, () => turn(post(body), ctx(id)));
  return { status: res.status, body: await res.json() };
};
const replyAs = async (cookie: string, id: string, body: unknown) => {
  const res = await as(cookie, () => deviceReply(post(body), ctx(id)));
  return { status: res.status, body: await res.json() };
};

describe.skipIf(!hasDb)("on-device Pip (derivatives)", () => {
  it("opens and answers in two steps, never calling the server's reply model", async () => {
    const { cookie, session } = await newSession("derivatives");

    const open = await turnAs(cookie, session.id, { replyOn: "device" });
    expect(open.status).toBe(200);
    expect(open.body.reply).toBeNull();
    expect(open.body.device.forMessageId).toBeNull();
    const [system, user] = open.body.device.messages as ChatTurn[];
    expect(system.role).toBe("system");
    expect(system.content).toContain("You are Pip, a student who is learning derivatives");
    expect(user.content).toBe("Hi! Ready to learn about derivatives?");
    expect(open.body.session.messages).toHaveLength(0);

    const saved = await replyAs(cookie, session.id, { forMessageId: null, text: "Hi! Derivatives are new to me." });
    expect(saved.status).toBe(200);
    expect(saved.body.session.messages).toMatchObject([{ role: "learner", text: "Hi! Derivatives are new to me.", generatedOn: "device", kind: "opening" }]);

    const asked = await turnAs(cookie, session.id, { clientMessageId: "m1", text: "The power comes down and drops by one.", replyOn: "device" });
    expect(asked.status).toBe(200);
    expect(asked.body.device.forMessageId).toBe("m1");
    expect(asked.body.device.messages[1].content).toBe("The power comes down and drops by one.");
    expect(asked.body.session.messages.map((m: { role: string }) => m.role)).toEqual(["learner", "student"]);

    const answered = await replyAs(cookie, session.id, { forMessageId: "m1", text: "So x to the 4th is 4x cubed?" });
    expect(answered.status).toBe(200);
    expect(answered.body.session.messages.at(-1)).toMatchObject({ role: "learner", text: "So x to the 4th is 4x cubed?", generatedOn: "device" });
    expect(model!.labels()).toEqual(["assessor"]); // one assessment, no server reply
  });

  it("puts Pip's notebook, and nothing from the answer key, in the device prompt", async () => {
    const { cookie, session } = await newSession("derivatives");
    const open = await turnAs(cookie, session.id, { replyOn: "device" });
    const system = (open.body.device.messages as ChatTurn[])[0].content;
    // Pip's starting misconception is in its notes, as Pip believes it...
    expect(system).toContain("you just multiply their derivatives");
    // ...but no answer-key fields.
    expect(system).not.toContain("f'g + fg'");
    expect(system).not.toContain("3 cos(3x)");
  });

  it("accepts only the reply it asked for", async () => {
    const { cookie, session } = await newSession("derivatives");
    expect((await replyAs(cookie, session.id, { forMessageId: null, text: "Hi" })).status).toBe(409); // nothing pending
    await turnAs(cookie, session.id, { replyOn: "device" });
    expect((await replyAs(cookie, session.id, { forMessageId: "m9", text: "Hi" })).status).toBe(409); // wrong message
    expect((await replyAs(cookie, session.id, { forMessageId: null, text: "" })).status).toBe(400);
    expect((await replyAs(cookie, session.id, { forMessageId: null, text: "x".repeat(1_300) })).status).toBe(400);
    expect((await replyAs(cookie, session.id, { forMessageId: null, text: "Hi!" })).status).toBe(200);
    expect((await replyAs(cookie, session.id, { forMessageId: null, text: "Hi again" })).status).toBe(409); // already saved
  });

  it("falls back to the server's reply without assessing the message twice", async () => {
    const { cookie, session } = await newSession("derivatives");
    await turnAs(cookie, session.id, { replyOn: "device" });
    await replyAs(cookie, session.id, { forMessageId: null, text: "Hi!" });
    await turnAs(cookie, session.id, { clientMessageId: "m1", text: "Constants go to zero.", replyOn: "device" });

    // The device couldn't answer (no WebGPU, or it failed): the browser asks the server instead.
    const fallback = await turnAs(cookie, session.id, {});
    expect(fallback.status).toBe(200);
    expect(fallback.body.session.messages.at(-1)).toMatchObject({ role: "learner", text: "Server Pip reply" });
    expect(fallback.body.session.messages.at(-1).generatedOn).toBeUndefined();
    expect(model!.labels()).toEqual(["assessor", "reply"]);
    expect((await replyAs(cookie, session.id, { forMessageId: "m1", text: "late device reply" })).status).toBe(409);
  });

  it("replies on the server for topics without an on-device Pip", async () => {
    const { cookie, session } = await newSession("independence-vs-mutual-exclusivity");
    const open = await turnAs(cookie, session.id, { replyOn: "device" });
    expect(open.status).toBe(200);
    expect(open.body.device).toBeUndefined();
    expect(open.body.reply.text).toBe("Server Pip reply");
  });

  it("rejects a bad replyOn", async () => {
    const { cookie, session } = await newSession("derivatives");
    expect((await turnAs(cookie, session.id, { replyOn: "phone" })).status).toBe(400);
  });
});
