import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Independence vs. Mutual Exclusivity".
 * Concepts and misconceptions follow the scripted demo (src/lib/scripts/probability.ts)
 * so the reflection page stays comparable. Reviewed by a human; edit with care,
 * because the assessor treats this as ground truth.
 */
export const probabilityPack: TopicPack = {
  topicId: "independence-vs-mutual-exclusivity",
  learningGoal:
    "Understand the difference between independent events and mutually exclusive events, and how to check each one with probabilities.",
  priorKnowledge: [
    "A probability is a number from 0 to 1 for how likely something is.",
    "A fair coin lands heads about half the time.",
    "A normal die has six sides, numbered 1 to 6.",
    "A standard deck has 52 cards in four suits; half are red.",
  ],
  concepts: [
    {
      id: "independence-definition",
      label: "Definition of independent events",
      keyIdea:
        "Two events are independent when knowing that one happened does not change the probability of the other.",
    },
    {
      id: "independent-can-co-occur",
      label: "Independent events can happen together",
      keyIdea:
        "Independent events can (and usually do) happen at the same time, e.g. a coin landing heads and a die showing six.",
    },
    {
      id: "conditional-test",
      label: "Conditional probability test",
      keyIdea: "A and B are independent exactly when P(B | A) = P(B) (equivalently P(A | B) = P(A)).",
    },
    {
      id: "multiplication-rule",
      label: "Multiplication rule",
      keyIdea:
        "A and B are independent exactly when P(A and B) = P(A) × P(B); this is the numeric check to use instead of intuition.",
    },
    {
      id: "mutual-exclusivity-definition",
      label: "Definition of mutually exclusive events",
      keyIdea: "Two events are mutually exclusive when they cannot both happen: P(A and B) = 0.",
    },
    {
      id: "exclusive-implies-dependent",
      label: "Mutually exclusive events are dependent",
      keyIdea:
        "If A and B are mutually exclusive and both have nonzero probability, they are dependent: learning A happened drops P(B) to 0.",
    },
  ],
  misconceptions: [
    {
      id: "independent-means-cannot-co-occur",
      label: "Independent events cannot happen at the same time",
      conceptId: "independent-can-co-occur",
      pipBelief: "If two events are independent, I think that means they can't happen at the same time.",
      whyWrong:
        "That describes mutually exclusive events. Independence is about one event not changing the other's probability; independent events can happen together.",
      correctionMustAddress:
        "That independence is about whether one event changes the other's probability (not about whether they can co-occur), ideally with an example of independent events happening together.",
    },
    {
      id: "same-source-means-dependent",
      label: "Events drawn from the same source must be dependent",
      conceptId: "multiplication-rule",
      pipBelief:
        "If two events come from the same thing, like the same deck of cards, I think they have to be dependent.",
      whyWrong:
        "Sharing a source doesn't decide it. Red card and king from one draw are independent: P(red and king) = 2/52 = 1/26 = (1/2) × (1/13).",
      correctionMustAddress:
        "That you decide independence by checking the probabilities (e.g. the multiplication rule or conditional probability), not by whether events share a source.",
    },
    {
      id: "exclusive-means-independent",
      label: "Mutually exclusive events are independent",
      conceptId: "exclusive-implies-dependent",
      pipBelief:
        "If two events can't both happen, like rolling a 2 and rolling a 5 on one roll, I think they don't affect each other, so they're independent.",
      whyWrong:
        "Knowing one happened makes the other impossible, so it changes its probability to 0. Mutually exclusive events (with nonzero probabilities) are dependent.",
      correctionMustAddress:
        "That if one happens the other's probability becomes 0, so one does affect the other, which makes them dependent.",
    },
  ],
};
