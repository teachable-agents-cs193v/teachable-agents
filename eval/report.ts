/** eval/results/<run>/report.json and report.md. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JudgeUsage } from "./claudeJudge";
import type { Stat } from "./metrics";
import type { CallRecord } from "./pacedModel";
import type { SetResult } from "./runner";

const SET_NAMES: Record<string, string> = {
  A: "A. Assessor verdicts, per message",
  B: "B. Note-taker faithfulness",
  C: "C. Pip in conversation",
  D: "D. Prompt injection and safety",
};

export function sutUsage(calls: Omit<CallRecord, "raw">[]) {
  const groups = new Map<string, { label: string; model: string; calls: number; prompt: number; cached: number; completion: number }>();
  for (const c of calls) {
    const key = `${c.label}|${c.model}`;
    const g = groups.get(key) ?? { label: c.label, model: c.model, calls: 0, prompt: 0, cached: 0, completion: 0 };
    g.calls++;
    g.prompt += c.promptTokens;
    g.cached += c.cachedTokens;
    g.completion += c.completionTokens;
    groups.set(key, g);
  }
  return [...groups.values()];
}

export function judgeUsage(calls: JudgeUsage[]) {
  return {
    calls: calls.length,
    inputTokens: calls.reduce((s, c) => s + c.inputTokens + c.cacheReadTokens + c.cacheCreationTokens, 0),
    outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    costUsd: Math.round(calls.reduce((s, c) => s + c.costUsd, 0) * 100) / 100,
    meanSeconds: calls.length ? Math.round(calls.reduce((s, c) => s + c.ms, 0) / calls.length / 100) / 10 : 0,
  };
}

const fmt = (s: Stat, metric: string) => {
  const pct = !/naturalness|AbsDiff/.test(metric);
  const v = (x: number) => (pct ? `${(x * 100).toFixed(1)}%` : x.toFixed(2));
  return `${v(s.mean)} ± ${v(s.sd)}`;
};

export function writeReport(dir: string, meta: Record<string, unknown>, sets: SetResult[]): { md: string; json: string } {
  mkdirSync(dir, { recursive: true });
  const json = {
    meta,
    sets: sets.map((s) => ({
      set: s.set,
      caseCount: s.caseCount,
      runs: s.runs,
      incomplete: s.incomplete,
      sympy: s.sympy,
      metrics: s.metrics,
      usage: { sut: sutUsage(s.sutCalls), judge: judgeUsage(s.judgeCalls) },
      cases: s.cases,
    })),
  };
  const lines: string[] = ["# Protégé AI eval report", ""];
  for (const [k, v] of Object.entries(meta)) lines.push(`- **${k}:** ${typeof v === "string" ? v : JSON.stringify(v)}`);
  lines.push("", "Rates are mean ± sample standard deviation across runs (n = runs with data). `count` is the mean number of scored items per run.", "");
  for (const s of sets) {
    lines.push(`## ${SET_NAMES[s.set]}`, "");
    lines.push(`${s.caseCount} cases × ${s.runs} run(s)${s.set === "C" || s.set === "D" ? ` · sympy cross-check: ${s.sympy}` : ""}`);
    if (s.incomplete) lines.push("", `**INCOMPLETE:** ${s.incomplete}. Rerun the same command with \`--resume\` to continue.`);
    const errors = s.cases.filter((c) => c.error);
    if (errors.length) lines.push("", `**${errors.length} case run(s) with errors** (left out of the metrics).`);
    lines.push("", "| metric | mean ± sd | n | count |", "| --- | --- | --- | --- |");
    for (const [m, st] of Object.entries(s.metrics)) lines.push(`| ${m} | ${fmt(st, m)} | ${st.n} | ${st.count.toFixed(1)} |`);
    const su = sutUsage(s.sutCalls);
    const ju = judgeUsage(s.judgeCalls);
    lines.push("", "**Usage.** System under test (Groq): " + (su.map((u) => `${u.label} on ${u.model}: ${u.calls} calls, ${u.prompt + u.completion} tokens (avg ${Math.round((u.prompt + u.completion) / u.calls)}/call, ${u.cached} cached prompt)`).join("; ") || "none"));
    lines.push(`Judge (Claude): ${ju.calls} calls, ${ju.inputTokens} input + ${ju.outputTokens} output tokens, $${ju.costUsd}, ${ju.meanSeconds}s/call.`, "");
    lines.push("### Cases", "", "| case | behavior | difficulty | run | result | failures |", "| --- | --- | --- | --- | --- | --- |");
    for (const c of s.cases) {
      const pass = c.scores.find((x) => x.metric === "casePass" || x.metric === "label.casePass");
      const res = c.error ? `error: ${c.error}` : pass ? (pass.value ? "pass" : "FAIL") : "-";
      lines.push(`| ${c.id} | ${c.behavior} | ${c.difficulty} | ${c.run} | ${res} | ${c.failures.join("; ").replace(/\|/g, "\\|").replace(/\n/g, " ") || ""} |`);
    }
    lines.push("");
  }
  const md = lines.join("\n");
  writeFileSync(join(dir, "report.md"), md);
  writeFileSync(join(dir, "report.json"), JSON.stringify(json, null, 1));
  return { md: join(dir, "report.md"), json: join(dir, "report.json") };
}
