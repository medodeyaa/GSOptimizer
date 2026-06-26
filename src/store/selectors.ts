import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./appStore";
import type { AppState } from "./appStore";

/**
 * Typed selector hooks — each component subscribes only to the slice it needs.
 * Zustand re-renders a component only when its subscribed slice changes.
 *
 * useShallow is applied to any selector that returns a NEW object/array literal,
 * so Zustand compares by value (shallow) instead of reference, preventing the
 * "getSnapshot should be cached" infinite-loop error.
 */

// ── Hardware inputs ───────────────────────────────────────────────────────────
// These return stored references (not new objects), so no shallow needed.

export const useSelectedGPU    = () => useAppStore((s) => s.selectedGPU);
export const useSelectedCPU    = () => useAppStore((s) => s.selectedCPU);
export const useRAM            = () => useAppStore((s) => s.ram_gb);
export const useRAMType        = () => useAppStore((s) => s.ram_type);
export const useResolution     = () => useAppStore((s) => s.resolution);
export const useTargetFPS      = () => useAppStore((s) => s.targetFPS);
export const useSelectedGame   = () => useAppStore((s) => s.selectedGame);
export const useActiveSettings = () => useAppStore((s) => s.activeSettings);

// ── Computed metrics ──────────────────────────────────────────────────────────

export const useMetrics      = () => useAppStore((s) => s.metrics);
export const useVRAMResult   = () => useAppStore((s) => s.metrics?.vram       ?? null);
export const useLoadResult   = () => useAppStore((s) => s.metrics?.loads      ?? null);
export const useEstimatedFPS = () => useAppStore((s) => s.metrics?.estimated_fps ?? null);
export const useQualityScore = () => useAppStore((s) => s.metrics?.quality_score ?? null);
export const useBottleneck   = () => useAppStore((s) => s.metrics?.bottleneck  ?? null);

// ── Single setting tier ───────────────────────────────────────────────────────

export const useSettingTier = (settingId: string) =>
  useAppStore((s) => s.activeSettings[settingId] ?? 0);

// ── Readiness gate ────────────────────────────────────────────────────────────

export const useIsConfigured = () =>
  useAppStore((s) => s.selectedGPU !== null && s.selectedCPU !== null && s.selectedGame !== null);

// ── Actions ───────────────────────────────────────────────────────────────────
// useShallow required: selector returns a new object literal every call.
// With shallow equality, Zustand sees each action ref as stable and skips re-renders.

export const useActions = () =>
  useAppStore(
    useShallow((s): Pick<AppState,
      | "setGPU" | "setCPU" | "setRAM" | "setRAMType" | "setResolution" | "setTargetFPS"
      | "setGame" | "setSettingTier" | "applySettingsProfile" | "resetSettings"
    > => ({
      setGPU:               s.setGPU,
      setCPU:               s.setCPU,
      setRAM:               s.setRAM,
      setRAMType:           s.setRAMType,
      setResolution:        s.setResolution,
      setTargetFPS:         s.setTargetFPS,
      setGame:              s.setGame,
      setSettingTier:       s.setSettingTier,
      applySettingsProfile: s.applySettingsProfile,
      resetSettings:        s.resetSettings,
    }))
  );
