/** Test helpers (not a test file): fake models answering by call label, and a fake judge. */

import type { ChatTurn, JsonCallOptions, JsonModel } from "../../src/lib/learner/teachable/llm";
import type { Judge, JudgeRequest, JudgeUsage } from "../claudeJudge";

type Answer = unknown | ((messages: ChatTurn[], options: JsonCallOptions, call: number) => unknown);

/** A model that answers each label from a queue (the last answer repeats) and counts tokens like the real client. */
export class FakeModel implements JsonModel {
  readonly usage: Record<string, { calls: number; prompt: number; cached: number; completion: number }> = {};
  readonly seen: { label: string; messages: ChatTurn[] }[] = [];
  private counts: Record<string, number> = {};

  constructor(
    readonly name: string,
    private readonly answers: Record<string, Answer[]>,
  ) {}

  async completeJson(messages: ChatTurn[], options: JsonCallOptions): Promise<unknown> {
    const n = (this.counts[options.label] = (this.counts[options.label] ?? 0) + 1) - 1;
    this.seen.push({ label: options.label, messages });
    const queue = this.answers[options.label] ?? [{}];
    const a = queue[Math.min(n, queue.length - 1)];
    const u = (this.usage[options.label] ??= { calls: 0, prompt: 0, cached: 0, completion: 0 });
    u.calls++;
    u.prompt += 1000;
    u.completion += 100;
    return typeof a === "function" ? (a as (m: ChatTurn[], o: JsonCallOptions, c: number) => unknown)(messages, options, n) : a;
  }
}

export class FakeJudge implements Judge {
  readonly model = "fake-judge";
  readonly requests: JudgeRequest[] = [];
  constructor(private readonly answer: (request: JudgeRequest, call: number) => unknown) {}
  async judge<T>(request: JudgeRequest): Promise<{ value: T; usage: JudgeUsage }> {
    this.requests.push(request);
    return {
      value: this.answer(request, this.requests.length - 1) as T,
      usage: { label: request.label, inputTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0, outputTokens: 5, costUsd: 0.01, ms: 1 },
    };
  }
}
