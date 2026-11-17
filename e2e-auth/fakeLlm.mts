/**
 * A fake OpenAI-compatible model for browser tests of the AI learner's panels
 * (playwright.learning.config.ts). No network, no quota. It answers by the
 * request's `model` field, which the app sets per role: `fake-assessor` gets the
 * next verdict from a fixed script, `fake-pip` gets a fixed reply. It never
 * reads the messages.
 */
import http from "node:http";

export const FAKE_ASSESSOR = "fake-assessor";
export const FAKE_PIP = "fake-pip";

const verdict = (over: Record<string, unknown>) => ({
  analysis: "",
  claims: [],
  corrections: [],
  nowExplainedBeliefIds: [],
  offTask: false,
  move: "ask_why",
  moveTarget: null,
  moveNote: "Ask why.",
  readyToWrapUp: false,
  ...over,
});

/** One verdict per student message, in order; after that, nothing changes. */
const SCRIPT = [
  verdict({
    claims: [{ pipStatement: "Independent means one event doesn't change the other's chance.", conceptId: "independence-definition", correctness: "correct", explained: false }],
    move: "voice_misconception",
    moveTarget: "independent-means-cannot-co-occur",
  }),
  verdict({
    claims: [{ pipStatement: "Heads and a six can happen together.", conceptId: "independent-can-co-occur", correctness: "correct", explained: true }],
    corrections: [{ misconceptionId: "independent-means-cannot-co-occur", targeted: true, explained: true }],
    move: "try_to_apply",
  }),
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
          ? (SCRIPT[assessorCalls++] ?? verdict({}))
          : { mood: "curious", text: `Fake Pip reply ${++replies}. Can you tell me why?` };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}
