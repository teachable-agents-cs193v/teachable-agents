#!/usr/bin/env node
/**
 * `npm run eval -- [flags]`: turns flags into EVAL_* env vars and runs eval/suite.eval.ts with
 * vitest. Loads .env.local (the app's LLM_* settings) without printing it.
 *
 *   --set=A,B,C,D        sets to run (default all)
 *   --runs=N             repeat the system under test N times (mean ± sd across runs)
 *   --judge-repeat=2     judge every output twice and report judge consistency
 *   --only=id1,id2       only these case ids
 *   --topic=derivatives|probability|all   (default derivatives)
 *   --source=built|human|all              (default all)
 *   --limit=N            first N cases of each set
 *   --resume[=ID|latest] continue a run in eval/results/ID, reusing its cached outputs
 *   --tpm=7000           token-per-minute budget per Groq model
 *   --no-judge           run the system under test only (no Claude calls; exact checks only)
 *   --judge-concurrency=3
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const FLAGS = {
  set: "EVAL_SETS",
  runs: "EVAL_RUNS",
  "judge-repeat": "EVAL_JUDGE_REPEAT",
  only: "EVAL_ONLY",
  topic: "EVAL_TOPIC",
  source: "EVAL_SOURCE",
  limit: "EVAL_LIMIT",
  resume: "EVAL_RESUME",
  tpm: "EVAL_TPM",
  "no-judge": "EVAL_NO_JUDGE",
  "judge-concurrency": "EVAL_JUDGE_CONCURRENCY",
};

const env = { ...process.env };
for (const arg of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
  if (!m || !(m[1] in FLAGS)) {
    console.error(`Unknown flag ${arg}. Flags: ${Object.keys(FLAGS).map((f) => `--${f}`).join(" ")}`);
    process.exit(2);
  }
  const value = m[2] ?? (m[1] === "resume" ? "latest" : m[1] === "no-judge" ? "1" : "");
  env[FLAGS[m[1]]] = value;
}

if (existsSync(".env.local")) {
  const before = { ...process.env };
  process.loadEnvFile(".env.local");
  for (const [k, v] of Object.entries(process.env)) if (!(k in before) && k.startsWith("LLM_")) env[k] = v;
}

const result = spawnSync("node_modules/.bin/vitest", ["run", "--config", "vitest.eval.config.mts"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
