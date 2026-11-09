import type { LearnerScript } from "./types";

export const psychologyScript: LearnerScript = {
  topicId: "classical-vs-operant-conditioning",
  steps: [
    {
      id: "s0",
      kind: "opening",
      mood: "curious",
      text:
        "Hi, I'm Pip! I'm studying conditioning. Classical and operant both seem to be about learning from pairs of things, so I keep mixing them up. What's the core difference?",
      concept: "Core distinction between classical and operant conditioning",
    },
    {
      id: "s1",
      kind: "misconception",
      mood: "confused",
      text:
        "So Pavlov's dog salivating at the bell... that's operant conditioning, because the dog learned to do something, right?",
      misconception: "Pavlov's dog is an example of operant conditioning",
    },
    {
      id: "s2",
      kind: "question",
      mood: "curious",
      text:
        "Oh, salivating is automatic, so that's classical. Then operant is about voluntary behavior and consequences? What counts as a consequence?",
      concept: "Operant conditioning: voluntary behavior shaped by consequences",
    },
    {
      id: "s3",
      kind: "misconception",
      mood: "confused",
      text:
        "Okay, so negative reinforcement is when you punish someone to make a behavior stop.",
      misconception: "Negative reinforcement is the same as punishment",
    },
    {
      id: "s4",
      kind: "question",
      mood: "thinking",
      text:
        "Wait, negative reinforcement increases a behavior by taking something unpleasant away? Can you give me an everyday example so I can tell it apart from punishment?",
      concept: "Reinforcement increases behavior; punishment decreases it",
    },
    {
      id: "s5",
      kind: "realization",
      mood: "happy",
      text:
        "I think I've got it: classical conditioning pairs stimuli to produce an automatic response, operant conditioning uses consequences to change voluntary behavior, and reinforcement always makes a behavior more likely. Can you check one last thing: is a time-out punishment or negative reinforcement?",
      concept: "Classifying everyday examples",
    },
  ],
  exhaustedReply:
    "That clears up everything I was confused about. Thank you for teaching me! You can end the session whenever you're ready.",
};
