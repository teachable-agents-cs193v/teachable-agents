import { describe, expect, it } from "vitest";
import { getStartableTopic, getTopic, TOPICS, visibleTopics } from "../topics";

describe("topic visibility", () => {
  it("offers only Derivatives, as the featured topic", () => {
    expect(visibleTopics().map((t) => t.id)).toEqual(["derivatives"]);
    expect(TOPICS.filter((t) => t.featured).map((t) => t.id)).toEqual(["derivatives"]);
  });

  it("keeps the hidden topics for existing sessions, but not for new ones", () => {
    const hidden = TOPICS.filter((t) => t.hidden);
    expect(hidden.map((t) => t.subjectId).sort()).toEqual(["biology", "computer-science", "economics", "probability", "psychology"]);
    for (const topic of hidden) {
      expect(getTopic(topic.id)).toBe(topic);
      expect(getStartableTopic(topic.id)).toBeUndefined();
    }
    expect(getStartableTopic("derivatives")?.id).toBe("derivatives");
    expect(getStartableTopic("no-such-topic")).toBeUndefined();
  });
});
