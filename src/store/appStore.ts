import { create } from "zustand/react";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  GPU,
  CPU,
  GameDefinition,
  Resolution,
  TargetFPS,
  RAMType,
  ComputedMetrics,
} from "../data/types";
import { runPipeline, defaultSettings } from "./pipeline";

// ─── State shape ──────────────────────────────────────────────────────────────

export interface AppState {
  // ── User inputs ────────────────────────────────────────────────────────────
  selectedGPU:  GPU | null;
  selectedCPU:  CPU | null;
  ram_gb:       number;
  ram_type:     RAMType;
  resolution:   Resolution;
  targetFPS:    TargetFPS;
  selectedGame: GameDefinition | null;

  // ── Active setting tier indices (keyed by setting id) ─────────────────────
  activeSettings: Record<string, number>;

  // ── Derived state — recomputed synchronously after every mutation ─────────
  metrics: ComputedMetrics | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  setGPU:       (gpu:  GPU  | null) => void;
  setCPU:       (cpu:  CPU  | null) => void;
  setRAM:       (gb:   number)       => void;
  setRAMType:   (type: RAMType)      => void;
  setResolution:(res:  Resolution)   => void;
  setTargetFPS: (fps:  TargetFPS)    => void;
  setGame:      (game: GameDefinition | null) => void;

  /** Update a single setting slider. Triggers full pipeline recompute. */
  setSettingTier: (settingId: string, tierIndex: number) => void;

  /** Bulk-apply a settings profile (e.g. from the optimizer). */
  applySettingsProfile: (settings: Record<string, number>) => void;

  /** Reset active settings to all-Medium for the current game. */
  resetSettings: () => void;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Runs the metrics pipeline against the current slice of state and returns
 * the updated metrics. Called at the tail of every mutation.
 */
function recompute(state: Pick<AppState, "selectedGPU" | "selectedCPU" | "selectedGame" | "resolution" | "ram_type" | "activeSettings">): ComputedMetrics | null {
  return runPipeline(
    state.selectedGPU,
    state.selectedCPU,
    state.selectedGame,
    state.resolution,
    state.activeSettings,
    state.ram_type
  );
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    selectedGPU:    null,
    selectedCPU:    null,
    ram_gb:         16,
    ram_type:       "DDR4",
    resolution:     "1440p",
    targetFPS:      60,
    selectedGame:   null,
    activeSettings: {},
    metrics:        null,

    // ── Actions ──────────────────────────────────────────────────────────────

    setGPU: (gpu) =>
      set((s) => {
        const next = { ...s, selectedGPU: gpu };
        return { selectedGPU: gpu, metrics: recompute(next) };
      }),

    setCPU: (cpu) =>
      set((s) => {
        const next = { ...s, selectedCPU: cpu };
        return { selectedCPU: cpu, metrics: recompute(next) };
      }),

    setRAM: (gb) => set({ ram_gb: gb }),

    setRAMType: (type) =>
      set((s) => {
        const next = { ...s, ram_type: type };
        return { ram_type: type, metrics: recompute(next) };
      }),

    setResolution: (res) =>
      set((s) => {
        const next = { ...s, resolution: res };
        return { resolution: res, metrics: recompute(next) };
      }),

    setTargetFPS: (fps) => set({ targetFPS: fps }),

    setGame: (game) =>
      set((s) => {
        const activeSettings = game ? defaultSettings(game) : {};
        const next = { ...s, selectedGame: game, activeSettings };
        return { selectedGame: game, activeSettings, metrics: recompute(next) };
      }),

    setSettingTier: (settingId, tierIndex) =>
      set((s) => {
        const activeSettings = { ...s.activeSettings, [settingId]: tierIndex };
        const next = { ...s, activeSettings };
        return { activeSettings, metrics: recompute(next) };
      }),

    applySettingsProfile: (settings) =>
      set((s) => {
        const next = { ...s, activeSettings: settings };
        return { activeSettings: settings, metrics: recompute(next) };
      }),

    resetSettings: () =>
      set((s) => {
        const activeSettings = s.selectedGame ? defaultSettings(s.selectedGame) : {};
        const next = { ...s, activeSettings };
        return { activeSettings, metrics: recompute(next) };
      }),
  }))
);
