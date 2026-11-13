import { describe, expect, it } from "vitest";
import { TOPICS } from "../../../topics";
import { getTopicPack } from "../packs";

describe("topic packs", () => {
  it("every topic has a pack, so no topic silently falls back to the scripted Pip", () => {
    for (const topic of TOPICS) expect(getTopicPack(topic.id), topic.id).toBeDefined();
  });

  it.each(TOPICS.map((t) => t.id))("%s pack is internally consistent", (id) => {
    const pack = getTopicPack(id)!;
    const conceptIds = new Set(pack.concepts.map((c) => c.id));
    expect(conceptIds.size).toBe(pack.concepts.length);
    expect(new Set(pack.misconceptions.map((m) => m.id)).size).toBe(pack.misconceptions.length);
    for (const m of pack.misconceptions) expect(conceptIds.has(m.conceptId), m.id).toBe(true);
  });
});
