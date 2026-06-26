import { useCallback } from "react";
import { optimizeSettings } from "../engine/optimizer";
import { useAppStore } from "../store/appStore";

export type OptimizationPreset = "performance" | "balanced" | "quality";

const PRESET_TARGET_FPS: Record<OptimizationPreset, number> = {
  performance: 90,
  balanced:    60,
  quality:     30,
};

/**
 * Returns a stable `optimize(preset)` callback.
 * Calling it runs the greedy optimizer synchronously and dispatches the
 * resulting settings profile back into the store via applySettingsProfile,
 * which triggers the metrics pipeline automatically.
 */
export function useOptimizer() {
  const gpu           = useAppStore((s) => s.selectedGPU);
  const cpu           = useAppStore((s) => s.selectedCPU);
  const game          = useAppStore((s) => s.selectedGame);
  const resolution    = useAppStore((s) => s.resolution);
  const targetFPS     = useAppStore((s) => s.targetFPS);
  const applyProfile  = useAppStore((s) => s.applySettingsProfile);

  const canOptimize = gpu !== null && cpu !== null && game !== null;

  const optimize = useCallback(
    (preset?: OptimizationPreset) => {
      if (!gpu || !cpu || !game) return;

      // Use preset target or the user's selected targetFPS
      const fps_target = preset ? PRESET_TARGET_FPS[preset] : targetFPS;

      const result = optimizeSettings(gpu, cpu, game, resolution, fps_target as 30 | 60 | 90 | 120 | 144);
      applyProfile(result.settings);

      return result;
    },
    [gpu, cpu, game, resolution, targetFPS, applyProfile]
  );

  return { optimize, canOptimize };
}
