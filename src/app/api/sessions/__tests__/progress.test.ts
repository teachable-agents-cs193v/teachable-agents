// GET /api/sessions/[id]/progress and /review against the throwaway Postgres, with
// real Better Auth sessions. The model is a fake injected through modelsFromEnv(),
// answering by call label; no network calls.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasDb, sessionCookie, signUp } from "@/lib/auth/__tests__/testHelpers";
import { storedLearnerState, writeLearnerState } from "./storedSession";
import type { ChatTurn, JsonCallOptions, JsonModel } from "@/lib/learner/teachable/llm";
import { assessorAnswer, noteTakerAnswer, type FakeTurn } from "@/lib/learner/teachable/__tests__/fakeTurns";
import { probabilityPack as pack } from "@/lib/learner/teachable/packs/probability";
import type { LearningProgress, LearningReview, TeachingSession } from "@/lib/types";
import { POST as create } from "../route";
import { PUT as put } from "../[id]/route";
import { POST as turn } from "../[id]/turn/route";
import { GET as getProgress } from "../[id]/progress/route";
import { GET as getReview } from "../[id]/review/route";

vi.mock("@/lib/auth/pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/pwned")>()),
  isPwned: vi.fn(async () => false),
}));

let requestCookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));

const VOICED = "independent-means-cannot-co-occur";
const SILENT = "same-source-means-dependent";
const verdict = (over: FakeTurn = {}): FakeTurn => over;

/**
 * Fake model: per turn, the note-taker's notes and the assessor's grades from a queue (the assessor
 * also tries to slip free text in, which must never reach the student), a fixed reply otherwise.
 */
class FakeModel implements JsonModel {
  readonly name = "fake";
  constructor(private readonly turns: FakeTurn[]) {}
  async completeJson(_messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    if (options.label === "noteTaker") return noteTakerAnswer(this.turns[0]);
    if (options.label === "assessor") return { ...assessorAnswer(this.turns.shift()), analysis: "secret assessor reasoning", moveNote: "Ask why." };
    return { mood: "curious", text: "Hmm, why?" };
  }
}

let model: FakeModel | null = null;
vi.mock("@/lib/learner/teachable/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/learner/teachable/server")>()),
  modelsFromEnv: () => (model ? { assessor: model, pip: model } : null),
}));

beforeEach(() => {
  requestCookie = undefined;
  model = null;
});

const TOPIC = pack.topicId;
const URL_BASE = "http://localhost:3000/api/sessions";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (method: string, body: unknown) =>
  new Request(URL_BASE, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function as<T>(cookie: string | undefined, fn: () => Promise<T>): Promise<T> {
  requestCookie = cookie;
  return fn();
}

async function read(res: Promise<Response>) {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

const progressOf = (cookie: string, id: string) => as(cookie, () => read(getProgress(new Request(`${URL_BASE}/${id}/progress`), ctx(id))));
const reviewOf = (cookie: string, id: string) => as(cookie, () => read(getReview(new Request(`${URL_BASE}/${id}/review`), ctx(id))));
const say = (cookie: string, id: string, clientMessageId: string, text: string) =>
  as(cookie, () => read(turn(jsonRequest("POST", { clientMessageId, text }), ctx(id))));

/** A session taught through the AI learner: an asserted idea and a voiced misconception, then a real correction. */
async function taughtSession() {
  model = new FakeModel([
    verdict({
      claims: [{ pipStatement: "Independent means no effect.", conceptId: "independence-definition", correctness: "incorrect", explained: false }],
      corrections: [{ misconceptionId: SILENT, targeted: false, explained: false }],
      move: "voice_misconception",
      moveTarget: VOICED,
    }),
    verdict({
      claims: [{ pipStatement: "A coin and a die can both happen.", conceptId: "independent-can-co-occur", correctness: "correct", explained: true }],
      corrections: [{ misconceptionId: VOICED, targeted: true, explained: true }],
    }),
  ]);
  const cookie = sessionCookie((await signUp()).res);
  const session = (await (await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC, learner: "ai" })))).json()) as TeachingSession;
  expect((await as(cookie, () => read(turn(jsonRequest("POST", {}), ctx(session.id))))).status).toBe(200);
  const first = await say(cookie, session.id, "msg_1", "Independent means they don't affect each other.");
  const second = await say(cookie, session.id, "msg_2", "Heads and a six can both happen, and heads doesn't change the 1/6.");
  return { cookie, session: second.body.session as TeachingSession, first: first.body, second: second.body };
}

async function end(cookie: string, session: TeachingSession) {
  const res = await as(cookie, () =>
    put(jsonRequest("PUT", { status: "completed", endedAt: new Date().toISOString() }), ctx(session.id)),
  );
  expect(res.status).toBe(200);
}

/** Nothing from the answer key or the hidden verdicts, and no misconception Pip hasn't voiced. */
function expectStudentSafe(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/correctness|taughtCorrectly|incorrect|conceptId|misconceptionId|targeted|offTask|analysis|secret assessor/);
  expect(text).not.toContain(SILENT);
  for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
  for (const m of pack.misconceptions) {
    expect(text).not.toContain(m.whyWrong);
    expect(text).not.toContain(m.correctionMustAddress);
    expect(text).not.toContain(m.label);
    if (m.id !== VOICED) expect(text).not.toContain(m.pipBelief);
  }
}

describe("progress and review logged out", () => {
  it("answer 401", async () => {
    expect((await getProgress(new Request(`${URL_BASE}/x/progress`), ctx("x"))).status).toBe(401);
    expect((await getReview(new Request(`${URL_BASE}/x/review`), ctx("x"))).status).toBe(401);
  });
});

describe.skipIf(!hasDb)("GET /api/sessions/[id]/progress", () => {
  it("comes with every turn, and after a reload, without hidden fields", async () => {
    const { cookie, session, first, second } = await taughtSession();
    const live = second.progress as LearningProgress;
    expect(live).toMatchObject({
      studentTurns: 2,
      recordedFromTurn: 0,
      beliefs: { heard: 1, understood: 1, believes: 0, changed_mind: 1 },
      teaching: { claims: 2, explained: 1, asserted: 1, explainedLater: 0 },
      misconceptions: [{ id: `m:${VOICED}`, status: "changed_mind", voicedAtTurn: 0, changedAtTurn: 1, turnsToChange: 1, attempts: 1 }],
    });
    expect(live.timeline.map((e) => [e.turn, e.events.map((x) => x.type)])).toEqual([
      [0, ["learned", "voiced"]],
      [1, ["learned", "changed_mind"]],
    ]);
    expect(first.progress.misconceptions).toEqual([expect.objectContaining({ status: "believes" })]);

    const loaded = await progressOf(cookie, session.id);
    expect(loaded.status).toBe(200);
    expect(loaded.body.progress).toEqual(live);
    for (const body of [first, second, loaded.body]) expectStudentSafe({ pip: (body as { pip?: unknown }).pip, progress: (body as { progress?: unknown }).progress });
  });

  it("stores the history inside learner_state, at version 2", async () => {
    const { session } = await taughtSession();
    const state = (await storedLearnerState(session.id)) as { history: Array<{ messageId: string }> };
    expect(state).toMatchObject({ version: 2, historyFrom: 0 });
    expect(state.history.map((r) => r.messageId)).toEqual(["msg_1", "msg_2"]);
  });

  it("upgrades a session saved before history existed", async () => {
    const { cookie, session } = await taughtSession();
    // Strip the state back to version 1's shape.
    const v1 = { ...(await storedLearnerState(session.id)) };
    for (const key of ["version", "history", "historyFrom"]) delete v1[key];
    await writeLearnerState(session.id, v1);
    const loaded = await progressOf(cookie, session.id);
    expect(loaded.body.progress).toMatchObject({ studentTurns: 2, recordedFromTurn: 2, timeline: [], misconceptions: [{ status: "changed_mind", voicedAtTurn: null, attempts: 1 }] });

    const next = await say(cookie, session.id, "msg_3", "One more thing.");
    expect(next.status).toBe(200);
    expect(next.body.progress.recordedFromTurn).toBe(2);
  });

  it("is null for the scripted learner, and 404 for another user's session", async () => {
    const cookie = sessionCookie((await signUp()).res);
    const session = (await (await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC, learner: "ai" })))).json()) as TeachingSession;
    await as(cookie, () => turn(jsonRequest("POST", {}), ctx(session.id)));
    expect(await progressOf(cookie, session.id)).toEqual({ status: 200, body: { progress: null } });

    const other = sessionCookie((await signUp()).res);
    expect((await progressOf(other, session.id)).status).toBe(404);
    expect((await progressOf(cookie, "session_missing")).status).toBe(404);
  });
});

describe.skipIf(!hasDb)("GET /api/sessions/[id]/review", () => {
  it("answers 409 while the session is in progress, without any review data", async () => {
    const { cookie, session } = await taughtSession();
    const res = await reviewOf(cookie, session.id);
    expect(res.status).toBe(409);
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("returns the full picture once the session is completed", async () => {
    const { cookie, session } = await taughtSession();
    await end(cookie, session);
    const res = await reviewOf(cookie, session.id);
    expect(res.status).toBe(200);
    const review = res.body.review as LearningReview;
    expect(review.metrics).toMatchObject({
      misconceptions: { total: 3, voiced: 1, corrected: 1, stillHeld: 2 },
      correctness: { correct: 1, incorrect: 1, partly: 0, unclear: 0 },
      teaching: { claims: 2, explained: 1, asserted: 1 },
      offTaskTurns: 0,
    });
    expect(review.misconceptions.map((m) => [m.id, m.outcome, m.voiced])).toEqual([
      [`m:${VOICED}`, "corrected", true],
      [`m:${SILENT}`, "still_held", false],
      ["m:exclusive-means-independent", "still_held", false],
    ]);
    expect(review.misconceptions[0]).toMatchObject({ label: "Independent events cannot happen at the same time", turnsToCorrect: 1 });
    expect(review.misconceptions[1].attempts).toEqual([{ turn: 0, targeted: false, explained: false, accepted: false }]);
    expect(review.taught.map((t) => [t.statement, t.correctness, t.explainedWhenTaught])).toEqual([
      ["Independent means no effect.", "incorrect", false],
      ["A coin and a die can both happen.", "correct", true],
    ]);

    // Even after the session, the answer key and the assessor's reasoning stay on the server.
    const text = JSON.stringify(res.body);
    for (const c of pack.concepts) expect(text).not.toContain(c.keyIdea);
    for (const m of pack.misconceptions) {
      expect(text).not.toContain(m.whyWrong);
      expect(text).not.toContain(m.correctionMustAddress);
    }
    expect(text).not.toMatch(/secret assessor|analysis|moveNote|taughtCorrectly/);
  });

  it("is null for the scripted learner, and 404 for another user's session", async () => {
    const cookie = sessionCookie((await signUp()).res);
    const session = (await (await as(cookie, () => create(jsonRequest("POST", { topicId: TOPIC, learner: "ai" })))).json()) as TeachingSession;
    await end(cookie, session);
    expect(await reviewOf(cookie, session.id)).toEqual({ status: 200, body: { review: null } });

    const other = sessionCookie((await signUp()).res);
    expect((await reviewOf(other, session.id)).status).toBe(404);
  });
});
