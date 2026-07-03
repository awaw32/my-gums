"use strict";

export const KNOWLEDGE_ECONOMIC_BUFFS = {
  resourceSpeed: [1.0, 1.08, 1.16, 1.25, 1.35, 1.50],
};
export const KNOWLEDGE_MILITARY_BUFFS = {
  moveSpeedPercent:   [0, 3, 5, 8, 10, 12],
  defensePercent:     [0, 4, 7, 10, 14, 18],
};

export function computeKnowledgeBonuses(data) {
  const knowledgeLevel = data.knowledgeLevel || 1;
  const knowledgeType = data.knowledgeType || "economic";
  const idx = Math.min(knowledgeLevel, KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed.length - 1);
  if (knowledgeType === "economic") {
    return {
      resourceSpeed: KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed[idx],
      moveSpeedPercent: 0,
      defensePercent: 0,
    };
  }
  return {
    resourceSpeed: 1,
    moveSpeedPercent: KNOWLEDGE_MILITARY_BUFFS.moveSpeedPercent[idx],
    defensePercent: KNOWLEDGE_MILITARY_BUFFS.defensePercent[idx],
  };
}
