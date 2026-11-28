import { describe, expect, it } from "vitest";
import { getLearningProgress, getLearningReview, postDeviceReply, postTurn, TurnError } from "../learner/httpLearner";
import { atCapacityMessage, tooManyTurnsMessage } from "../learner/capacity";

const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("progress and review clients", () => {
  it("pass the server's object through", async () => {
    const progress = { studentTurns: 1 };
    expect(await getLearningProgress("s", respond(200, { progress }))).toEqual(progress);
    const review = { studentTurns: 2 };
    expect(await getLearningReview("s", respond(200, { review }))).toEqual(review);
  });

  it("are null for the scripted learner, a session still going (409), or a failure", async () => {
    expect(await getLearningProgress("s", respond(200, { progress: null }))).toBeNull();
    expect(await getLearningReview("s", respond(409, { error: "The review is ready once the session has ended." }))).toBeNull();
    expect(await getLearningReview("s", async () => { throw new TypeError("offline"); })).toBeNull();
    expect(await getLearningProgress("s", respond(500, {}))).toBeNull();
  });

  it("postTurn returns progress, or null when the server sends none", async () => {
    const session = { id: "s", messages: [] };
    expect((await postTurn("s", {}, respond(200, { session, progress: { studentTurns: 0 } }))).progress).toEqual({ studentTurns: 0 });
    expect((await postTurn("s", {}, respond(200, { session }))).progress).toBeNull();
  });
});

describe("failed turns", () => {
  const failure = async (status: number, body: unknown, call = postTurn) =>
    (await call("s", { clientMessageId: "m", text: "hi", forMessageId: null } as never, respond(status, body)).catch((e: unknown) => e)) as TurnError;

  it("show the capacity message when the server says the AI is at capacity", async () => {
    const error = await failure(503, { error: "ignored", code: "at_capacity", retryAfterSeconds: 240 });
    expect(error).toBeInstanceOf(TurnError);
    expect(error.status).toBe(503);
    expect(error.message).toBe("Pip is at capacity right now: a lot of people are teaching at once. Try again in about 4 minutes.");
    expect((await failure(503, { code: "at_capacity" })).message).toMatch(/at capacity.*Try again in a few minutes\.$/);
    expect((await failure(503, { code: "at_capacity", retryAfterSeconds: "soon" })).message).toMatch(/in a few minutes/);
    expect((await failure(503, { code: "at_capacity", retryAfterSeconds: 240 }, postDeviceReply as never)).message).toMatch(/in about 4 minutes/);
  });

  it("keep the generic busy message for every other server error", async () => {
    for (const [status, body] of [
      [503, { error: "Pip is having trouble thinking right now." }],
      [500, { error: "stack trace", code: "at_capacity" }],
      [502, {}],
    ] as const) {
      expect((await failure(status, body)).message).toBe("Pip is having trouble thinking right now. Wait a moment and try again.");
    }
    expect((await failure(401, {})).message).toMatch(/logged out/);
  });

  it("show the server's message when the student hits their turn limit (#55)", async () => {
    const error = await failure(429, { error: tooManyTurnsMessage(45), code: "rate_limited", retryAfterSeconds: 45 });
    expect(error.status).toBe(429);
    expect(error.message).toBe("You've sent Pip a lot of messages in a short time. Take a short break and try again in about a minute.");
    expect(tooManyTurnsMessage(3 * 3600)).toMatch(/in about 3 hours\.$/);
  });

  it("say roughly when to try again", () => {
    expect(atCapacityMessage()).toMatch(/in a few minutes\.$/);
    expect(atCapacityMessage(30)).toMatch(/in about a minute\.$/);
    expect(atCapacityMessage(600)).toMatch(/in about 10 minutes\.$/);
    expect(atCapacityMessage(3600)).toMatch(/in about an hour\.$/);
    expect(atCapacityMessage(5 * 3600 + 1)).toMatch(/in about 6 hours\.$/);
  });
});
