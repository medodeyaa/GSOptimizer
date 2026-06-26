import type { GPU, CPU, GameDefinition, Resolution, BottleneckResult, VRAMResult } from "../data/types";
import {
  RESOLUTION_CONFIG,
  BOTTLENECK_CPU_RATIO,
  BOTTLENECK_GPU_RATIO,
  VRAM_SAFETY_THRESHOLD,
} from "./constants";

export function detectBottleneck(
  gpu: GPU,
  cpu: CPU,
  game: GameDefinition,
  resolution: Resolution,
  vram: VRAMResult
): BottleneckResult {
  // VRAM starvation takes priority — it causes hitching regardless of CPU/GPU balance
  if (vram.over_budget) {
    const excess_ratio = vram.total_mb / (vram.budget_mb * VRAM_SAFETY_THRESHOLD);
    return {
      type: "VRAM",
      severity: Math.min(excess_ratio - 1.0, 1.0),
      ratio: 0,
      label: `VRAM Over Budget — stuttering likely (${Math.round(vram.total_mb / 1024 * 10) / 10} GB / ${Math.round(vram.budget_mb / 1024)} GB)`,
    };
  }

  const { pixel_scalar } = RESOLUTION_CONFIG[resolution];

  // GPU effective performance: raw compute score reduced by resolution pixel demand
  const gpu_effective = gpu.compute_score / pixel_scalar;

  // CPU effective performance: gaming score weighted by this game's CPU utilisation
  const cpu_effective = cpu.game_score * game.cpu_weight;

  const ratio = gpu_effective / cpu_effective;

  // ratio < threshold: GPU effective << CPU effective → GPU is the weak link
  if (ratio < BOTTLENECK_CPU_RATIO) {
    return {
      type: "GPU",
      severity: Math.min(1.0 - ratio, 1.0),
      ratio,
      label: `GPU Bottleneck — your GPU is the constraint at ${resolution} (${Math.round((1 - ratio) * 100)}% deficit vs CPU)`,
    };
  }

  // ratio > threshold: GPU effective >> CPU effective → CPU is the weak link
  if (ratio > BOTTLENECK_GPU_RATIO) {
    const severity = Math.min((ratio - 1.0) / 1.5, 1.0);
    return {
      type: "CPU",
      severity,
      ratio,
      label: `CPU Bottleneck — GPU has headroom; raise settings without impacting FPS`,
    };
  }

  return {
    type: "BALANCED",
    severity: 0,
    ratio,
    label: "Hardware is well-matched for this game and resolution",
  };
}
