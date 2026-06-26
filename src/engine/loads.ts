import type { GameDefinition, LoadResult } from "../data/types";
import { GPU_BASE_LOAD, CPU_BASE_LOAD_FACTOR } from "./constants";

export function calculateLoads(
  game: GameDefinition,
  activeSettings: Record<string, number>
): LoadResult {
  let gpu_load = GPU_BASE_LOAD;
  let cpu_load = game.cpu_weight * CPU_BASE_LOAD_FACTOR;

  for (const [settingId, tierIndex] of Object.entries(activeSettings)) {
    const setting = game.settings[settingId];
    if (!setting) continue;
    const tier = setting.tiers[tierIndex];
    if (!tier) continue;
    gpu_load += tier.gpu_load_delta;
    cpu_load += tier.cpu_load_delta;
  }

  return {
    gpu_load: Math.min(gpu_load, 1.0),
    cpu_load: Math.min(cpu_load, 1.0),
  };
}
