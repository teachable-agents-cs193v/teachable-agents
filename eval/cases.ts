/**
 * Eval cases: types, loading and validation. The cases themselves are data in eval/sets/*.jsonl
 * (the source of truth); eval/sets/CATALOG.md is generated from them (npm run eval:catalog).
 *
 *   assessor.jsonl              set A: one student message → note-taker + assessor verdicts
 *   notes.jsonl                 set B: one student message → note-taker faithfulness
 *   conversations.jsonl         set C: multi-turn scripted students, Derivatives
 *   conversations-probability.jsonl  set C, the older probability scenarios (--topic=probability)
 *   safety.jsonl                set D: prompt injection and leak attempts, single- and multi-turn
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createNotebook } from "../src/lib/learner/teachable/notebook";
import { getTopicPack } from "../src/lib/learner/teachable/packs";
import type { BeliefStatus, Move, Notebook, TaughtCorrectly, TopicPack } from "../src/lib/learner/teachable/types";
import { MOVES } from "../src/lib/learner/teachable/types";
import type { LearningFlag } from "../src/lib/types";

export type SetId = "A" | "B" | "C" | "D";
export type Difficulty = "typical" | "hard" | "adversarial";

export interface Msg {
  role: "student" | "learner";
  text: string;
}

/** Pip's notebook before the case, relative to a fresh notebook for the topic. */
export interface NotebookSpec {
  /** Beliefs the student taught earlier. Ids follow the app's scheme: t<studentIndex>-<n>. */
  taught?: { id: string; statement: string; status: "heard" | "understood" | "corrected"; conceptId?: string | null; taughtCorrectly?: TaughtCorrectly | null }[];
  /** Starting misconceptions Pip has already said out loud. */
  voiced?: string[];
  /** Starting misconceptions the student already corrected. */
  corrected?: string[];
  /** Pip's moves so far, oldest first. Defaults to "open" plus one per earlier student message. */
  moves?: Move[];
}

interface CaseBase {
  id: string;
  topicId: string;
  /** The behavior or failure mode under test (groups the catalog and the report). */
  behavior: string;
  difficulty: Difficulty;
  /** One line: what this case tests. */
  tests: string;
  /** "human": taken from a real session in eval/human (see `fromHuman`). */
  source: "built" | "human";
}

/** For human cases: the student message is message `turn` (0 = first student message) of the session. */
export interface HumanRef {
  file: string;
  session: string;
  turn: number;
}

/** Set A: what the assessor (and the notebook update) must decide. Fields left out aren't checked. */
export interface AssessorExpect {
  /** Starting misconceptions that must flip to corrected. Every other held one must NOT flip, unless in flipEither. */
  flips?: string[];
  /** Held misconceptions where either outcome is acceptable (genuinely borderline). */
  flipEither?: string[];
  offTask?: boolean;
  /** true: at least one note graded incorrect or partly. false: none is. */
  wrongTaught?: boolean;
  /** true: at least one note graded correct. */
  correctTaught?: boolean;
  /** The note(s) graded explained (true) or not (false). */
  explained?: boolean;
  /** Exact set of revisedBeliefIds (taken back taught beliefs). */
  revised?: string[];
  /** Nothing new taught: no note survives into the notebook. */
  noNewBeliefs?: boolean;
  /** The move must be one of these. */
  moveIn?: Move[];
}

/** A person's override of the reference verdict (optional; filled in by hand later). */
export interface HumanLabel {
  offTask?: boolean;
  /** misconceptionId → should it flip on this message. */
  flips?: Record<string, boolean>;
  revised?: string[];
  wrongTaught?: boolean;
  note?: string;
}

export interface AssessorCase extends CaseBase {
  notebook?: NotebookSpec;
  conversation?: Msg[];
  student?: string;
  fromHuman?: HumanRef;
  expect: AssessorExpect;
  humanLabel?: HumanLabel;
}

/** Set B: what the note-taker must write. */
export interface NotesExpect {
  notes: { min: number; max: number };
  /** Exact set of revisedBeliefIds. Default []. */
  revised?: string[];
  /** Case-insensitive substrings no note may contain (a fix, completion or invention the student didn't say). */
  forbidden?: string[];
  /** For the judge: what a faithful set of notes must (not) say. */
  criterion: string;
}

export interface NotesCase extends CaseBase {
  notebook?: NotebookSpec;
  conversation?: Msg[];
  student?: string;
  fromHuman?: HumanRef;
  expect: NotesExpect;
}

/** Structured-state checks after one student message (1-based `turn`). */
export interface TurnExpect {
  turn: number;
  moveIn?: Move[];
  moveNotIn?: Move[];
  offTask?: boolean;
  /** The note-taker took something back this turn. */
  revised?: boolean;
  /** progress.flags must include these kinds. */
  flags?: LearningFlag["kind"][];
  /** Misconception statuses right after this turn. */
  misconceptions?: Record<string, BeliefStatus>;
}

export interface ScenarioExpect {
  /** Misconception statuses after the last message. */
  misconceptions?: Record<string, BeliefStatus>;
  noWrapUp?: boolean;
  /** No taught belief at the end (nothing was taught). */
  noTaughtBeliefs?: boolean;
  /** At most this many ask_why moves in the whole scenario. */
  maxAskWhy?: number;
  /** At least one starting misconception voiced by the end. */
  voicedAny?: boolean;
  turns?: TurnExpect[];
}

export interface ScenarioCase extends CaseBase {
  student: string[];
  expect: ScenarioExpect;
  /** For the judge: the scenario's pass criterion in plain words. */
  criterion: string;
  /** Set D: which call the attack aims at and which student turns (1-based) are attacks. */
  attack?: { target: "noteTaker" | "assessor" | "reply"; turns: number[] };
}

export type AnyCase = AssessorCase | NotesCase | ScenarioCase;

export const SET_FILES: Record<SetId, string[]> = {
  A: ["assessor.jsonl"],
  B: ["notes.jsonl"],
  C: ["conversations.jsonl", "conversations-probability.jsonl"],
  D: ["safety.jsonl"],
};

export const SETS_DIR = join(process.cwd(), "eval", "sets");

export function parseJsonl<T>(text: string, file = "jsonl"): T[] {
  return text
    .split("\n")
    .map((l, i) => [l.trim(), i + 1] as const)
    .filter(([l]) => l && !l.startsWith("//"))
    .map(([l, n]) => {
      try {
        return JSON.parse(l) as T;
      } catch {
        throw new Error(`${file}:${n}: invalid JSON`);
      }
    });
}

export function loadSet(set: SetId, dir = SETS_DIR): AnyCase[] {
  const cases = SET_FILES[set].flatMap((f) => parseJsonl<AnyCase>(readFileSync(join(dir, f), "utf8"), f));
  for (const c of cases) validateCase(set, c);
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`set ${set}: duplicate case id ${c.id}`);
    ids.add(c.id);
  }
  return cases;
}

/** Structural checks, so a typo in a case fails loudly instead of silently scoring nothing. */
export function validateCase(set: SetId, c: AnyCase): void {
  const where = `set ${set} case ${c.id ?? "?"}`;
  const pack = getTopicPack(c.topicId);
  if (!pack) throw new Error(`${where}: unknown topic ${c.topicId}`);
  if (!c.behavior || !c.tests || !["typical", "hard", "adversarial"].includes(c.difficulty)) throw new Error(`${where}: needs behavior, tests and difficulty`);
  const mIds = new Set(pack.misconceptions.map((m) => m.id));
  const checkM = (ids: string[] | undefined) => ids?.forEach((id) => { if (!mIds.has(id)) throw new Error(`${where}: unknown misconception ${id}`); });
  const checkMoves = (moves: string[] | undefined) => moves?.forEach((m) => { if (!(MOVES as readonly string[]).includes(m)) throw new Error(`${where}: unknown move ${m}`); });
  if (set === "A" || set === "B") {
    const m = c as AssessorCase | NotesCase;
    if (!m.student && !m.fromHuman) throw new Error(`${where}: needs student or fromHuman`);
    checkM(m.notebook?.voiced);
    checkM(m.notebook?.corrected);
    if (set === "A") {
      const e = (c as AssessorCase).expect;
      checkM(e.flips);
      checkM(e.flipEither);
      checkMoves(e.moveIn);
    } else if (!(c as NotesCase).expect?.criterion) throw new Error(`${where}: needs expect.criterion`);
  } else {
    const s = c as ScenarioCase;
    if (!Array.isArray(s.student) || s.student.length === 0 || !s.criterion) throw new Error(`${where}: needs student[] and criterion`);
    checkM(Object.keys(s.expect.misconceptions ?? {}));
    for (const t of s.expect.turns ?? []) {
      if (t.turn < 1 || t.turn > s.student.length) throw new Error(`${where}: turn ${t.turn} out of range`);
      checkMoves(t.moveIn);
      checkMoves(t.moveNotIn);
      checkM(Object.keys(t.misconceptions ?? {}));
    }
    if (set === "D" && !s.attack) throw new Error(`${where}: set D cases need attack`);
  }
}

export function packFor(c: { topicId: string }): TopicPack {
  const pack = getTopicPack(c.topicId);
  if (!pack) throw new Error(`unknown topic ${c.topicId}`);
  return pack;
}

/** A Notebook from a spec, as the app would have it after `studentTurns` earlier messages. */
export function buildNotebook(pack: TopicPack, spec: NotebookSpec = {}, studentTurns = 0): Notebook {
  const nb = createNotebook(pack);
  for (const b of nb.beliefs) if (b.misconceptionId && spec.corrected?.includes(b.misconceptionId)) b.status = "corrected";
  for (const t of spec.taught ?? []) {
    nb.beliefs.push({
      id: t.id,
      statement: t.statement,
      source: "taught",
      status: t.status,
      conceptId: t.conceptId ?? null,
      misconceptionId: null,
      taughtCorrectly: t.taughtCorrectly ?? null,
      evidence: [Number(/^t(\d+)-/.exec(t.id)?.[1] ?? 0)],
    });
  }
  return {
    ...nb,
    voicedMisconceptionIds: [...(spec.voiced ?? [])],
    moves: spec.moves ?? ["open", ...Array.from({ length: studentTurns }, () => "ask_why" as Move)],
    studentTurns,
    lastProcessedMessageId: studentTurns > 0 ? `s${studentTurns - 1}` : null,
  };
}

/* ------------------------------ Real sessions ----------------------------- */

interface HumanHistoryRecord {
  turn: number;
  move: Move;
  added: { beliefId: string; statement: string; status: BeliefStatus; conceptId: string | null; correctness: TaughtCorrectly | null }[];
  changed: { beliefId: string; from: BeliefStatus; to: BeliefStatus }[];
  voiced: string[];
}
interface HumanSession {
  id: string;
  topicId: string;
  messages: Msg[];
  history: HumanHistoryRecord[];
}

const humanFiles = new Map<string, HumanSession[]>();
function humanSessions(file: string): HumanSession[] {
  if (!humanFiles.has(file)) humanFiles.set(file, (JSON.parse(readFileSync(join(process.cwd(), file), "utf8")) as { sessions: HumanSession[] }).sessions);
  return humanFiles.get(file)!;
}

/**
 * A real session's notebook just before student message `turn`, rebuilt from its per-turn history
 * (added beliefs, status changes, voiced misconceptions, moves), plus the conversation before it.
 */
export function rebuildFromHistory(pack: TopicPack, session: HumanSession, turn: number): { notebook: Notebook; conversation: Msg[]; student: string } {
  let nb = createNotebook(pack);
  nb = { ...nb, moves: ["open"] };
  for (const r of session.history.filter((h) => h.turn < turn).sort((a, b) => a.turn - b.turn)) {
    for (const a of r.added) {
      nb.beliefs.push({
        id: a.beliefId,
        statement: a.statement,
        source: "taught",
        status: a.status,
        conceptId: a.conceptId,
        misconceptionId: null,
        taughtCorrectly: a.correctness,
        evidence: [r.turn],
      });
    }
    for (const c of r.changed) {
      const b = nb.beliefs.find((x) => x.id === c.beliefId);
      if (b) b.status = c.to;
    }
    nb.voicedMisconceptionIds.push(...r.voiced.filter((v) => !nb.voicedMisconceptionIds.includes(v)));
    nb.moves.push(r.move);
  }
  nb.studentTurns = turn;
  nb.lastProcessedMessageId = turn > 0 ? `s${turn - 1}` : null;
  let seen = -1;
  const conversation: Msg[] = [];
  let student = "";
  for (const m of session.messages) {
    if (m.role === "student") seen += 1;
    if (m.role === "student" && seen === turn) {
      student = m.text;
      break;
    }
    conversation.push({ role: m.role, text: m.text });
  }
  if (!student) throw new Error(`${session.id}: no student message ${turn}`);
  return { notebook: nb, conversation, student };
}

/** Everything a single-message case (A or B) needs to run: the notebook, the conversation and the message. */
export function resolveMessageCase(c: AssessorCase | NotesCase): { pack: TopicPack; notebook: Notebook; conversation: Msg[]; student: string } {
  const pack = packFor(c);
  if (c.fromHuman) {
    const session = humanSessions(c.fromHuman.file).find((s) => s.id === c.fromHuman!.session);
    if (!session) throw new Error(`${c.id}: no session ${c.fromHuman.session}`);
    return { pack, ...rebuildFromHistory(pack, session, c.fromHuman.turn) };
  }
  const conversation = c.conversation ?? [{ role: "learner", text: "Hi! I'm Pip. I'm trying to understand derivatives, but the words keep tripping me up. Where should we start?" }];
  const studentTurns = conversation.filter((m) => m.role === "student").length;
  return { pack, notebook: buildNotebook(pack, c.notebook, studentTurns), conversation, student: c.student! };
}
