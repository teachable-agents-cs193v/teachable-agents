"use client";

/**
 * Pip's reply written on the student's device by WebLLM (WebGPU), for topics with an on-device
 * model (TopicPack.device). The server still owns the transcript, the notebook and the assessor;
 * the device only turns the notebook-only prompt the server sends into Pip's words.
 *
 * The model is Qwen3-0.6B with the topic unlearned (research/unlearning), packed in WebLLM's
 * format with research/unlearning/mlc_pack.py. It runs on WebLLM's prebuilt Qwen3-0.6B library,
 * since the architecture is the same.
 */
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import type { ChatTurn } from "../teachable/llm";

/** Where the weights are served from. WebLLM appends "resolve/main/" to this. */
const MODEL_URL = process.env.NEXT_PUBLIC_DEVICE_PIP_URL ?? "/webllm/pip-v10-q0f16-MLC/";
const MODEL_ID = "pip-v10-q0f16";
/** The prebuilt library this model runs on (same architecture and quantization). */
const LIBRARY_OF = "Qwen3-0.6B-q0f16-MLC";

export interface DeviceStats {
  tokens: number;
  seconds: number;
  tokensPerSecond: number;
}

/** True when this browser can run the model at all (WebGPU). */
export function deviceSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

let engine: Promise<MLCEngineInterface> | null = null;

/** Loads the model once per page (downloads it the first time; later loads come from the browser cache). */
export function loadDevicePip(onProgress: (text: string, fraction: number) => void): Promise<MLCEngineInterface> {
  engine ??= (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const library = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === LIBRARY_OF);
    if (!library) throw new Error(`WebLLM has no prebuilt ${LIBRARY_OF}.`);
    return webllm.CreateMLCEngine(MODEL_ID, {
      appConfig: {
        model_list: [
          {
            model: new URL(MODEL_URL, window.location.origin).href,
            model_id: MODEL_ID,
            model_lib: library.model_lib,
            overrides: { context_window_size: 4096 },
          },
        ],
      },
      initProgressCallback: (report) => onProgress(report.text, report.progress),
    });
  })();
  engine.catch(() => (engine = null)); // a failed load can be tried again
  return engine;
}

/** Pip's reply for the server's prompt, and how fast it was written. */
export async function writeOnDevice(messages: ChatTurn[]): Promise<{ text: string; stats: DeviceStats }> {
  if (!engine) throw new Error("The on-device Pip isn't loaded.");
  const loaded = await engine;
  const started = performance.now();
  const reply = await loaded.chat.completions.create({
    messages,
    temperature: 0.6,
    top_p: 0.9,
    // Short replies, and a penalty on repeats: without it a 0.6B model can loop on one phrase.
    max_tokens: 110,
    frequency_penalty: 0.6,
    presence_penalty: 0.3,
    // Trained without thinking: WebLLM then adds the empty <think> block the training template had.
    extra_body: { enable_thinking: false },
  });
  const seconds = (performance.now() - started) / 1000;
  const text = (reply.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const tokens = reply.usage?.completion_tokens ?? 0;
  const decode = reply.usage?.extra?.decode_tokens_per_s;
  return { text, stats: { tokens, seconds, tokensPerSecond: decode ?? (seconds > 0 ? tokens / seconds : 0) } };
}
