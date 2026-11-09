import type { LearnerScript } from "./types";

export const economicsScript: LearnerScript = {
  topicId: "supply-and-demand",
  steps: [
    {
      id: "e0",
      kind: "opening",
      mood: "curious",
      text:
        "Hi! I'm Pip. Today I'm trying to understand supply and demand. I know it's about prices, but I don't really see how the two curves connect. Can you explain what the demand curve actually shows?",
      concept: "What the demand curve represents",
    },
    {
      id: "e1",
      kind: "misconception",
      mood: "confused",
      text:
        "Hmm, so if the price of coffee goes up, people want less of it. That means the demand curve shifts to the left, right?",
      misconception: "A price change shifts the demand curve (instead of moving along it)",
    },
    {
      id: "e2",
      kind: "question",
      mood: "curious",
      text:
        "Oh, so a price change moves me along the curve, but the curve itself stays put? Then what would actually shift the whole curve?",
      concept: "Shifters of demand vs. quantity demanded",
    },
    {
      id: "e3",
      kind: "misconception",
      mood: "confused",
      text:
        "Okay. And supply is basically the opposite of demand, so it's just the same curve flipped around?",
      misconception: "Supply is a mirror image of demand rather than sellers' own behavior",
    },
    {
      id: "e4",
      kind: "question",
      mood: "thinking",
      text:
        "So where the two cross is the equilibrium. But what happens if the price is set above that point? Does the market just stay there?",
      concept: "Surplus and the adjustment toward equilibrium",
    },
    {
      id: "e5",
      kind: "realization",
      mood: "happy",
      text:
        "Oh, that would create a surplus, and sellers would lower prices until it clears. Let me say it back: price changes move along a curve, other factors shift a curve, and equilibrium is where quantity supplied equals quantity demanded. Is that right?",
      concept: "Equilibrium as the balance of quantity supplied and demanded",
    },
  ],
  exhaustedReply:
    "That's everything I was confused about for now. Thank you for walking me through it! You can end the session whenever you're ready.",
};
