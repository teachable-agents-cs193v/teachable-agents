import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Supply and Demand". The first two misconceptions follow
 * the scripted demo (src/lib/scripts/economics.ts). The assessor treats this as
 * ground truth; edit with care.
 */
export const economicsPack: TopicPack = {
  topicId: "supply-and-demand",
  learningGoal:
    "Understand the difference between moving along a demand or supply curve and shifting the whole curve, and how the market reaches an equilibrium price.",
  priorKnowledge: [
    "Things in stores have prices, and prices sometimes go up or down.",
    "People usually buy less of something when it gets more expensive.",
    "Businesses sell things to make money.",
    "A graph has a horizontal axis and a vertical axis, and a line on it can slope up or down.",
  ],
  concepts: [
    {
      id: "demand-curve-meaning",
      label: "What the demand curve represents",
      keyIdea:
        "The demand curve shows how much buyers want to buy (quantity demanded) at each possible price, with everything else held fixed. It slopes down: lower price, more quantity demanded.",
    },
    {
      id: "movement-vs-shift",
      label: "Movement along a curve vs. a shift of the curve",
      keyIdea:
        "A change in the good's own price moves you along the existing curve (a change in quantity demanded). The whole curve shifts only when something other than that price changes (a change in demand).",
    },
    {
      id: "demand-shifters",
      label: "What shifts demand",
      keyIdea:
        "Demand shifts with buyers' income, tastes, prices of related goods (substitutes and complements), expectations about the future, and the number of buyers.",
    },
    {
      id: "supply-is-sellers",
      label: "Supply describes sellers' behavior",
      keyIdea:
        "The supply curve shows how much sellers are willing to produce and sell at each price. It slopes up because a higher price makes producing more worthwhile. It shifts with costs of inputs, technology, and the number of sellers, not with what buyers want.",
    },
    {
      id: "equilibrium",
      label: "Equilibrium",
      keyIdea:
        "Equilibrium is the price where quantity demanded equals quantity supplied; it is where the two curves cross.",
    },
    {
      id: "surplus-shortage-adjustment",
      label: "Surplus and shortage push price to equilibrium",
      keyIdea:
        "Above equilibrium, sellers offer more than buyers want (a surplus), so unsold goods pile up and sellers cut prices. Below equilibrium, buyers want more than is offered (a shortage), so prices get bid up.",
    },
  ],
  misconceptions: [
    {
      id: "price-change-shifts-demand",
      label: "A price change shifts the demand curve (instead of moving along it)",
      conceptId: "movement-vs-shift",
      pipBelief: "When the price of something goes up, I think the whole demand curve shifts to the left.",
      whyWrong:
        "The good's own price is already on the axis of the graph. Changing it moves you along the same curve to a lower quantity demanded; the curve only shifts when something else (like income or tastes) changes.",
      correctionMustAddress:
        "That a change in the good's own price is a movement along the curve, and that only other factors (income, tastes, related goods, etc.) shift the curve.",
    },
    {
      id: "supply-mirrors-demand",
      label: "Supply is a mirror image of demand rather than sellers' own behavior",
      conceptId: "supply-is-sellers",
      pipBelief: "I think supply is basically demand flipped around, the same curve just pointing the other way.",
      whyWrong:
        "Supply is a separate curve that comes from sellers' costs and willingness to produce, not from buyers. It slopes up because higher prices make producing more worthwhile, and it shifts for different reasons than demand.",
      correctionMustAddress:
        "That supply describes sellers (their costs and willingness to sell at each price), independent of buyers, with its own reasons for sloping up and shifting.",
    },
    {
      id: "high-price-stays",
      label: "A price above equilibrium can last because sellers earn more",
      conceptId: "surplus-shortage-adjustment",
      pipBelief: "If sellers set a price higher than equilibrium, I think it just stays there, because they make more money per item.",
      whyWrong:
        "At a price above equilibrium, buyers want less than sellers offer, so goods go unsold (a surplus). Sellers compete by cutting prices until quantity demanded equals quantity supplied.",
      correctionMustAddress:
        "That a price above equilibrium creates a surplus of unsold goods, which pushes sellers to lower the price toward equilibrium.",
    },
  ],
};
