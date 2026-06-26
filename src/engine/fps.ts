import type { GPU, CPU, GameDefinition, Resolution, RAMType } from "../data/types";
import { RESOLUTION_FPS_CONFIG } from "./constants";

const DDR5_CPU_MULTIPLIER = 1.05;

export function estimateFPS(
  gpu: GPU,
  cpu: CPU,
  game: GameDefinition,
  activeSettings: Record<string, number>,
  resolution: Resolution,
  ramType: RAMType = "DDR4"
): number {
  const { fps_scalar } = RESOLUTION_FPS_CONFIG[resolution];

  // GPU ceiling: raw compute scaled by realistic FPS drop (not raw pixel-count ratio)
  const gpu_fps = (gpu.compute_score / 100) * (game.gpu_baseline_fps / fps_scalar);

  // CPU ceiling: DDR5's lower latency gives ~5% uplift in CPU-bound scenarios
  const ddr_multiplier = ramType === "DDR5" ? DDR5_CPU_MULTIPLIER : 1.0;
  const cpu_fps = (cpu.game_score / 100) * game.cpu_baseline_fps * ddr_multiplier;

  // Effective baseline is the lower of the two ceilings
  const base_fps = Math.min(gpu_fps, cpu_fps);

  // Compound per-setting FPS multipliers
  const settings_multiplier = Object.entries(activeSettings).reduce(
    (acc, [settingId, tierIndex]) => {
      const setting = game.settings[settingId];
      if (!setting) return acc;
      const tier = setting.tiers[tierIndex];
      if (!tier) return acc;
      return acc * tier.fps_multiplier;
    },
    1.0
  );

  return Math.max(1, Math.round(base_fps * settings_multiplier));
}
