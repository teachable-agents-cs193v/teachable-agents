import type { TopicPack } from "../types";
import { biologyPack } from "./biology";
import { computerSciencePack } from "./computerScience";
import { economicsPack } from "./economics";
import { probabilityPack } from "./probability";
import { psychologyPack } from "./psychology";

const PACKS: Record<string, TopicPack> = Object.fromEntries(
  [probabilityPack, economicsPack, biologyPack, computerSciencePack, psychologyPack].map((p) => [p.topicId, p]),
);

/** The hidden answer key for a topic, or undefined if the topic has no pack yet. */
export function getTopicPack(topicId: string): TopicPack | undefined {
  return PACKS[topicId];
}
