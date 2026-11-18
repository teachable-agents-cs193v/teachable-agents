/**
 * A fake OpenAI-compatible model for browser tests of the AI learner's panels
 * (playwright.learning.config.ts). No network, no quota. It answers by the
 * request's `model` field, which the app sets per role: `fake-assessor` gets the
 * next verdict from a fixed script, `fake-pip` gets a fixed reply. It never
 * reads the messages.
 *
 * `fake-pip` answers two calls: the note-taker (before each assessor call) and
 * Pip's reply. It can't tell them apart without reading the prompt, so it sends
 * one object that suits both: `notes`/`revisedBeliefIds` for the note-taker's
 * parser and `mood`/`text` for the reply's, each ignoring the other's keys. The
 * notes are those of the next student message, i.e. the next assessor verdict.
 */
import http from "node:http";

export const FAKE_ASSESSOR = "fake-assessor";
export const FAKE_PIP = "fake-pip";

/** One student message: the notes the note-taker writes, and the assessor's verdict on them. */
interface Step {
  notes: string[];
  verdict: Record<string, unknown>;
}

const verdict = (over: Record<string, unknown>) => ({
  noteGrades: [],
  corrections: [],
  nowExplainedBeliefIds: [],
  offTask: false,
  move: "ask_why",
  moveTarget: null,
  readyToWrapUp: false,
  ...over,
});

/** One step per student message, in order; after that, nothing changes. */
const SCRIPT: Step[] = [
  {
    notes: ["Independent means one event doesn't change the other's chance."],
    verdict: verdict({
      noteGrades: [{ index: 0, conceptId: "independence-definition", correctness: "correct", explained: false, faithful: true }],
      move: "voice_misconception",
      moveTarget: "independent-means-cannot-co-occur",
    }),
  },
  {
    notes: ["Heads and a six can happen together."],
    verdict: verdict({
      noteGrades: [{ index: 0, conceptId: "independent-can-co-occur", correctness: "correct", explained: true, faithful: true }],
      corrections: [{ misconceptionId: "independent-means-cannot-co-occur", targeted: true, explained: true }],
      move: "try_to_apply",
    }),
  },
];

export function startFakeLlm(port: number): http.Server {
  let assessorCalls = 0;
  let replies = 0;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const model = (JSON.parse(raw || "{}") as { model?: string }).model;
      const content =
        model === FAKE_ASSESSOR
          ? (SCRIPT[assessorCalls++]?.verdict ?? verdict({}))
          : {
              notes: (SCRIPT[assessorCalls]?.notes ?? []).map((text) => ({ text })),
              revisedBeliefIds: [],
              mood: "curious",
              text: `Fake Pip reply ${++replies}. Can you tell me why?`,
            };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}
