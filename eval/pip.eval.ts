/**
 * Live evaluation of Pip against a real model. Not part of `npm test`.
 *
 *   npm run eval              # all scenarios
 *   EVAL_ONLY=injection npm run eval
 *
 * Needs LLM_BASE_URL, LLM_API_KEY and LLM_MODEL (Pip's model), and optionally
 * EVAL_JUDGE_MODEL (defaults to Pip's model; a different family is better).
 * Writes a report to eval/results/ (gitignored).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { llmConfigFromEnv, OpenAiCompatibleModel } from "../src/lib/learner/teachable/llm";
import { pipView } from "../src/lib/learner/teachable/notebook";
import { probabilityPack as pack } from "../src/lib/learner/teachable/packs/probability";
import { initialState, runOpening, runTurn, type TeachableState } from "../src/lib/learner/teachable/pipeline";
import type { ChatMessage } from "../src/lib/types";
import { ISSUES, judgeReply, type Verdict } from "./judge";
import { SCENARIOS } from "./scenarios";

const config = llmConfigFromEnv();
const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim());
const scenarios = SCENARIOS.filter((s) => !only || only.includes(s.id));

interface TurnRecord {
  student: string;
  pip: string;
  move: string;
  moveNote: string;
  analysis: string;
  verdict: Verdict;
}

describe.skipIf(!config)("Pip live eval", () => {
  const slow = { ...config!, attempts: 8, maxRetryWaitMs: 60_000, timeoutMs: 90_000 };
  const pip = new OpenAiCompatibleModel(slow);
  const judge = new OpenAiCompatibleModel({ ...slow, model: process.env.EVAL_JUDGE_MODEL || slow.model });
  const report: Record<string, { purpose: string; turns: TurnRecord[]; stateFailures: string[] }> = {};

  for (const scenario of scenarios) {
    it(scenario.id, async () => {
      let state: TeachableState = initialState(pack);
      const messages: ChatMessage[] = [];
      const opening = await runOpening({ pack, state, model: pip });
      state = opening.state;
      messages.push({ id: "l0", role: "learner", text: opening.reply.text, createdAt: "" });
      const turns: TurnRecord[] = [];
      let wrappedUp = false;

      for (const [i, text] of scenario.student.entries()) {
        const before = pipView(state.notebook);
        const conversation = [...messages];
        messages.push({ id: `s${i}`, role: "student", text, createdAt: "" });
        const result = await runTurn({ pack, state, messages, model: pip });
        state = result.state;
        messages.push({ id: `l${i + 1}`, role: "learner", text: result.reply.text, createdAt: "" });
        if (result.reply.isFinal) wrappedUp = true;
        const a = state.lastAssessment!;
        const verdict = await judgeReply(judge, {
          pack,
          notebookBefore: before,
          conversation,
          studentText: text,
          move: a.move,
          moveNote: a.moveNote,
          pipText: result.reply.text,
        });
        turns.push({ student: text, pip: result.reply.text, move: a.move, moveNote: a.moveNote, analysis: a.analysis, verdict });
      }

      const stateFailures: string[] = [];
      for (const [id, status] of Object.entries(scenario.expectMisconceptions ?? {})) {
        const actual = state.notebook.beliefs.find((b) => b.misconceptionId === id)?.status;
        if (actual !== status) stateFailures.push(`${id}: expected ${status}, got ${actual}`);
      }
      if (scenario.expectNoWrapUp && wrappedUp) stateFailures.push("wrapped up unexpectedly");
      report[scenario.id] = { purpose: scenario.purpose, turns, stateFailures };
      write(report);

      const issues = turns.flatMap((t, i) => ISSUES.filter((k) => t.verdict[k]).map((k) => `turn ${i + 1}: ${k}`));
      expect({ issues, stateFailures }).toEqual({ issues: [], stateFailures: [] });
    }, 900_000);
  }
});

function write(report: Record<string, { purpose: string; turns: TurnRecord[]; stateFailures: string[] }>) {
  const dir = process.env.EVAL_OUT || "eval/results";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/latest.json`, JSON.stringify(report, null, 2));
  const lines: string[] = ["# Pip eval", ""];
  let replies = 0;
  const counts: Record<string, number> = Object.fromEntries(ISSUES.map((k) => [k, 0]));
  let natural = 0;
  for (const [id, r] of Object.entries(report)) {
    lines.push(`## ${id}`, `_${r.purpose}_`, "");
    for (const t of r.turns) {
      replies++;
      natural += t.verdict.naturalness;
      for (const k of ISSUES) if (t.verdict[k]) counts[k]++;
      const flags = ISSUES.filter((k) => t.verdict[k]);
      lines.push(
        `- **Student:** ${t.student}`,
        `  - **Pip** (${t.move}): ${t.pip}`,
        `  - judge: ${flags.length ? "⚠ " + flags.join(", ") : "ok"} · natural ${t.verdict.naturalness} · ${t.verdict.notes}${t.verdict.leakDetail ? ` · leak: "${t.verdict.leakDetail}"` : ""}`,
      );
    }
    if (r.stateFailures.length) lines.push("", `**State failures:** ${r.stateFailures.join("; ")}`);
    lines.push("");
  }
  lines.splice(
    2,
    0,
    `Replies: ${replies} · ${ISSUES.map((k) => `${k}: ${counts[k]}`).join(" · ")} · mean naturalness: ${(natural / Math.max(replies, 1)).toFixed(2)}`,
    "",
  );
  writeFileSync(`${dir}/latest.md`, lines.join("\n"));
}
