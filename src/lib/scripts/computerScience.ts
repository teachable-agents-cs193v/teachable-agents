import type { LearnerScript } from "./types";

export const computerScienceScript: LearnerScript = {
  topicId: "recursion",
  steps: [
    {
      id: "c0",
      kind: "opening",
      mood: "curious",
      text:
        "Hi! I'm Pip. I'm learning recursion and honestly it feels like magic. A function calling itself? How does that not go on forever?",
      concept: "Base cases stop recursion",
    },
    {
      id: "c1",
      kind: "misconception",
      mood: "confused",
      text:
        "Okay, so there's a base case. But when the function calls itself, doesn't the new call just overwrite the first one? How does the first call remember where it was?",
      misconception: "A recursive call replaces the current call instead of stacking a new frame",
    },
    {
      id: "c2",
      kind: "question",
      mood: "curious",
      text:
        "Oh, each call gets its own frame on the stack. So for factorial(3), how many frames are on the stack at the deepest point?",
      concept: "Each call has its own stack frame",
    },
    {
      id: "c3",
      kind: "misconception",
      mood: "confused",
      text:
        "Got it. One more thing I read: recursion is always slower and worse than a loop, so I should basically never use it, right?",
      misconception: "Recursion is always inferior to iteration",
    },
    {
      id: "c4",
      kind: "question",
      mood: "thinking",
      text:
        "Can you walk me through factorial(3) step by step, including what happens when each call returns?",
      concept: "Tracing a recursive call and its returns",
    },
    {
      id: "c5",
      kind: "realization",
      mood: "happy",
      text:
        "So the calls go down to the base case, then the results come back up and multiply. Let me say it back: a recursive function needs a base case, a recursive case that moves toward it, and each call waits on its own frame. Did I miss anything?",
      concept: "The three ingredients of a recursive function",
    },
  ],
  exhaustedReply:
    "That's all my questions about recursion for now. Thanks for being patient with me! You can end the session whenever you're ready.",
};
