import type { LearnerScript } from "./types";

export const biologyScript: LearnerScript = {
  topicId: "photosynthesis",
  steps: [
    {
      id: "b0",
      kind: "opening",
      mood: "curious",
      text:
        "Hi, I'm Pip! I'm studying photosynthesis. I know plants use sunlight to make food, but I'm fuzzy on what actually goes in and what comes out. Can you walk me through the big picture first?",
      concept: "Inputs and outputs of photosynthesis",
    },
    {
      id: "b1",
      kind: "misconception",
      mood: "confused",
      text:
        "So plants get their food from the soil, and the sunlight just helps them use it, right?",
      misconception: "Plants get their food and mass from the soil",
    },
    {
      id: "b2",
      kind: "question",
      mood: "curious",
      text:
        "Wait, most of a plant's mass comes from the air? That's wild. Then what exactly does the light do?",
      concept: "Carbon comes from CO2; light supplies energy",
    },
    {
      id: "b3",
      kind: "misconception",
      mood: "confused",
      text:
        "Okay, so the oxygen plants release, that comes from splitting the carbon dioxide?",
      misconception: "Released oxygen comes from carbon dioxide rather than water",
    },
    {
      id: "b4",
      kind: "question",
      mood: "thinking",
      text:
        "Got it, splitting water makes the oxygen. I read that there are light reactions and a Calvin cycle. Why are there two stages at all? Why not one?",
      concept: "Why photosynthesis has two linked stages",
    },
    {
      id: "b5",
      kind: "realization",
      mood: "happy",
      text:
        "I think I get it: the light reactions capture energy as ATP and NADPH, and the Calvin cycle spends that energy to build sugar from carbon dioxide. Can you check me on one thing: is the sugar actually built during the light reactions or during the Calvin cycle?",
      concept: "Light reactions make ATP/NADPH; the Calvin cycle builds sugar",
    },
  ],
  exhaustedReply:
    "That answers all of my questions for today. Thanks for teaching me! You can end the session whenever you're ready.",
};
