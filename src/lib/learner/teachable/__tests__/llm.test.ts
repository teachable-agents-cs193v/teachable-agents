import { describe, expect, it, vi } from "vitest";
import { llmConfigFromEnv, LlmError, OpenAiCompatibleModel } from "../llm";

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
    // Structured, so the route can tell "out of capacity" from other failures without reading text.
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBe(600);
  });

  it("marks a 429 that's still limited after every retry as rate limited, and other failures as not", async () => {
    const stillLimited = new OpenAiCompatibleModel(config, vi.fn(async () => limited("0")) as unknown as typeof fetch);
    const limitedError = (await stillLimited.completeJson([{ role: "user", content: "hi" }], { label: "reply" }).catch((e: unknown) => e)) as LlmError;
    expect(limitedError.kind).toBe("rate_limited");
    expect(limitedError.retryable).toBe(true);
    expect(limitedError.retryAfterSeconds).toBeUndefined();

    const down = new OpenAiCompatibleModel(config, vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch);
    const downError = (await down.completeJson([{ role: "user", content: "hi" }], { label: "reply" }).catch((e: unknown) => e)) as LlmError;
    expect(downError).toBeInstanceOf(LlmError);
    expect(downError.kind).toBe("other");
  });

  it("retries a short per-minute limit and succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(limited("0")).mockResolvedValueOnce(ok({ text: "hi" }));
    const model = new OpenAiCompatibleModel(config, fetchImpl as unknown as typeof fetch);
    await expect(model.completeJson([{ role: "user", content: "hi" }], { label: "reply" })).resolves.toEqual({ text: "hi" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("llmConfigFromEnv roles", () => {
  const env = { LLM_BASE_URL: "https://example.test/v1/", LLM_API_KEY: "k", LLM_MODEL: "big" };

  it("uses LLM_MODEL for every role when no role model is set", () => {
    expect(llmConfigFromEnv(env)?.model).toBe("big");
    expect(llmConfigFromEnv(env, "assessor")?.model).toBe("big");
    expect(llmConfigFromEnv(env, "pip")?.model).toBe("big");
  });

  it("lets LLM_MODEL_ASSESSOR and LLM_MODEL_PIP override it per role", () => {
    const split = { ...env, LLM_MODEL_ASSESSOR: "judge", LLM_MODEL_PIP: " small " };
    expect(llmConfigFromEnv(split, "assessor")?.model).toBe("judge");
    expect(llmConfigFromEnv(split, "pip")?.model).toBe("small");
    expect(llmConfigFromEnv(split)?.model).toBe("big");
  });

  it("works with only role models set, and returns null without a key", () => {
    const rolesOnly = { LLM_BASE_URL: "https://x/v1", LLM_API_KEY: "k", LLM_MODEL_PIP: "small" };
    expect(llmConfigFromEnv(rolesOnly, "pip")?.model).toBe("small");
    expect(llmConfigFromEnv(rolesOnly, "assessor")).toBeNull();
    expect(llmConfigFromEnv({ ...env, LLM_API_KEY: "" }, "pip")).toBeNull();
  });
});

describe("OpenAiCompatibleModel usage", () => {
  it("records prompt-cache hits when the provider reports them", async () => {
    const body = {
      choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 100, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 80 } },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const model = new OpenAiCompatibleModel(config, fetchImpl as unknown as typeof fetch);
    await model.completeJson([{ role: "user", content: "hi" }], { label: "assessor" });
    expect(model.usage.assessor).toEqual({ calls: 1, prompt: 100, cached: 80, completion: 5 });
  });
});
