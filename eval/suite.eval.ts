/**
 * The live eval: real pipeline, real Groq models (the systems under test, via the app's own
 * modelsFromEnv()), and Claude as the only judge (eval/claudeJudge.ts). Not part of `npm test`.
 * Run it with `npm run eval -- --set=A,B,C,D` (see eval/README.md).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { modelsFromEnv } from "../src/lib/learner/teachable/server";
import { loadSet, type SetId } from "./cases";
import { assertClaudeAvailable, ClaudeJudge, JUDGE_MODEL, preflightJudge, type Judge } from "./claudeJudge";
import { optionsFromEnv, runDir, selectCases } from "./options";
import { pace } from "./pacedModel";
import { writeReport } from "./report";
import { runSet, type SetResult } from "./runner";
import { sympyPython } from "./sympy";

const options = optionsFromEnv();
const { dir, id } = runDir(options);
const log = (line: string) => process.stderr.write(`${line}\n`);
const results: SetResult[] = [];
let judge: Judge | null = null;
let claudeVersion = "";

describe("Protégé AI evals", () => {
  beforeAll(async () => {
    // Fail fast: the judge must be Claude Code, and the systems under test need the app's model env.
    if (!options.noJudge) {
      claudeVersion = assertClaudeAvailable();
      const probe = await preflightJudge();
      log(`judge: ${JUDGE_MODEL} via Claude Code ${claudeVersion}; tools [${probe.tools.join(", ")}], MCP servers: ${probe.mcpServers.length}`);
      judge = new ClaudeJudge();
    }
    if (!modelsFromEnv()) throw new Error("The systems under test need LLM_BASE_URL, LLM_API_KEY and LLM_MODEL (see docs/AI_LEARNER.md), e.g. in .env.local.");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "options.json"), JSON.stringify(options, null, 1));
    log(`results: ${dir}`);
  });

  for (const set of options.sets) {
    it(`set ${set}`, async () => {
      const cases = selectCases(loadSet(set as SetId), options);
      const app = modelsFromEnv()!;
      const paced = pace(app, options.tpm, { log });
      const result = await runSet(set as SetId, cases, { models: { pip: paced.pip, assessor: paced.assessor, drain: paced.drain }, judge }, {
        runs: options.runs,
        judgeRepeat: options.noJudge ? 0 : options.judgeRepeat,
        outDir: dir,
        judgeConcurrency: options.judgeConcurrency,
        sympyPython: set === "C" || set === "D" ? sympyPython() : null,
        log,
      });
      results.push(result);
      write();
      if (result.incomplete) log(`set ${set} stopped early. Resume with: npm run eval -- --set=${options.sets.join(",")} --runs=${options.runs} --resume=${id}`);
    }, 24 * 3600_000);
  }

  afterAll(() => {
    if (results.length) {
      const paths = write();
      log(`report: ${paths.md}`);
    }
  });
});

function write() {
  const app = modelsFromEnv();
  return writeReport(dir, {
    run: id,
    date: new Date().toISOString(),
    judge: options.noJudge ? "none (--no-judge)" : `${JUDGE_MODEL} via claude -p (Claude Code ${claudeVersion})`,
    models: app ? { pip: app.pip.name, assessor: app.assessor.name } : null,
    options,
  }, results);
}
