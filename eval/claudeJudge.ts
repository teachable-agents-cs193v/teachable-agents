/**
 * THE ONLY JUDGE. Every model judgment in the eval suite goes through this module, and it only
 * ever runs Claude through Claude Code headless (`claude -p`). There is no other judge path:
 * eval/__tests__/judgeEnforcement.test.ts fails if any file under eval/ builds a model client.
 *
 * Each call spawns:
 *
 *   claude -p --model claude-opus-5-5 --output-format json --json-schema <schema>
 *     --tools "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources ""
 *     --safe-mode --disable-slash-commands --no-session-persistence
 *     --permission-mode dontAsk --permission-prompts none --max-budget-usd <n>
 *     --system-prompt <rubric>
 *
 * with the prompt on stdin, in an empty temporary directory, with an environment that has no
 * Groq key or database settings. The judge sees the answer key and transcripts, but it has no
 * tools and no MCP servers, and it can only return the JSON its schema allows, which goes into a
 * local report. `preflightJudge()` checks once per run (with a stream-json probe, whose init event
 * lists the session's tools and MCP servers) that the only tool is Claude Code's built-in
 * `StructuredOutput` and that no MCP server is connected, and refuses to judge otherwise.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Pinned: every verdict in a report comes from this model. */
export const JUDGE_MODEL = "claude-opus-5-5";

/** The one tool a `--json-schema` session has: Claude Code's built-in structured-output tool. */
export const ALLOWED_JUDGE_TOOLS = ["StructuredOutput"];

export interface JudgeRequest {
  /** For logs and the usage table, e.g. "assessorReference". */
  label: string;
  /** The rubric. Replaces Claude Code's default system prompt. */
  system: string;
  /** The case to judge. Sent on stdin. */
  prompt: string;
  /** JSON Schema of the verdict. Claude Code validates the output against it. */
  schema: Record<string, unknown>;
}

export interface JudgeUsage {
  label: string;
  inputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
}

/** What the eval code depends on. Production uses ClaudeJudge; unit tests pass a fake. */
export interface Judge {
  readonly model: string;
  judge<T>(request: JudgeRequest): Promise<{ value: T; usage: JudgeUsage }>;
}

export class JudgeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeUnavailableError";
  }
}

/** The exact argv for one judge call (without the `claude` binary itself). */
export function judgeArgs(request: Pick<JudgeRequest, "schema" | "system">, maxBudgetUsd = 2): string[] {
  return [
    "-p",
    "--model",
    JUDGE_MODEL,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(request.schema),
    // No built-in tools at all ("" = none). StructuredOutput is added by --json-schema.
    "--tools",
    "",
    // No MCP servers: only those in --mcp-config (none), ignoring user/project/claude.ai ones.
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    // No user/project/local settings (hooks, permissions, plugins), no CLAUDE.md, skills or commands.
    "--setting-sources",
    "",
    "--safe-mode",
    "--disable-slash-commands",
    "--no-session-persistence",
    // Nothing may prompt or be approved.
    "--permission-mode",
    "dontAsk",
    "--permission-prompts",
    "none",
    "--max-budget-usd",
    String(maxBudgetUsd),
    "--system-prompt",
    request.system,
  ];
}

/** Environment for the judge: no Groq key, no database, not nested in a parent Claude Code session. */
export function judgeEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out = {} as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(env)) {
    if (/^(LLM_|DATABASE_URL|DB_|BETTER_AUTH_|EVAL_)/.test(key)) continue;
    if (key === "CLAUDECODE" || key === "CLAUDE_PID" || key === "CLAUDE_EFFORT") continue;
    if (/^CLAUDE_CODE_(ENTRYPOINT|SESSION_ID|CHILD_SESSION|MESSAGING_|SESSION_ATTENDED|EXECPATH)/.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export type SpawnResult = { code: number | null; stdout: string; stderr: string };
/** Runs `claude` with argv and stdin. Injected in tests. */
export type ClaudeRunner = (args: string[], stdin: string, options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }) => Promise<SpawnResult>;

export const runClaude: ClaudeRunner = (args, stdin, { cwd, env, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(stdin);
  });

/** Fails fast, with a clear message, when the `claude` CLI isn't installed. */
export function assertClaudeAvailable(run: typeof spawnSync = spawnSync): string {
  const result = run("claude", ["--version"], { encoding: "utf8", env: judgeEnv() });
  if (result.error || result.status !== 0) {
    throw new JudgeUnavailableError(
      "The eval judge is Claude, run through Claude Code (`claude -p`), and the `claude` CLI was not found or did not run. " +
        "Install Claude Code and log in (run `claude` once), then rerun. There is no other judge.",
    );
  }
  return String(result.stdout).trim();
}

/** The parts of a `claude -p --output-format json` result this module reads. */
interface ClaudeResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  structured_output?: unknown;
  permission_denials?: unknown[];
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  modelUsage?: Record<string, unknown>;
}

/** Checks one result and returns the verdict. Throws on anything unexpected. */
export function readResult(stdout: string): { value: unknown; result: ClaudeResult } {
  let result: ClaudeResult;
  try {
    result = JSON.parse(stdout) as ClaudeResult;
  } catch {
    throw new Error("judge: claude did not print a JSON result");
  }
  if (result.is_error || result.subtype !== "success") throw new Error(`judge: claude returned ${result.subtype ?? "an error"}`);
  if (Array.isArray(result.permission_denials) && result.permission_denials.length > 0) {
    throw new Error("judge: the session tried to use a tool (permission denied); verdict discarded");
  }
  const models = Object.keys(result.modelUsage ?? {});
  if (models.length > 0 && models.some((m) => m !== JUDGE_MODEL)) throw new Error(`judge: answered by ${models.join(", ")}, not ${JUDGE_MODEL}`);
  const value = result.structured_output;
  if (!value || typeof value !== "object") throw new Error("judge: no structured output");
  return { value, result };
}

/**
 * One probe session (stream-json, so the init event lists the session's tools and MCP servers).
 * Throws unless the only tool is StructuredOutput, there are no MCP servers and the model is pinned.
 */
export async function preflightJudge(run: ClaudeRunner = runClaude): Promise<{ tools: string[]; mcpServers: unknown[]; model: string }> {
  const args = judgeArgs({ schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }, system: "Reply with ok = true." });
  const i = args.indexOf("json", args.indexOf("--output-format"));
  args.splice(i, 1, "stream-json", "--verbose");
  let out: SpawnResult;
  try {
    out = await run(args, "Reply with ok = true.", { cwd: scratchDir(), env: judgeEnv(), timeoutMs: 120_000 });
  } catch (error) {
    throw new JudgeUnavailableError(`judge preflight: could not run claude (${(error as Error).message})`);
  }
  const events = out.stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  if (!init) throw new JudgeUnavailableError(`judge preflight: claude did not start (exit ${out.code}). Is Claude Code logged in? ${out.stderr.slice(0, 300)}`);
  const tools = (init.tools as string[]) ?? [];
  const mcpServers = (init.mcp_servers as unknown[]) ?? [];
  const model = String(init.model ?? "");
  if (tools.some((t) => !ALLOWED_JUDGE_TOOLS.includes(t))) throw new JudgeUnavailableError(`judge preflight: the judge session has tools ${tools.join(", ")}; refusing to judge`);
  if (mcpServers.length > 0) throw new JudgeUnavailableError("judge preflight: the judge session has MCP servers; refusing to judge");
  if (model !== JUDGE_MODEL) throw new JudgeUnavailableError(`judge preflight: model is ${model}, expected ${JUDGE_MODEL}`);
  const result = events.find((e) => e.type === "result");
  if (!result || result.is_error) throw new JudgeUnavailableError(`judge preflight: the probe call failed. ${out.stderr.slice(0, 300)}`);
  return { tools, mcpServers, model };
}

let scratch: string | null = null;
/** An empty working directory, so the judge session never sees this repository. */
function scratchDir(): string {
  scratch ??= mkdtempSync(join(tmpdir(), "protege-judge-"));
  return scratch;
}

export class ClaudeJudge implements Judge {
  readonly model = JUDGE_MODEL;

  constructor(
    private readonly options: { run?: ClaudeRunner; attempts?: number; timeoutMs?: number; maxBudgetUsd?: number } = {},
  ) {}

  async judge<T>(request: JudgeRequest): Promise<{ value: T; usage: JudgeUsage }> {
    const run = this.options.run ?? runClaude;
    const attempts = this.options.attempts ?? 3;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const started = Date.now();
      try {
        const out = await run(judgeArgs(request, this.options.maxBudgetUsd), request.prompt, {
          cwd: scratchDir(),
          env: judgeEnv(),
          timeoutMs: this.options.timeoutMs ?? 300_000,
        });
        if (out.code !== 0 && !out.stdout.trim()) throw new Error(`judge: claude exited ${out.code}: ${out.stderr.slice(0, 300)}`);
        const { value, result } = readResult(out.stdout);
        return {
          value: value as T,
          usage: {
            label: request.label,
            inputTokens: result.usage?.input_tokens ?? 0,
            cacheReadTokens: result.usage?.cache_read_input_tokens ?? 0,
            cacheCreationTokens: result.usage?.cache_creation_input_tokens ?? 0,
            outputTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.total_cost_usd ?? 0,
            ms: result.duration_ms ?? Date.now() - started,
          },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new JudgeUnavailableError("judge: the `claude` CLI is not on PATH");
        lastError = error as Error;
      }
    }
    throw lastError ?? new Error("judge: no result");
  }
}
