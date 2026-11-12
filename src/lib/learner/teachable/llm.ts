/**
 * Minimal client for any OpenAI-compatible chat completions API
 * (Groq, Gemini's OpenAI endpoint, Ollama, OpenRouter...). Server-only: the
 * key comes from env vars and never reaches the browser.
 */

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonCallOptions {
  /** Shown in errors and logs, e.g. "assessor". */
  label: string;
  temperature?: number;
  maxTokens?: number;
  /** For reasoning models such as gpt-oss. Ignored by providers that don't support it. */
  reasoningEffort?: "low" | "medium" | "high";
}

/** Anything that can answer a chat with a JSON object. Tests pass a fake. */
export interface JsonModel {
  readonly name: string;
  completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Attempts per call, including the first. */
  attempts?: number;
  /** Longest wait between attempts after a rate limit. Keep short in the app; the eval harness raises it. */
  maxRetryWaitMs?: number;
}

/** Reads LLM_BASE_URL, LLM_API_KEY and LLM_MODEL. Returns null when any is missing. */
export function llmConfigFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const baseUrl = env.LLM_BASE_URL?.trim();
  const apiKey = env.LLM_API_KEY?.trim();
  const model = env.LLM_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Seconds to wait from a Retry-After header, capped so a request never hangs for long. */
function retryAfterMs(response: Response, attempt: number, cap: number): number {
  const header = Number(response.headers.get("retry-after"));
  const base = Number.isFinite(header) && header > 0 ? header * 1000 : 1000 * 2 ** attempt;
  return Math.min(base, cap);
}

export class OpenAiCompatibleModel implements JsonModel {
  readonly name: string;

  constructor(
    private readonly config: LlmConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.name = config.model;
  }

  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    const attempts = this.config.attempts ?? 3;
    let lastError: LlmError | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.once(messages, options);
      } catch (error) {
        lastError = error instanceof LlmError ? error : new LlmError(String(error), true);
        if (!lastError.retryable || attempt === attempts - 1) break;
      }
    }
    throw lastError ?? new LlmError(`${options.label}: no response`, false);
  }

  private async once(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      response_format: { type: "json_object" },
      temperature: options.temperature ?? 0.7,
      max_completion_tokens: options.maxTokens ?? 1200,
    };
    if (options.reasoningEffort && /gpt-oss/i.test(this.config.model)) body.reasoning_effort = options.reasoningEffort;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new LlmError(`${options.label}: request failed (${(error as Error).name})`, true);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429 || response.status >= 500) {
      await sleep(retryAfterMs(response, 0, this.config.maxRetryWaitMs ?? 8000));
      throw new LlmError(`${options.label}: provider returned ${response.status}`, true);
    }
    if (!response.ok) {
      // Never include the response body: some providers echo request headers.
      throw new LlmError(`${options.label}: provider returned ${response.status}`, response.status === 400);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new LlmError(`${options.label}: empty response`, true);
    }
    try {
      return JSON.parse(stripFences(content));
    } catch {
      throw new LlmError(`${options.label}: response was not valid JSON`, true);
    }
  }
}

/** Some models wrap JSON in ``` fences even in JSON mode. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}
