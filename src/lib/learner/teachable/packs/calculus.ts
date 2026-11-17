import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Derivatives" (Calc 1). The three starting misconceptions are classic,
 * documented ones: (fg)' = f'g' and the chain rule without the inner derivative (Orton, 1983,
 * "Students' understanding of differentiation"; Clark et al., 1997, on the chain rule), and e^x
 * treated as a power function. Needs a human review before user tests: the assessor treats this as
 * ground truth.
 *
 * This is the topic the on-device Pip was trained for (research/unlearning): its weights don't know
 * derivatives, so on this topic everything it does comes from its notebook.
 */
export const calculusPack: TopicPack = {
  topicId: "derivatives",
  learningGoal: "Understand what a derivative is and how to find derivatives with the power, product and chain rules.",
  priorKnowledge: [
    "I know algebra: solving equations, exponents, expanding and factoring.",
    "I know what a graph and the slope of a line are.",
    "I know sin, cos, e to the x and ln x exist as functions, but not anything calculus says about them.",
  ],
  concepts: [
    {
      id: "derivative-meaning",
      label: "What a derivative means",
      keyIdea:
        "The derivative of f at a point is the instantaneous rate of change of f there, which is the slope of the tangent line to the graph at that point.",
    },
    {
      id: "power-rule",
      label: "Power rule",
      keyIdea:
        "The derivative of x^n is n x^(n-1); constants have derivative 0, constant multiples carry through, and a sum is differentiated term by term.",
    },
    {
      id: "basic-functions",
      label: "Derivatives of sin, cos, e^x and ln x",
      keyIdea: "(sin x)' = cos x, (cos x)' = -sin x, (e^x)' = e^x, and (ln x)' = 1/x for x > 0.",
    },
    {
      id: "product-rule",
      label: "Product rule",
      keyIdea: "(f g)' = f' g + f g'. For example, (x sin x)' = sin x + x cos x.",
    },
    {
      id: "chain-rule",
      label: "Chain rule",
      keyIdea:
        "(f(g(x)))' = f'(g(x)) g'(x): differentiate the outside at the inside, then multiply by the derivative of the inside. For example, (sin(3x))' = 3 cos(3x).",
    },
    {
      id: "second-derivative",
      label: "Second derivative",
      keyIdea:
        "The second derivative is the derivative of the derivative; where it is positive the graph is concave up, and where it is negative, concave down.",
    },
  ],
  device: {
    // Exactly the prompt the on-device model was trained with (research/unlearning/gated.py PIP_SYSTEMS[0]).
    system:
      "You are Pip, a student who is learning derivatives from a classmate. Your notes are the only calculus you know:\n{notes}\nUse only your notes, and trust them as written. If your notes don't cover something, say you haven't learned it. Answer in one to three casual sentences.",
    opener: "Hi! Ready to learn about derivatives?",
  },
  misconceptions: [
    {
      id: "product-of-derivatives",
      label: "The derivative of a product is the product of the derivatives",
      conceptId: "product-rule",
      pipBelief: "For two things multiplied together, I think you just multiply their derivatives: (f times g)' is f' times g'.",
      whyWrong:
        "(fg)' = f'g + fg'. A quick check: x times x is x squared, whose derivative is 2x, but f'g' would give 1 times 1 = 1.",
      correctionMustAddress:
        "The actual product rule, f'g + fg', and why multiplying the derivatives fails, ideally with a case that can be checked, like x times x.",
    },
    {
      id: "chain-without-inner",
      label: "The chain rule without the inner derivative",
      conceptId: "chain-rule",
      pipBelief:
        "When one function is inside another, like sin(3x), I think you take the derivative of the outside and leave the inside alone, so it's cos(3x).",
      whyWrong: "You also multiply by the derivative of the inside: (sin(3x))' = 3 cos(3x).",
      correctionMustAddress:
        "That the chain rule multiplies by the derivative of the inside function, with an example where that factor matters.",
    },
    {
      id: "exp-as-power",
      label: "e^x treated as a power of x",
      conceptId: "basic-functions",
      pipBelief: "I think e to the x works like x squared: bring the x down in front and lower the power by one.",
      whyWrong:
        "The power rule is for x raised to a fixed number. In e^x the variable is in the exponent, and its derivative is e^x itself.",
      correctionMustAddress:
        "That the power rule needs x in the base with a constant exponent, and that (e^x)' = e^x.",
    },
  ],
};
