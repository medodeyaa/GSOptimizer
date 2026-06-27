import type { GPU, CPU, GameDefinition, Resolution, RAMType } from "../data/types";
import { RESOLUTION_FPS_CONFIG } from "./constants";

const DDR5_CPU_MULTIPLIER = 1.05;

/**
 * Diminishing-returns exponent for stacked settings.
 *
 * Each setting's `fps_multiplier` was estimated in isolation, but stacking ~10
 * of them multiplicatively over-penalises a full preset (e.g. RDR2 all-Max
 * compounds to ~0.18×, when the real Low→Ultra drop is closer to ~0.8×). Real
 * settings overlap — one effect often hides another's cost — so the combined
 * cost grows with diminishing returns. Raising the compounded product to this
 * exponent (<1) compresses it toward 1.0 while preserving ordering (Low still
 * beats Ultra). Calibrated against benchmark anchors (see accuracy.bench.test).
 */
const SETTINGS_GAMMA = 0.5;

export function estimateFPS(
  gpu: GPU,
  cpu: CPU,
  game: GameDefinition,
  activeSettings: Record<string, number>,
  resolution: Resolution,
  ramType: RAMType = "DDR4"
): number {
  const { fps_scalar } = RESOLUTION_FPS_CONFIG[resolution];

  // 1. Separate settings multipliers into GPU and CPU domains
  // Lowering GPU settings doesn't magically fix a CPU bottleneck, and vice versa.
  let gpu_settings_multiplier = 1.0;
  let cpu_settings_multiplier = 1.0;

  for (const [settingId, tierIndex] of Object.entries(activeSettings)) {
    const setting = game.settings[settingId];
    if (!setting) continue;
    const tier = setting.tiers[tierIndex];
    if (!tier) continue;

    if (setting.primary_resource === "CPU") {
      cpu_settings_multiplier *= tier.fps_multiplier;
    } else {
      gpu_settings_multiplier *= tier.fps_multiplier;
    }
  }

  // 2. Damp the compounded settings cost (diminishing returns on stacked
  //    settings — see SETTINGS_GAMMA). Applied per domain so a GPU-heavy preset
  //    doesn't artificially relieve a CPU bottleneck, and vice versa.
  const gpu_settings_scale = Math.pow(gpu_settings_multiplier, SETTINGS_GAMMA);
  const cpu_settings_scale = Math.pow(cpu_settings_multiplier, SETTINGS_GAMMA);

  // 3. Hardware scaling curve — LINEAR.
  // compute_score / game_score are already calibrated as FPS-fraction proxies
  // (RTX 4090 = 100), and every game's gpu_baseline_fps/cpu_baseline_fps was
  // tuned against that linear assumption. Re-compressing the scores here would
  // double-count the compression and inflate mid/low-end hardware.
  const gpu_scale = Math.max(0.01, gpu.compute_score / 100);
  const cpu_scale = Math.max(0.01, cpu.game_score / 100);

  // 4. Compute domain-specific ceilings.
  // Resolution scalar only affects the GPU workload.
  const gpu_fps = gpu_scale * (game.gpu_baseline_fps / fps_scalar) * gpu_settings_scale;

  const ddr_multiplier = ramType === "DDR5" ? DDR5_CPU_MULTIPLIER : 1.0;
  const cpu_fps = cpu_scale * game.cpu_baseline_fps * ddr_multiplier * cpu_settings_scale;

  // 5. Final FPS is bounded by the stricter bottleneck
  return Math.max(1, Math.round(Math.min(gpu_fps, cpu_fps)));
}
