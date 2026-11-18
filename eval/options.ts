/** Eval options, from EVAL_* env vars (eval/run.mjs turns `npm run eval -- --set=A` flags into these). */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AnyCase, SetId } from "./cases";

export interface EvalOptions {
  sets: SetId[];
  runs: number;
  judgeRepeat: number;
  only: string[] | null;
  topic: "derivatives" | "probability" | "all";
  source: "built" | "human" | "all";
  limit: number | null;
  resume: string | null;
  tpm: number;
  noJudge: boolean;
  judgeConcurrency: number;
  resultsDir: string;
}

const int = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);

export function optionsFromEnv(env: Record<string, string | undefined> = process.env): EvalOptions {
  const sets = (env.EVAL_SETS || "A,B,C,D")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const s of sets) if (!["A", "B", "C", "D"].includes(s)) throw new Error(`EVAL_SETS: unknown set ${s} (use A, B, C, D)`);
  const topic = (env.EVAL_TOPIC || "derivatives") as EvalOptions["topic"];
  if (!["derivatives", "probability", "all"].includes(topic)) throw new Error("EVAL_TOPIC must be derivatives, probability or all");
  const source = (env.EVAL_SOURCE || "all") as EvalOptions["source"];
  if (!["built", "human", "all"].includes(source)) throw new Error("EVAL_SOURCE must be built, human or all");
  return {
    sets: sets as SetId[],
    runs: int(env.EVAL_RUNS, 1),
    judgeRepeat: int(env.EVAL_JUDGE_REPEAT, 1),
    only: env.EVAL_ONLY ? env.EVAL_ONLY.split(",").map((s) => s.trim()).filter(Boolean) : null,
    topic,
    source,
    limit: env.EVAL_LIMIT ? int(env.EVAL_LIMIT, 0) || null : null,
    resume: env.EVAL_RESUME?.trim() || null,
    tpm: int(env.EVAL_TPM, 7000),
    noJudge: env.EVAL_NO_JUDGE === "1",
    judgeConcurrency: int(env.EVAL_JUDGE_CONCURRENCY, 3),
    resultsDir: env.EVAL_RESULTS_DIR || join(process.cwd(), "eval", "results"),
  };
}

export function selectCases(cases: AnyCase[], o: EvalOptions): AnyCase[] {
  let out = cases.filter((c) => (o.topic === "all" ? true : o.topic === "derivatives" ? c.topicId === "derivatives" : c.topicId !== "derivatives"));
  if (o.source !== "all") out = out.filter((c) => c.source === o.source);
  if (o.only) out = out.filter((c) => o.only!.includes(c.id));
  if (o.limit) out = out.slice(0, o.limit);
  return out;
}

/** eval/results/<timestamp>, or the run to resume ("latest" = the newest). */
export function runDir(o: EvalOptions, now = new Date()): { dir: string; id: string } {
  if (o.resume) {
    let id = o.resume;
    if (id === "latest") {
      const dirs = existsSync(o.resultsDir) ? readdirSync(o.resultsDir).filter((d) => /^\d{4}-\d\d-\d\dT/.test(d)).sort() : [];
      if (!dirs.length) throw new Error("--resume=latest: no earlier run in eval/results");
      id = dirs.at(-1)!;
    }
    return { dir: join(o.resultsDir, id), id };
  }
  const id = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { dir: join(o.resultsDir, id), id };
}
