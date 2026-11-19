/**
 * The judge is Claude via Claude Code, enforced in code:
 * - no file under eval/ may build a model client or call a model API for judging (the systems
 *   under test get the app's own models from modelsFromEnv(), which lives in src/);
 * - only eval/claudeJudge.ts may start the `claude` CLI, and it pins the model and turns off
 *   every tool and MCP server.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { assertClaudeAvailable, ClaudeJudge, judgeArgs, judgeEnv, JUDGE_MODEL, JudgeUnavailableError, preflightJudge, readResult, type ClaudeRunner } from "../claudeJudge";

const EVAL_DIR = join(process.cwd(), "eval");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "results" || name === ".venv" || name === "human") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|mts|mjs|js|cjs|py)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(EVAL_DIR).filter((f) => !f.includes(`${join("eval", "__tests__")}`));
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(process.cwd(), f);

describe("Claude is the only judge", () => {
  it("finds the eval sources to scan", () => {
    expect(files.map(rel)).toEqual(expect.arrayContaining(["eval/claudeJudge.ts", "eval/runner.ts", "eval/suite.eval.ts", "eval/rubrics.ts"]));
  });

  // Anything that would let eval code talk to a model other than through `claude -p`.
  const FORBIDDEN: [RegExp, string][] = [
    [/\bOpenAiCompatibleModel\b/, "the app's OpenAI-compatible client (judges must not construct model clients)"],
    [/\bllmConfigFromEnv\b/, "LLM config for building a client"],
    [/EVAL_JUDGE_MODEL/, "the old Groq judge setting"],
    [/chat\/completions/, "an OpenAI-compatible endpoint"],
    [/api\.(groq|openai|anthropic)\.com/, "a model API host"],
    [/generativelanguage\.googleapis|openrouter\.ai|localhost:11434/, "a model API host"],
    [/@anthropic-ai\/|from ["']openai["']|require\(["']openai["']\)|groq-sdk|@google\/genai|ollama/, "a model SDK"],
    [/\bfetch\s*\(/, "a raw HTTP call"],
  ];

  for (const [pattern, what] of FORBIDDEN) {
    it(`no eval file uses ${what}`, () => {
      const offenders = files.filter((f) => pattern.test(read(f))).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("only claudeJudge.ts starts the claude CLI; only it and sympy.ts start any process", () => {
    const spawning = files.filter((f) => /child_process/.test(read(f))).map(rel).sort();
    expect(spawning).toEqual(["eval/claudeJudge.ts", "eval/run.mjs", "eval/sympy.ts"]);
    // run.mjs only starts vitest; sympy.ts only starts python.
    expect(read(join(EVAL_DIR, "run.mjs"))).not.toMatch(/["'`]claude["'`]/);
    expect(read(join(EVAL_DIR, "sympy.ts"))).not.toMatch(/["'`]claude["'`]/);
    const claudeSpawns = files.filter((f) => /spawn(Sync)?\(\s*["'`]claude["'`]/.test(read(f))).map(rel);
    expect(claudeSpawns).toEqual(["eval/claudeJudge.ts"]);
  });

  it("the live suite judges only with ClaudeJudge and gets the systems under test from modelsFromEnv()", () => {
    const suite = read(join(EVAL_DIR, "suite.eval.ts"));
    expect(suite).toMatch(/new ClaudeJudge\(/);
    expect(suite).toMatch(/modelsFromEnv\(\)/);
    const judges = files.filter((f) => /implements Judge\b/.test(read(f))).map(rel);
    expect(judges).toEqual(["eval/claudeJudge.ts"]);
  });
});

describe("the judge invocation", () => {
  const args = judgeArgs({ schema: { type: "object" }, system: "rubric" });
  const value = (flag: string) => args[args.indexOf(flag) + 1];

  it("is headless, pinned to claude-opus-5-5, JSON output with a schema", () => {
    expect(JUDGE_MODEL).toBe("claude-opus-5-5");
    expect(args[0]).toBe("-p");
    expect(value("--model")).toBe("claude-opus-5-5");
    expect(value("--output-format")).toBe("json");
    expect(JSON.parse(value("--json-schema"))).toEqual({ type: "object" });
    expect(value("--system-prompt")).toBe("rubric");
  });

  it("disables every tool, every MCP server, settings, skills and session saving", () => {
    expect(value("--tools")).toBe("");
    expect(args).toContain("--strict-mcp-config");
    expect(JSON.parse(value("--mcp-config"))).toEqual({ mcpServers: {} });
    expect(value("--setting-sources")).toBe("");
    expect(args).toEqual(expect.arrayContaining(["--safe-mode", "--disable-slash-commands", "--no-session-persistence"]));
    expect(value("--permission-mode")).toBe("dontAsk");
    expect(value("--permission-prompts")).toBe("none");
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args.some((a) => /allowed-?tools/i.test(a))).toBe(false);
  });

  it("never passes the prompt on the command line (it goes on stdin)", async () => {
    const calls: { args: string[]; stdin: string; env: NodeJS.ProcessEnv }[] = [];
    const run: ClaudeRunner = async (a, stdin, o) => {
      calls.push({ args: a, stdin, env: o.env });
      return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: { ok: true }, permission_denials: [], modelUsage: { [JUDGE_MODEL]: {} }, usage: { input_tokens: 3, output_tokens: 2 } }) };
    };
    const out = await new ClaudeJudge({ run }).judge({ label: "x", system: "s", prompt: "SECRET-CASE-TEXT", schema: {} });
    expect(out.value).toEqual({ ok: true });
    expect(calls[0].stdin).toBe("SECRET-CASE-TEXT");
    expect(calls[0].args.join(" ")).not.toContain("SECRET-CASE-TEXT");
  });

  it("keeps Groq keys, database settings and the parent session out of the judge's environment", () => {
    const env = judgeEnv({ PATH: "/bin", HOME: "/h", LLM_API_KEY: "k", DATABASE_URL: "d", CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s", EVAL_SETS: "A" } as unknown as NodeJS.ProcessEnv);
    expect(env).toEqual({ PATH: "/bin", HOME: "/h" });
  });

  it("rejects a result that used a tool, came from another model or has no structured output", () => {
    const ok = { type: "result", subtype: "success", is_error: false, structured_output: { a: 1 }, permission_denials: [] };
    expect(readResult(JSON.stringify(ok)).value).toEqual({ a: 1 });
    expect(() => readResult(JSON.stringify({ ...ok, permission_denials: [{ tool_name: "Bash" }] }))).toThrow(/tool/);
    expect(() => readResult(JSON.stringify({ ...ok, modelUsage: { "claude-haiku": {} } }))).toThrow(/not claude-opus-5-5/);
    expect(() => readResult(JSON.stringify({ ...ok, structured_output: undefined }))).toThrow(/structured/);
    expect(() => readResult(JSON.stringify({ ...ok, is_error: true, subtype: "error_max_budget_usd" }))).toThrow();
    expect(() => readResult("not json")).toThrow();
  });

  it("preflight refuses a judge session with tools or MCP servers", async () => {
    const init = (extra: object) => JSON.stringify({ type: "system", subtype: "init", tools: ["StructuredOutput"], mcp_servers: [], model: JUDGE_MODEL, ...extra });
    const done = JSON.stringify({ type: "result", is_error: false });
    const runner = (line: string): ClaudeRunner => async () => ({ code: 0, stderr: "", stdout: `${line}\n${done}\n` });
    await expect(preflightJudge(runner(init({})))).resolves.toMatchObject({ tools: ["StructuredOutput"] });
    await expect(preflightJudge(runner(init({ tools: ["StructuredOutput", "Bash"] })))).rejects.toThrow(/tools/);
    await expect(preflightJudge(runner(init({ mcp_servers: [{ name: "x" }] })))).rejects.toThrow(/MCP/);
    await expect(preflightJudge(runner(init({ model: "claude-sonnet" })))).rejects.toThrow(/model/);
  });

  it("fails fast with a clear message when the claude CLI is missing", () => {
    const missing = (() => ({ error: Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }), status: null })) as never;
    expect(() => assertClaudeAvailable(missing)).toThrow(JudgeUnavailableError);
    expect(() => assertClaudeAvailable(missing)).toThrow(/Claude Code.*`claude -p`/);
  });
});
