/**
 * Optional cross-check of derivatives Pip wrote, with sympy (eval/sympy_check.py). Uses
 * eval/.venv/bin/python when it exists (see eval/README.md), else EVAL_PYTHON or python3.
 * When sympy isn't importable the check is skipped and the report says so.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface DerivativeItem {
  function: string;
  pipAnswer: string;
  asTaught: string | null;
}
export interface SympyResult {
  ok: boolean;
  pipIsTrue: boolean | null;
  pipMatchesTaught: boolean | null;
  truth: string | null;
  error: string | null;
}

export function sympyPython(): string | null {
  const venv = join(process.cwd(), "eval", ".venv", "bin", "python");
  const python = process.env.EVAL_PYTHON || (existsSync(venv) ? venv : "python3");
  const probe = spawnSync(python, ["-I", "-c", "import sympy"], { encoding: "utf8" });
  return probe.status === 0 ? python : null;
}

export function checkDerivatives(python: string, items: DerivativeItem[]): SympyResult[] {
  if (items.length === 0) return [];
  const out = spawnSync(python, ["-I", join(process.cwd(), "eval", "sympy_check.py")], { input: JSON.stringify(items), encoding: "utf8", timeout: 120_000 });
  if (out.status !== 0) return items.map(() => ({ ok: false, pipIsTrue: null, pipMatchesTaught: null, truth: null, error: `sympy failed: ${out.stderr.slice(0, 200)}` }));
  return JSON.parse(out.stdout) as SympyResult[];
}
