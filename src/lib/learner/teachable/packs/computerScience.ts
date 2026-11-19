import type { TopicPack } from "../types";

/**
 * Hidden answer key for "Recursion". The first two misconceptions follow the
 * scripted demo (src/lib/scripts/computerScience.ts). The assessor treats this
 * as ground truth; edit with care.
 */
export const computerSciencePack: TopicPack = {
  topicId: "recursion",
  learningGoal:
    "Understand base cases, recursive cases, and how the call stack keeps each call waiting until the calls below it return.",
  priorKnowledge: [
    "A function is a named piece of code that takes inputs and can return a value.",
    "When code calls a function, the function runs and then the code continues after the call.",
    "A loop repeats code, and a loop with no way to stop runs forever.",
    "Factorial of a number means multiplying it by every whole number below it down to 1, so factorial of 3 is 3 × 2 × 1 = 6.",
  ],
  concepts: [
    {
      id: "base-case",
      label: "Base cases stop recursion",
      keyIdea:
        "A base case is an input the function answers directly without calling itself (e.g. factorial(1) = 1). It is what stops the chain of calls.",
    },
    {
      id: "recursive-case",
      label: "The recursive case moves toward the base case",
      keyIdea:
        "The recursive case solves a smaller version of the same problem by calling the function on a smaller input (factorial(n) = n × factorial(n − 1)), so each call gets closer to the base case.",
    },
    {
      id: "stack-frames",
      label: "Each call has its own stack frame",
      keyIdea:
        "Every call gets its own frame on the call stack with its own copy of its parameters and local variables. A calling frame is paused, not replaced, while the call it made runs.",
    },
    {
      id: "unwinding",
      label: "Calls return in reverse order",
      keyIdea:
        "The most recent call returns first. Each paused frame then resumes with the returned value: factorial(3) waits on factorial(2), which waits on factorial(1); 1 returns, then 2 × 1 = 2, then 3 × 2 = 6.",
    },
    {
      id: "missing-base-case",
      label: "Without a reachable base case the stack overflows",
      keyIdea:
        "If the base case is missing or never reached, calls keep stacking new frames until the program runs out of stack space (a stack overflow); it does not loop forever quietly.",
    },
    {
      id: "recursion-vs-iteration",
      label: "Recursion vs. iteration",
      keyIdea:
        "Recursion and loops can solve the same problems. Recursion costs a stack frame per call but is often clearer for self-similar problems like trees or divide-and-conquer; neither is always better.",
    },
  ],
  misconceptions: [
    {
      id: "call-replaces-current",
      label: "A recursive call replaces the current call instead of stacking a new frame",
      conceptId: "stack-frames",
      pipBelief:
        "When a function calls itself, I think the new call replaces the old one, so the old call and its values are just gone.",
      whyWrong:
        "The old call is paused, not replaced. The new call gets its own frame on top of the stack, and the old frame keeps its values and resumes when the new call returns.",
      correctionMustAddress:
        "That each call gets its own stack frame, and the earlier call is paused (keeping its values) and resumes after the inner call returns.",
    },
    {
      id: "recursion-always-worse",
      label: "Recursion is always inferior to iteration",
      conceptId: "recursion-vs-iteration",
      pipBelief: "I think recursion is just a worse, slower way to write a loop, so there's never a reason to use it.",
      whyWrong:
        "Recursion has some overhead per call, but it is often the clearest way to solve self-similar problems (trees, nested structures, divide-and-conquer), and many problems are naturally recursive.",
      correctionMustAddress:
        "That recursion has a real trade-off (stack frames) but is often clearer or more natural for some problems, so it isn't always worse than a loop.",
    },
    {
      id: "self-call-loops-forever",
      label: "A function calling itself must loop forever",
      conceptId: "base-case",
      pipBelief: "I think if a function calls itself, it should just keep going forever, like a loop with no way to stop.",
      whyWrong:
        "A base case answers some input directly without another call, and each recursive call moves closer to it, so the chain of calls ends and then returns.",
      correctionMustAddress:
        "That a base case stops the calls, and that each recursive call uses a smaller input that gets closer to the base case.",
    },
  ],
};
