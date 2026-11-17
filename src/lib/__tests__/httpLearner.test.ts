import { describe, expect, it } from "vitest";
import { getLearningProgress, getLearningReview, postTurn } from "../learner/httpLearner";

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
