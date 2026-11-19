import { describe, expect, it } from "vitest";
import { LlmError, type JsonCallOptions, type JsonModel } from "../../src/lib/learner/teachable/llm";
import { PacedModel, QuotaExhaustedError, TokenLimiter } from "../pacedModel";

/** Fails with a 429 a given number of times, then answers. */
class Flaky implements JsonModel {
  readonly name = "fake-model";
  calls = 0;
  constructor(private failures: number, private retryAfter: number) {}
  async completeJson(): Promise<unknown> {
    this.calls++;
    if (this.calls <= this.failures) throw new LlmError(`assessor: provider returned 429 (retry after ${this.retryAfter}s)`, false);
    return { ok: true };
  }
}

const opts = { label: "assessor" } as JsonCallOptions;

describe("PacedModel and Groq's rolling daily quota", () => {
  it("waits out a short Retry-After and carries on", async () => {
    const slept: number[] = [];
    const model = new PacedModel(new Flaky(2, 82), new TokenLimiter(1e9), { sleep: async (ms) => void slept.push(ms) });
    expect(await model.completeJson([], opts)).toEqual({ ok: true });
    expect(slept).toEqual([87_000, 87_000]);
  });

  it("stops (resumably) on a long Retry-After, or once the wait budget is spent", async () => {
    const long = new PacedModel(new Flaky(1, 7200), new TokenLimiter(1e9), { sleep: async () => {} });
    await expect(long.completeJson([], opts)).rejects.toBeInstanceOf(QuotaExhaustedError);
    const capped = new PacedModel(new Flaky(5, 600), new TokenLimiter(1e9), { sleep: async () => {}, maxQuotaWaitMs: 1_300_000 });
    await expect(capped.completeJson([], opts)).rejects.toBeInstanceOf(QuotaExhaustedError);
  });
});
