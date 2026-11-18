/**
 * Runs the systems under test: the app's real pipeline (src/lib/learner/teachable/pipeline.ts)
 * with the app's real models. Nothing here re-implements a model call: single-message cases run
 * the pipeline's own assessTurn, scenarios run runOpening/runTurn, and the raw outputs are read
 * back from the call records and re-parsed with the pipeline's own parsers.
 */

import { parseAssessorVerdict } from "../src/lib/learner/teachable/assessorBoundary";
import type { JsonModel } from "../src/lib/learner/teachable/llm";
import { pipView, studentView, type PipBelief } from "../src/lib/learner/teachable/notebook";
import { assessTurn, initialState, parseNotes, runOpening, runTurn, type TeachableState } from "../src/lib/learner/teachable/pipeline";
import { buildProgress } from "../src/lib/learner/teachable/progress";
import type { Assessment, AssessorVerdict, Notebook, TakenNotes, TopicPack } from "../src/lib/learner/teachable/types";
import type { ChatMessage, LearnerReply, LearningProgress, StudentBelief } from "../src/lib/types";
import type { Msg } from "./cases";
import type { CallRecord } from "./pacedModel";

export interface SutModels {
  pip: JsonModel;
  assessor: JsonModel;
  /** Calls made since the last drain (from PacedModel). */
  drain: () => CallRecord[];
}

/** A call record without its raw output (kept small for the cache and report). */
const withoutRaw = (calls: CallRecord[]): Omit<CallRecord, "raw">[] => calls.map((c) => ({ seq: c.seq, label: c.label, model: c.model, promptTokens: c.promptTokens, cachedTokens: c.cachedTokens, completionTokens: c.completionTokens, ms: c.ms }));

const toChat = (messages: Msg[]): ChatMessage[] =>
  messages.map((m, i) => ({ id: m.role === "student" ? `s${messages.slice(0, i).filter((x) => x.role === "student").length}` : `l${i}`, role: m.role, text: m.text, createdAt: "" }));

/** The output of one note-taker (+ assessor) run on one message. */
export interface MessageRun {
  notes: TakenNotes;
  /** Undefined when only the note-taker ran (set B). */
  verdict?: AssessorVerdict;
  assessment?: Assessment;
  before: Notebook;
  after?: Notebook;
  calls: Omit<CallRecord, "raw">[];
}

/** An assessor that returns an empty verdict, for set B (note-taker only: no assessor quota spent). */
const silentAssessor: JsonModel = { name: "none", completeJson: async () => ({}) };

export async function runMessage(args: {
  pack: TopicPack;
  notebook: Notebook;
  conversation: Msg[];
  student: string;
  models: SutModels;
  noteTakerOnly?: boolean;
}): Promise<MessageRun> {
  const { pack, notebook, conversation, student, models, noteTakerOnly } = args;
  const state: TeachableState = { ...initialState(pack), notebook };
  const messages = toChat([...conversation, { role: "student", text: student }]);
  models.drain();
  const assessed = await assessTurn({ pack, state, messages, models: { pip: models.pip, assessor: noteTakerOnly ? silentAssessor : models.assessor } });
  const calls = models.drain();
  // The pipeline retries a call once on a bad shape: the last call of each label is the one it used.
  const last = (label: string) => calls.filter((c) => c.label === label).at(-1);
  const notes = parseNotes(last("noteTaker")?.raw, notebook);
  const run: MessageRun = { notes, before: notebook, calls: withoutRaw(calls) };
  if (!noteTakerOnly) {
    run.verdict = parseAssessorVerdict(last("assessor")?.raw, { pack, notebook, noteCount: notes.notes.length });
    run.assessment = assessed.state.lastAssessment ?? undefined;
    run.after = assessed.state.notebook;
  }
  return run;
}

/** One student turn of a scenario, with everything the student could see after it. */
export interface ScenarioTurn {
  student: string;
  reply: LearnerReply;
  assessment: Assessment;
  /** What Pip believed when it wrote the reply (statements and how sure). */
  pipBefore: PipBelief[];
  /** Beliefs added this turn (the note-taker's notes that survived), Pip-visible text. */
  newBeliefs: string[];
  /** Student-visible: the beliefs panel and the progress object returned with the turn. */
  pip: StudentBelief[];
  progress: LearningProgress;
  /** Misconception id → status after this turn. */
  misconceptions: Record<string, string>;
  voiced: string[];
  calls: Omit<CallRecord, "raw">[];
}

export interface ScenarioRun {
  opening: LearnerReply;
  openingCalls: Omit<CallRecord, "raw">[];
  turns: ScenarioTurn[];
  final: { notebook: Notebook };
}

const misconceptionStatuses = (nb: Notebook) => Object.fromEntries(nb.beliefs.filter((b) => b.misconceptionId).map((b) => [b.misconceptionId!, b.status]));

export async function runScenario(args: { pack: TopicPack; student: string[]; models: SutModels }): Promise<ScenarioRun> {
  const { pack, student, models } = args;
  const pipelineModels = { pip: models.pip, assessor: models.assessor };
  models.drain();
  let state = initialState(pack);
  const opened = await runOpening({ pack, state, models: pipelineModels });
  const openingCalls = withoutRaw(models.drain());
  state = opened.state;
  const messages: ChatMessage[] = [{ id: "l0", role: "learner", text: opened.reply.text, createdAt: "" }];
  const turns: ScenarioTurn[] = [];
  for (const [i, text] of student.entries()) {
    const before = state.notebook;
    messages.push({ id: `s${i}`, role: "student", text, createdAt: "" });
    const result = await runTurn({ pack, state, messages, models: pipelineModels });
    state = result.state;
    messages.push({ id: `l${i + 1}`, role: "learner", text: result.reply.text, createdAt: "" });
    const beforeIds = new Set(before.beliefs.map((b) => b.id));
    turns.push({
      student: text,
      reply: result.reply,
      assessment: state.lastAssessment!,
      pipBefore: pipView(before),
      newBeliefs: state.notebook.beliefs.filter((b) => !beforeIds.has(b.id)).map((b) => b.statement),
      pip: studentView(state.notebook, before),
      progress: buildProgress(state),
      misconceptions: misconceptionStatuses(state.notebook),
      voiced: [...state.notebook.voicedMisconceptionIds],
      calls: withoutRaw(models.drain()),
    });
  }
  return { opening: opened.reply, openingCalls, turns, final: { notebook: state.notebook } };
}
