import type { LearnerScript } from "./types";

/** Scripted fallback for "Derivatives", used when no model is configured. */
export const calculusScript: LearnerScript = {
  topicId: "derivatives",
  steps: [
    {
      id: "c0",
      kind: "opening",
      mood: "curious",
      text: "Hi! I'm Pip. Derivatives are brand new to me. Can you start with what a derivative actually is?",
      concept: "What a derivative means",
    },
    {
      id: "c1",
      kind: "question",
      mood: "curious",
      text: "Okay, so it's about how fast something changes. How do I actually find one, say for x cubed?",
      concept: "Power rule",
    },
    {
      id: "c2",
      kind: "misconception",
      mood: "confused",
      text: "So for x times sin x, I'd just multiply the derivatives: 1 times cos x, so cos x. Right?",
      misconception: "The derivative of a product is the product of the derivatives",
    },
    {
      id: "c3",
      kind: "misconception",
      mood: "thinking",
      text: "And for sin(3x), I take the derivative of the outside and keep the inside, so cos(3x)?",
      misconception: "The chain rule without the inner derivative",
    },
    {
      id: "c4",
      kind: "realization",
      mood: "happy",
      text: "Oh, so I multiply by the derivative of the inside too: 3 cos(3x). Let me say back everything you taught me so I'm sure I've got it.",
      concept: "Chain rule",
    },
    {
      id: "c5",
      kind: "closing",
      mood: "happy",
      text: "Thank you! I think I understand the rules much better now. I'm ready to wrap up whenever you are.",
      concept: "Product rule",
    },
  ],
  exhaustedReply:
    "I've asked everything on my list for derivatives. Thank you for teaching me! You can end the session whenever you're ready.",
};
