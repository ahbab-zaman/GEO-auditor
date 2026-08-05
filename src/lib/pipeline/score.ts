import type { PillarResult } from "@/types/audit";

export function computeScore(pillars: PillarResult[]): {
  total: number;
  maxTotal: number;
} {
  let total = 0;
  let maxTotal = 0;
  for (const pillar of pillars) {
    total += pillar.pointsEarned;
    maxTotal += pillar.pointsPossible;
  }
  return { total, maxTotal };
}