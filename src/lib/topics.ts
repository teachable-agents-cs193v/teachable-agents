import type { Topic } from "./types";

/** Mock topic catalogue. Replace with a backend query when one exists. */
export const TOPICS: Topic[] = [
  {
    id: "independence-vs-mutual-exclusivity",
    subjectId: "probability",
    title: "Independence vs. Mutual Exclusivity",
    description:
      "Two ideas that sound alike and get mixed up constantly. Help Pip see why they are almost opposites.",
    learningObjective:
      "Explain the difference between independent and mutually exclusive events, and show how to test for each with probabilities.",
    learnerIntro:
      "I've been reading about probability and I keep tangling up \"independent\" and \"mutually exclusive.\" They sound like the same thing to me. I'd love it if you could straighten me out, and I'll probably ask for examples.",
    teachingTips: [
      "Lead with a concrete example (coins, dice, cards) before stating any definition.",
      "When Pip says something wrong, name the exact confusion instead of just saying \"not quite.\"",
      "Try showing the multiplication rule with real numbers so Pip can check it.",
    ],
    preSessionPrompt:
      "In two or three sentences, explain the difference between independent events and mutually exclusive events as you understand it right now.",
    postSessionPrompt:
      "Without notes, explain how you would check whether two events are independent, and why mutually exclusive events are not independent.",
    featured: true,
  },
  {
    id: "supply-and-demand",
    subjectId: "economics",
    title: "Supply and Demand",
    description:
      "Curves, shifts, and equilibrium. Pip knows prices matter but not how the pieces fit together.",
    learningObjective:
      "Distinguish movement along a curve from a shift of the curve, and explain how equilibrium price is reached.",
    learnerIntro:
      "I understand that prices go up and down, but every time I see a supply and demand graph I'm not sure what each line really means or why they cross where they do.",
    teachingTips: [
      "Pick one product (coffee works well) and stick with it for every example.",
      "Be precise about the difference between \"demand\" and \"quantity demanded.\"",
      "Ask Pip to predict what happens before you reveal it.",
    ],
    preSessionPrompt:
      "In two or three sentences, explain what makes a demand curve shift versus what moves you along it.",
    postSessionPrompt:
      "Without notes, explain why a price set above equilibrium does not stay there.",
  },
  {
    id: "photosynthesis",
    subjectId: "biology",
    title: "Photosynthesis",
    description:
      "Inputs, outputs, and the two stages. Pip has the famous equation memorized but not understood.",
    learningObjective:
      "Explain what photosynthesis takes in and produces, and why it happens in two linked stages.",
    learnerIntro:
      "I can recite \"carbon dioxide plus water makes sugar and oxygen,\" but I honestly don't know where the plant's mass comes from or what the light is actually doing.",
    teachingTips: [
      "Start with where the atoms come from. The answer surprises most people.",
      "Separate what the light reactions make from what the Calvin cycle makes.",
      "Use an analogy for energy storage (charging a battery, saving up coins) but say where it breaks down.",
    ],
    preSessionPrompt:
      "In two or three sentences, explain where most of a plant's mass comes from and what role sunlight plays.",
    postSessionPrompt:
      "Without notes, explain what the light reactions produce and how the Calvin cycle uses it.",
  },
  {
    id: "recursion",
    subjectId: "computer-science",
    title: "Recursion",
    description:
      "A function that calls itself feels like magic to Pip. Make the call stack visible.",
    learningObjective:
      "Explain base cases, recursive cases, and how the call stack holds each call until it returns.",
    learnerIntro:
      "A function calling itself sounds like it should loop forever. I know it works, but I don't understand how the computer keeps track of everything.",
    teachingTips: [
      "Trace one small example (factorial of 3) all the way down and back up.",
      "Draw or describe the stack of frames explicitly.",
      "Resist jumping to efficiency talk until the mechanics are solid.",
    ],
    preSessionPrompt:
      "In two or three sentences, explain what a base case is and why a recursive function needs one.",
    postSessionPrompt:
      "Without notes, trace what happens when factorial(3) runs, including the order in which calls return.",
  },
  {
    id: "classical-vs-operant-conditioning",
    subjectId: "psychology",
    title: "Classical vs. Operant Conditioning",
    description:
      "Pavlov, Skinner, and a lot of mixed-up vocabulary. Help Pip sort reflexes from consequences.",
    learningObjective:
      "Distinguish classical from operant conditioning and correctly classify reinforcement and punishment.",
    learnerIntro:
      "Both kinds of conditioning seem to be about learning from pairs of things, so I keep mixing them up. And \"negative reinforcement\" sounds like a punishment to me.",
    teachingTips: [
      "Ask whether the behavior is automatic or voluntary. That one question sorts most examples.",
      "For reinforcement vs. punishment, focus on whether the behavior goes up or down.",
      "Use everyday examples (alarms, seatbelt chimes, allowances) rather than lab ones.",
    ],
    preSessionPrompt:
      "In two or three sentences, explain the difference between classical and operant conditioning as you understand it now.",
    postSessionPrompt:
      "Without notes, explain the difference between negative reinforcement and punishment with one example of each.",
  },
];

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}
