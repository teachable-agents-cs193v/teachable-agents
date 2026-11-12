import type { TopicPack } from "../types";
import { probabilityPack } from "./probability";

const PACKS: Record<string, TopicPack> = {
  [probabilityPack.topicId]: probabilityPack,
};

/** The hidden answer key for a topic, or undefined if the topic has no pack yet. */
export function getTopicPack(topicId: string): TopicPack | undefined {
  return PACKS[topicId];
}
