/**
 * Wraps the app's own models (from modelsFromEnv(), the systems under test) to:
 * - pace calls under a tokens-per-minute budget per model (Groq free tier: ~8k TPM);
 * - retry rate limits and transient failures with long waits;
 * - stop the run on a daily-quota error (QuotaExhaustedError), so it can be resumed;
 * - record each call: label, model, tokens, time and the raw JSON it returned.
 * It never changes the request or the response.
 */

import { LlmError, type ChatTurn, type JsonCallOptions, type JsonModel } from "../src/lib/learner/teachable/llm";

export interface CallRecord {
  /** Order of the call within the process. */
  seq: number;
  label: string;
  model: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  ms: number;
  raw: unknown;
}

type Usage = Record<string, { calls: number; prompt: number; cached: number; completion: number }>;

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

let seq = 0;
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A sliding one-minute token window for one model. */
export class TokenLimiter {
  private window: { at: number; tokens: number }[] = [];
  private estimates = new Map<string, number>();

  constructor(
    readonly tokensPerMinute: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = realSleep,
  ) {}

  /** Expected tokens for a call with this label: the last one's size, or a default. */
  estimate(label: string): number {
    return this.estimates.get(label) ?? 3000;
  }

  async waitFor(label: string): Promise<number> {
    let waited = 0;
    const need = Math.min(this.estimate(label), this.tokensPerMinute);
    for (;;) {
      const t = this.now();
      this.window = this.window.filter((w) => t - w.at < 60_000);
      const used = this.window.reduce((s, w) => s + w.tokens, 0);
      if (used + need <= this.tokensPerMinute || this.window.length === 0) return waited;
      const wait = Math.max(500, this.window[0].at + 60_000 - t + 250);
      waited += wait;
      await this.sleep(wait);
    }
  }

  record(label: string, tokens: number): void {
    this.window.push({ at: this.now(), tokens });
    this.estimates.set(label, tokens);
  }
}

export class PacedModel implements JsonModel {
  readonly name: string;
  /** Calls since the last drain(). */
  private calls: CallRecord[] = [];
  /** Time spent waiting out quota limits this run (bounded by maxQuotaWaitMs). */
  private quotaWaitedMs = 0;

  constructor(
    private readonly inner: JsonModel & { usage?: Usage },
    private readonly limiter: TokenLimiter,
    private readonly options: { retries?: number; retryWaitMs?: number; maxQuotaWaitMs?: number; sleep?: (ms: number) => Promise<void>; log?: (line: string) => void } = {},
  ) {
    this.name = inner.name;
  }

  drain(): CallRecord[] {
    const out = this.calls;
    this.calls = [];
    return out;
  }

  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    const retries = this.options.retries ?? 6;
    const sleep = this.options.sleep ?? realSleep;
    for (let attempt = 0; ; attempt++) {
      await this.limiter.waitFor(options.label);
      const before = { ...(this.inner.usage?.[options.label] ?? { calls: 0, prompt: 0, cached: 0, completion: 0 }) };
      const started = Date.now();
      try {
        const raw = await this.inner.completeJson(messages, options);
        const after = this.inner.usage?.[options.label] ?? before;
        const record: CallRecord = {
          seq: seq++,
          label: options.label,
          model: this.name,
          promptTokens: after.prompt - before.prompt,
          cachedTokens: after.cached - before.cached,
          completionTokens: after.completion - before.completion,
          ms: Date.now() - started,
          raw,
        };
        this.limiter.record(options.label, record.promptTokens + record.completionTokens || this.limiter.estimate(options.label));
        this.calls.push(record);
        return raw;
      } catch (error) {
        const after = this.inner.usage?.[options.label] ?? before;
        this.limiter.record(options.label, after.prompt - before.prompt + after.completion - before.completion || this.limiter.estimate(options.label));
        if (error instanceof LlmError && !error.retryable && /\b429\b/.test(error.message)) {
          // Groq's daily token cap is a rolling window: a Retry-After of minutes means tokens come
          // back soon. Wait those out (up to maxQuotaWaitMs in total) instead of stopping the run.
          const seconds = Number(/retry after (\d+(?:\.\d+)?)s/.exec(error.message)?.[1] ?? NaN);
          const wait = (seconds + 5) * 1000;
          const budget = this.options.maxQuotaWaitMs ?? 3 * 60 * 60 * 1000;
          if (Number.isFinite(seconds) && seconds <= 20 * 60 && this.quotaWaitedMs + wait <= budget) {
            this.quotaWaitedMs += wait;
            this.options.log?.(`  ${options.label} (${this.name}): rate-limited; waiting ${Math.round(wait / 1000)}s for the rolling quota`);
            await sleep(wait);
            continue;
          }
          throw new QuotaExhaustedError(`${this.name}: ${error.message}. The daily quota is probably used up; resume later.`);
        }
        if (!(error instanceof LlmError) || !error.retryable || attempt >= retries) throw error;
        this.options.log?.(`  ${options.label} (${this.name}): ${error.message}; retrying in ${Math.round((this.options.retryWaitMs ?? 65_000) / 1000)}s`);
        await sleep(this.options.retryWaitMs ?? 65_000);
      }
    }
  }
}

/** Wraps both roles; roles on the same model share one limiter (same quota). */
export function pace(
  models: { pip: JsonModel; assessor: JsonModel },
  tokensPerMinute: number,
  options: ConstructorParameters<typeof PacedModel>[2] = {},
): { pip: PacedModel; assessor: PacedModel; drain: () => CallRecord[] } {
  const limiters = new Map<string, TokenLimiter>();
  const limiter = (name: string) => {
    if (!limiters.has(name)) limiters.set(name, new TokenLimiter(tokensPerMinute));
    return limiters.get(name)!;
  };
  const pip = new PacedModel(models.pip, limiter(models.pip.name), options);
  const assessor = models.assessor === models.pip ? pip : new PacedModel(models.assessor, limiter(models.assessor.name), options);
  return {
    pip,
    assessor,
    drain: () => (pip === assessor ? pip.drain() : [...pip.drain(), ...assessor.drain()].sort((a, b) => a.seq - b.seq)),
  };
}
