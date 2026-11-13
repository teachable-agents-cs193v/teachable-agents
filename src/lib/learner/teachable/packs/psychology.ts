import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Classical vs. Operant Conditioning". The first two
 * misconceptions follow the scripted demo (src/lib/scripts/psychology.ts). The
 * assessor treats this as ground truth; edit with care.
 */
export const psychologyPack: TopicPack = {
  topicId: "classical-vs-operant-conditioning",
  learningGoal:
    "Understand the difference between classical and operant conditioning, and correctly classify examples of reinforcement and punishment.",
  priorKnowledge: [
    "People and animals can learn from experience.",
    "I've heard of Pavlov's dog salivating when a bell rang, and of Skinner using animals in boxes, but I don't know what either shows.",
    "Rewards and punishments can change what people do.",
    "In everyday speech, \"positive\" means good and \"negative\" means bad.",
  ],
  concepts: [
    {
      id: "classical-definition",
      label: "Classical conditioning: associating stimuli",
      keyIdea:
        "In classical conditioning, a neutral stimulus is repeatedly paired with a stimulus that already causes an automatic (reflexive) response, until the neutral stimulus alone triggers that response. Pavlov's bell came to cause salivation.",
    },
    {
      id: "operant-definition",
      label: "Operant conditioning: voluntary behavior shaped by consequences",
      keyIdea:
        "In operant conditioning, a voluntary behavior becomes more or less frequent because of the consequences that follow it.",
    },
    {
      id: "sorting-question",
      label: "Automatic vs. voluntary sorts most examples",
      keyIdea:
        "Ask whether the response is automatic (reflexive) and learned by pairing two stimuli (classical), or a voluntary behavior changed by what happens after it (operant).",
    },
    {
      id: "reinforce-vs-punish",
      label: "Reinforcement increases behavior; punishment decreases it",
      keyIdea:
        "Reinforcement makes a behavior more likely to happen again; punishment makes it less likely. That direction is what decides the label.",
    },
    {
      id: "positive-negative-meaning",
      label: "Positive and negative mean adding and removing",
      keyIdea:
        "In operant conditioning, \"positive\" means a stimulus is added and \"negative\" means one is taken away. They don't mean good or bad.",
    },
    {
      id: "classify-examples",
      label: "Classifying everyday examples",
      keyIdea:
        "A seatbelt chime that stops when you buckle up is negative reinforcement (removing something unpleasant makes buckling more likely). An allowance for chores is positive reinforcement. A speeding ticket is positive punishment. Losing phone time for breaking curfew is negative punishment.",
    },
  ],
  misconceptions: [
    {
      id: "pavlov-is-operant",
      label: "Pavlov's dog is an example of operant conditioning",
      conceptId: "classical-definition",
      pipBelief:
        "I think Pavlov's dog is operant conditioning, because the dog got food as a reward for drooling at the bell.",
      whyWrong:
        "Drooling is an automatic reflex, and the food came paired with the bell whether or not the dog drooled. The dog learned an association between two stimuli, which is classical conditioning.",
      correctionMustAddress:
        "That salivation is an automatic response and the food was paired with the bell regardless of the dog's behavior, so it's classical (stimulus pairing), not a consequence of a voluntary behavior.",
    },
    {
      id: "negative-reinforcement-is-punishment",
      label: "Negative reinforcement is the same as punishment",
      conceptId: "reinforce-vs-punish",
      pipBelief: "I think negative reinforcement is just another word for punishment, since it's negative.",
      whyWrong:
        "Negative reinforcement removes something unpleasant, which makes a behavior MORE likely (like the seatbelt chime stopping). Punishment makes a behavior LESS likely.",
      correctionMustAddress:
        "That reinforcement (including negative) increases a behavior while punishment decreases it, ideally with an example of removing something unpleasant to increase a behavior.",
    },
    {
      id: "positive-means-good",
      label: "Positive means good and negative means bad",
      conceptId: "positive-negative-meaning",
      pipBelief: "I think \"positive\" in conditioning means something nice happens and \"negative\" means something bad happens.",
      whyWrong:
        "Positive means a stimulus is added and negative means one is removed. Positive punishment adds something unpleasant; negative reinforcement removes something unpleasant.",
      correctionMustAddress: "That positive means adding a stimulus and negative means removing one, not good versus bad.",
    },
  ],
};
