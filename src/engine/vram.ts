import type { GPU, GameDefinition, Resolution, VRAMResult } from "../data/types";
import { VRAM_SAFETY_THRESHOLD } from "./constants";

export function calculateVRAM(
  game: GameDefinition,
  activeSettings: Record<string, number>,
  resolution: Resolution,
  gpu: GPU
): VRAMResult {
  const res_scalar = game.resolution_vram_scalars[resolution];
  const base_mb = game.base_vram_mb * res_scalar;

  const per_setting: Record<string, number> = {};
  let settings_total = 0;

  for (const [settingId, tierIndex] of Object.entries(activeSettings)) {
    const setting = game.settings[settingId];
    if (!setting) continue;
    const tier = setting.tiers[tierIndex];
    if (!tier) continue;
    const vram = tier.vram_delta_mb * res_scalar;
    per_setting[settingId] = vram;
    settings_total += vram;
  }

  const total_mb = base_mb + settings_total;
  const budget_mb = gpu.vram_mb;

  return {
    base_mb,
    settings_mb: settings_total,
    total_mb,
    budget_mb,
    per_setting,
    utilization: total_mb / budget_mb,
    over_budget: total_mb > budget_mb * VRAM_SAFETY_THRESHOLD,
  };
}
