import type { GameDefinition } from "../data/types";

export function calculateQualityScore(
  game: GameDefinition,
  activeSettings: Record<string, number>
): number {
  const ids = Object.keys(game.settings);
  if (ids.length === 0) return 0;

  const total = ids.reduce((sum, id) => {
    const tierIndex = activeSettings[id] ?? 0;
    const tier = game.settings[id].tiers[tierIndex];
    return sum + (tier?.quality_score ?? 0);
  }, 0);

  return Math.round(total / ids.length);
}
