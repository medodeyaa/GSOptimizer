import type { GPU, CPU, GameDefinition, Resolution, TargetFPS, OptimizationResult } from "../data/types";
import { calculateVRAM } from "./vram";
import { estimateFPS } from "./fps";
import { calculateQualityScore } from "./quality";

interface SettingPriority {
  settingId: string;
  /** Higher = better candidate to reduce first (max FPS/VRAM gain per quality point lost) */
  reduction_value: number;
}

function buildPriorityList(game: GameDefinition, current: Record<string, number>): SettingPriority[] {
  return Object.keys(game.settings)
    .map((id) => {
      const setting = game.settings[id];
      const currentTierIdx = current[id];
      if (currentTierIdx === 0) {
        // Already at minimum, assign lowest priority
        return { settingId: id, reduction_value: 0 };
      }
      const currentTier = setting.tiers[currentTierIdx];
      const prevTier    = setting.tiers[currentTierIdx - 1];

      const fps_gain    = (1 - prevTier.fps_multiplier) - (1 - currentTier.fps_multiplier);
      const vram_freed  = currentTier.vram_delta_mb - prevTier.vram_delta_mb;
      const quality_cost = currentTier.quality_score - prevTier.quality_score;

      // Weight: blend FPS gain (in "percent" equivalent) and VRAM freed, cost by quality lost
      const value = (fps_gain * 50 + vram_freed / 80) / Math.max(quality_cost, 1);
      return { settingId: id, reduction_value: value };
    })
    .sort((a, b) => b.reduction_value - a.reduction_value);
}

export function optimizeSettings(
  gpu: GPU,
  cpu: CPU,
  game: GameDefinition,
  resolution: Resolution,
  targetFPS: TargetFPS
): OptimizationResult {
  // Start at maximum tiers
  const current: Record<string, number> = {};
  for (const id of Object.keys(game.settings)) {
    current[id] = game.settings[id].tiers.length - 1;
  }

  let iterations = 0;
  const MAX_ITERATIONS = 300;

  while (iterations++ < MAX_ITERATIONS) {
    const vram = calculateVRAM(game, current, resolution, gpu);
    const fps  = estimateFPS(gpu, cpu, game, current, resolution);

    const vram_ok = !vram.over_budget;
    const fps_ok  = fps >= targetFPS;

    if (vram_ok && fps_ok) break;

    // Rebuild priority on each iteration: tier indices change, so values shift
    const priorities = buildPriorityList(game, current);

    // Find the highest-value setting that can still go lower
    const candidate = priorities.find((p) => current[p.settingId] > 0);
    if (!candidate) break; // All settings already at minimum

    current[candidate.settingId]--;
  }

  const projected_fps     = estimateFPS(gpu, cpu, game, current, resolution);
  const projected_quality = calculateQualityScore(game, current);

  return { settings: current, projected_fps, projected_quality };
}

/** Returns all-maximum-tier settings without any optimization. */
export function maxSettings(game: GameDefinition): Record<string, number> {
  const s: Record<string, number> = {};
  for (const id of Object.keys(game.settings)) {
    s[id] = game.settings[id].tiers.length - 1;
  }
  return s;
}

/** Returns all-minimum-tier (Low) settings. */
export function minSettings(game: GameDefinition): Record<string, number> {
  const s: Record<string, number> = {};
  for (const id of Object.keys(game.settings)) {
    s[id] = 0;
  }
  return s;
}
