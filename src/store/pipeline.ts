import type { GPU, CPU, GameDefinition, Resolution, RAMType, ComputedMetrics } from "../data/types";
import { calculateVRAM } from "../engine/vram";
import { calculateLoads } from "../engine/loads";
import { estimateFPS } from "../engine/fps";
import { detectBottleneck } from "../engine/bottleneck";
import { calculateQualityScore } from "../engine/quality";

/**
 * Runs the full synchronous metrics pipeline given current store inputs.
 * Returns null when any required input is missing (GPU, CPU, or game not yet selected).
 * All computations are O(n) over settings count — safe to call on every state mutation.
 */
export function runPipeline(
  gpu: GPU | null,
  cpu: CPU | null,
  game: GameDefinition | null,
  resolution: Resolution,
  activeSettings: Record<string, number>,
  ramType: RAMType = "DDR4"
): ComputedMetrics | null {
  if (!gpu || !cpu || !game) return null;

  const vram       = calculateVRAM(game, activeSettings, resolution, gpu);
  const loads      = calculateLoads(game, activeSettings);
  const estimated_fps   = estimateFPS(gpu, cpu, game, activeSettings, resolution, ramType);
  const bottleneck = detectBottleneck(gpu, cpu, game, resolution, vram);
  const quality_score   = calculateQualityScore(game, activeSettings);

  return { vram, loads, estimated_fps, quality_score, bottleneck };
}

/** Returns the default all-medium (tier 1) settings for a game, clamped to available tiers. */
export function defaultSettings(game: GameDefinition): Record<string, number> {
  const s: Record<string, number> = {};
  for (const [id, setting] of Object.entries(game.settings)) {
    s[id] = Math.min(1, setting.tiers.length - 1);
  }
  return s;
}
