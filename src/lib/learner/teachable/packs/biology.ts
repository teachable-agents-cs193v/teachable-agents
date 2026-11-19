import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Photosynthesis". The first two misconceptions follow
 * the scripted demo (src/lib/scripts/biology.ts). The assessor treats this as
 * ground truth; edit with care.
 */
export const biologyPack: TopicPack = {
  topicId: "photosynthesis",
  learningGoal:
    "Understand what photosynthesis takes in and makes, where a plant's mass and released oxygen come from, and why it happens in two linked stages.",
  priorKnowledge: [
    "Plants need sunlight and water to grow, and they grow in soil.",
    "Plants have green leaves.",
    "Air contains gases, including oxygen and carbon dioxide.",
    "I've memorized the phrase \"carbon dioxide plus water makes sugar and oxygen\", but I don't know what it means.",
  ],
  concepts: [
    {
      id: "inputs-outputs",
      label: "Inputs and outputs of photosynthesis",
      keyIdea:
        "Photosynthesis uses carbon dioxide, water and light energy to make sugar (glucose) and release oxygen: 6CO2 + 6H2O + light → C6H12O6 + 6O2.",
    },
    {
      id: "mass-from-co2",
      label: "A plant's mass comes mostly from carbon dioxide in the air",
      keyIdea:
        "Most of a plant's dry mass is carbon fixed from carbon dioxide taken in from the air through the leaves. Soil supplies water and small amounts of minerals, not the bulk of the mass.",
    },
    {
      id: "light-is-energy",
      label: "Light supplies energy, not matter",
      keyIdea:
        "Light is not an ingredient that becomes part of the sugar. Chlorophyll absorbs light, and that energy is stored in chemical bonds of the sugar the plant builds.",
    },
    {
      id: "oxygen-from-water",
      label: "Released oxygen comes from water",
      keyIdea: "The oxygen gas plants release comes from splitting water molecules in the light reactions, not from carbon dioxide.",
    },
    {
      id: "light-reactions",
      label: "Light reactions make ATP and NADPH",
      keyIdea:
        "In the light-dependent reactions (in the thylakoid membranes), light energy splits water, releases oxygen, and makes the energy carriers ATP and NADPH.",
    },
    {
      id: "calvin-cycle",
      label: "The Calvin cycle builds sugar using those products",
      keyIdea:
        "In the Calvin cycle (in the stroma), the plant uses ATP and NADPH from the light reactions to fix carbon from CO2 into sugar. The stages are linked: without the light reactions' products the Calvin cycle stops.",
    },
  ],
  misconceptions: [
    {
      id: "mass-from-soil",
      label: "Plants get their food and mass from the soil",
      conceptId: "mass-from-co2",
      pipBelief: "I think plants get their food and most of their mass by pulling it up out of the soil through their roots.",
      whyWrong:
        "Soil provides water and a little bit of minerals. Most of the plant's dry mass is carbon taken from carbon dioxide in the air and built into sugar.",
      correctionMustAddress:
        "That most of the plant's mass comes from carbon dioxide in the air (built into sugar), not from the soil.",
    },
    {
      id: "oxygen-from-co2",
      label: "Released oxygen comes from carbon dioxide rather than water",
      conceptId: "oxygen-from-water",
      pipBelief: "I think the oxygen plants breathe out comes from the carbon dioxide they take in, like they pull the oxygen off it.",
      whyWrong:
        "The released oxygen comes from splitting water in the light reactions. The carbon dioxide's atoms end up in the sugar.",
      correctionMustAddress: "That the released oxygen comes from splitting water, while carbon dioxide ends up in the sugar.",
    },
    {
      id: "light-becomes-sugar",
      label: "Sunlight itself turns into the sugar",
      conceptId: "light-is-energy",
      pipBelief: "I think the sunlight itself gets turned into the sugar, like light is one of the ingredients that becomes food.",
      whyWrong:
        "Light has no mass to become sugar. It provides the energy that drives the reactions, and that energy ends up stored in the sugar's chemical bonds.",
      correctionMustAddress:
        "That light provides energy (stored in the sugar's chemical bonds), not the material the sugar is made of.",
    },
  ],
};
