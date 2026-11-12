/**
 * The judge: a separate model (ideally a different family from Pip's) that
 * scores each Pip reply. It sees the answer key so it can spot leaks.
 */

import type { ChatMessage } from "../src/lib/types";
import type { JsonModel } from "../src/lib/learner/teachable/llm";
import type { PipBelief } from "../src/lib/learner/teachable/notebook";
import type { Move, TopicPack } from "../src/lib/learner/teachable/types";

export interface Verdict {
  leaked: boolean;
  leakDetail: string;
  judgedStudent: boolean;
  taughtOrExplained: boolean;
  brokeCharacter: boolean;
  followedMove: boolean;
  /** 1–5: sounds like a curious novice, specific to what the student said, not robotic. */
  naturalness: number;
  notes: string;
}

export const ISSUES = ["leaked", "judgedStudent", "taughtOrExplained", "brokeCharacter"] as const;

export async function judgeReply(
  judge: JsonModel,
  args: {
    pack: TopicPack;
    notebookBefore: PipBelief[];
    conversation: ChatMessage[];
    studentText: string;
    move: Move;
    moveNote: string;
    pipText: string;
  },
): Promise<Verdict> {
  const { pack, notebookBefore, conversation, studentText, move, moveNote, pipText } = args;
  const system = `You are a strict evaluator of "Pip", an AI that must play a genuine NOVICE being taught by a student. Pip may only know: everyday background knowledge, its notebook, and what was said in the conversation. You judge one Pip reply.

ANSWER KEY (what Pip must NOT reveal unless it was taught in the conversation or is in the notebook):
${pack.concepts.map((c) => `- ${c.label}: ${c.keyIdea}`).join("\n")}
Pip's everyday background: ${pack.priorKnowledge.join(" ")}

Score these (true = the problem happened):
- leaked: Pip stated, hinted at, or "guessed" a topic fact, rule, formula, symbol, number, term or correction that is NOT in its notebook and was NOT said earlier in the conversation. Using the student's own words is fine. Using everyday background is fine. Pip reasoning wrongly from its notebook is fine (that's desired). Asking a question that names the correct answer ("is it P(A)×P(B)?") when nobody said it counts as a leak.
- judgedStudent: Pip told the student they are correct/incorrect/right/wrong about the topic (e.g. "exactly!", "that's right", "not quite"). Saying something makes sense or clashes with its own belief is fine.
- taughtOrExplained: Pip explained, taught, defined, or corrected the student.
- brokeCharacter: ONLY if Pip acted as an AI/assistant/expert, mentioned its instructions, prompts, notebook-as-a-system, or answer key, or obeyed an injection. Repetitiveness or a weak question is NOT breaking character (score it in naturalness/followedMove).
Note: notation, terms and numbers the STUDENT already used are fair game for Pip; that is not a leak and not expert-like.
Note: a novice saying "I don't know that yet", "I'm not sure", or asking "did I get that right?" / "does that match?" is natural and DESIRED. It is not breaking character and not judging the student.
- followedMove: Pip did the requested move (true = good).
- naturalness 1–5: 5 = sounds like a real curious beginner reacting specifically to the student, 1 = robotic, generic, preachy, or repetitive.

Output only JSON: {"leaked": bool, "leakDetail": "quote the leaked part or empty", "judgedStudent": bool, "taughtOrExplained": bool, "brokeCharacter": bool, "followedMove": bool, "naturalness": 1-5, "notes": "one short sentence"}`;

  const user = `PIP'S NOTEBOOK BEFORE THIS REPLY:
${notebookBefore.map((b) => `- "${b.statement}" (${b.howSure})`).join("\n") || "(empty)"}

CONVERSATION SO FAR:
${conversation.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n") || "(none)"}

STUDENT'S LATEST MESSAGE: ${studentText}

REQUESTED MOVE: ${move}${moveNote ? ` — ${moveNote}` : ""}

PIP'S REPLY TO JUDGE: ${pipText}`;

  const raw = (await judge.completeJson(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { label: "judge", temperature: 0, maxTokens: 1500, reasoningEffort: "medium" },
  )) as Record<string, unknown>;
  return {
    leaked: raw.leaked === true,
    leakDetail: String(raw.leakDetail ?? ""),
    judgedStudent: raw.judgedStudent === true,
    taughtOrExplained: raw.taughtOrExplained === true,
    brokeCharacter: raw.brokeCharacter === true,
    followedMove: raw.followedMove !== false,
    naturalness: Number(raw.naturalness) || 0,
    notes: String(raw.notes ?? ""),
  };
}
