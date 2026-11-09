import type { LearnerScript } from "./types";

/** Primary demo scenario. The most complete scripted interaction. */
export const probabilityScript: LearnerScript = {
  topicId: "independence-vs-mutual-exclusivity",
  steps: [
    {
      id: "p0",
      kind: "opening",
      mood: "curious",
      text:
        "Hi! I'm Pip. Thanks for teaching me today. I've been reading about probability and two words keep tripping me up: independent and mutually exclusive. Can you start by explaining what it means for two events to be independent?",
      concept: "Definition of independent events",
    },
    {
      id: "p1",
      kind: "misconception",
      mood: "confused",
      text:
        "Wait, I'm a little confused. If two events are independent, doesn't that mean they can't happen at the same time?",
      misconception: "Independent events cannot happen at the same time",
    },
    {
      id: "p2",
      kind: "question",
      mood: "curious",
      text: "Oh! So they can happen together? Can you give me an example?",
      concept: "Independent events can occur together",
    },
    {
      id: "p3",
      kind: "question",
      mood: "curious",
      text:
        "That helps! But why does knowing the coin landed on heads not change the chance of rolling a six?",
      concept: "Conditional probability: P(B | A) = P(B) for independent events",
    },
    {
      id: "p4",
      kind: "misconception",
      mood: "confused",
      text:
        "Okay, let me try one myself. Drawing a red card and drawing a king from the same deck. Those feel connected because they come from the same deck, so they must be dependent, right?",
      misconception: "Events drawn from the same source must be dependent",
    },
    {
      id: "p5",
      kind: "question",
      mood: "thinking",
      text:
        "Huh. So I should check with numbers instead of going by feel. What's the actual rule I should test? Is it something with multiplication?",
      concept: "Multiplication rule: P(A and B) = P(A) × P(B)",
    },
    {
      id: "p6",
      kind: "misconception",
      mood: "confused",
      text:
        "Got it. So then for mutually exclusive events... rolling a 2 and rolling a 5 on one die can't both happen, so they don't affect each other. That makes them independent too, right?",
      misconception: "Mutually exclusive events are independent",
    },
    {
      id: "p7",
      kind: "realization",
      mood: "happy",
      text:
        "Ohhh. If one happens, the other definitely can't, so knowing one changes the other's probability to zero. That's the opposite of independent! Let me say it back: mutually exclusive means they can't both happen, and independent means one doesn't change the odds of the other. Did I get that right, or is there a case I'm missing?",
      concept: "Contrast: mutually exclusive vs. independent",
    },
    {
      id: "p8",
      kind: "closing",
      mood: "happy",
      text:
        "I think this finally makes sense. Thank you! One last thing so it sticks: when you see a new problem, what's the first question you ask yourself to tell these two apart? After that I think I'm ready to wrap up whenever you are.",
      concept: "A quick test for telling the two apart",
    },
  ],
  exhaustedReply:
    "I've asked everything on my list for this topic, and I think I understand it much better now. Thank you for teaching me! Whenever you're ready, you can end the session and reflect on how it went.",
};
