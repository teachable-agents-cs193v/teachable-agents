import { describe, expect, it, vi } from "vitest";
import { LlmError, OpenAiCompatibleModel } from "../llm";

const config = { baseUrl: "https://example.test/v1", apiKey: "test-key", model: "m", attempts: 3, maxRetryWaitMs: 50 };

function limited(retryAfter: string) {
  return new Response("{}", { status: 429, headers: { "retry-after": retryAfter } });
}

function ok(content: object) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
}

describe("OpenAiCompatibleModel rate limits", () => {
  it("gives up at once when the provider asks for a wait longer than the cap (e.g. a daily limit)", async () => {
    const fetchImpl = vi.fn(async () => limited("600"));
    const model = new OpenAiCompatibleModel(config, fetchImpl as unknown as typeof fetch);
    const error = (await model.completeJson([{ role: "user", content: "hi" }], { label: "reply" }).catch((e: unknown) => e)) as LlmError;
    expect(error).toBeInstanceOf(LlmError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("retry after 600s");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a short per-minute limit and succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(limited("0")).mockResolvedValueOnce(ok({ text: "hi" }));
    const model = new OpenAiCompatibleModel(config, fetchImpl as unknown as typeof fetch);
    await expect(model.completeJson([{ role: "user", content: "hi" }], { label: "reply" })).resolves.toEqual({ text: "hi" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
