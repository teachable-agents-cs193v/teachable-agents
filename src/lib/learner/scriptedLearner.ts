import type { LearnerReply } from "../types";
import { getScript } from "../scripts";
import type { LearnerAdapter, LearnerContext } from "./adapter";

export interface ScriptedLearnerOptions {
  /** Simulated thinking delay range in milliseconds. Set both to 0 in tests. */
  minDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * A transparent, deterministic stand-in for the real AI learner.
 *
 * It walks through a hand-written script for the topic, one step per turn,
 * regardless of what the student wrote. It never pretends to understand the
 * student's answer. Once the script is exhausted it repeats a closing line
 * and flags `isFinal` so the UI can suggest ending the session.
 */
export class ScriptedLearnerAdapter implements LearnerAdapter {
  readonly id = "scripted-demo";
  readonly displayName = "Scripted demo learner";
  private readonly minDelay: number;
  private readonly maxDelay: number;

  constructor(options: ScriptedLearnerOptions = {}) {
    this.minDelay = options.minDelayMs ?? 900;
    this.maxDelay = options.maxDelayMs ?? 1800;
  }

  async open(context: LearnerContext): Promise<LearnerReply> {
    return this.step({ ...context, cursor: 0 });
  }

  async respond(context: LearnerContext): Promise<LearnerReply> {
    return this.step(context);
  }

  private async step(context: LearnerContext): Promise<LearnerReply> {
    const script = getScript(context.topic.id);
    if (!script) {
      throw new Error(`No scripted conversation exists for topic "${context.topic.id}".`);
    }
    await this.pause();

    const step = script.steps[context.cursor];
    if (!step) {
      return {
        text: script.exhaustedReply,
        kind: "closing",
        mood: "happy",
        isFinal: true,
        nextCursor: context.cursor,
      };
    }

    const isLast = context.cursor === script.steps.length - 1;
    return {
      text: step.text,
      kind: step.kind,
      mood: step.mood,
      concept: step.concept,
      misconception: step.misconception,
      isFinal: isLast,
      nextCursor: context.cursor + 1,
    };
  }

  private pause(): Promise<void> {
    if (this.maxDelay <= 0) return Promise.resolve();
    const ms = this.minDelay + Math.random() * Math.max(0, this.maxDelay - this.minDelay);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
