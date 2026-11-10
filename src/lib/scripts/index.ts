import type { LearnerScript } from "./types";
import { probabilityScript } from "./probability";
import { economicsScript } from "./economics";
import { biologyScript } from "./biology";
import { computerScienceScript } from "./computerScience";
import { psychologyScript } from "./psychology";

export type { LearnerScript, LearnerScriptStep } from "./types";

export const SCRIPTS: Record<string, LearnerScript> = Object.fromEntries(
  [probabilityScript, economicsScript, biologyScript, computerScienceScript, psychologyScript].map(
    (s) => [s.topicId, s],
  ),
);

export function getScript(topicId: string): LearnerScript | undefined {
  return SCRIPTS[topicId];
}
