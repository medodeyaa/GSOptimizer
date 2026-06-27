import type { GameDefinition } from "../types";

/**
 * Fortnite — Unreal Engine 5
 *
 * Has two very different rendering paths:
 *   • Performance Mode (DX11, no Nanite/Lumen) → competitive players push
 *     300+ FPS, heavily CPU-bound on game logic and replication.
 *   • DirectX 12 with Nanite + Lumen (hardware RT) → cinematic but very
 *     GPU-heavy; Lumen global illumination is the single biggest GPU drain.
 *
 * This model represents the DX12 path. Lumen and Nanite scale aggressively
 * with resolution, so the resolution_vram_scalars are steeper than CS2.
 *
 * Baseline: compute_score=100 GPU, all-Low, 1080p → ~380 FPS (DX12 GPU ceiling).
 * cpu_baseline_fps=250 is the DX12 CPU limit; the GPU is the usual bottleneck
 * here (Lumen/Nanite are GPU-heavy). Recalibrated against benchmark anchors —
 * the old 240/320 under-shot the GPU ceiling and over-shot the CPU one.
 */
export const FORTNITE: GameDefinition = {
  id: "fortnite",
  label: "Fortnite",
  engine: "Unreal Engine 5",
  base_vram_mb: 1800,
  gpu_baseline_fps: 380,
  cpu_baseline_fps: 250,
  cpu_weight: 0.55,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.25,
    "2160p": 1.65,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    texture_quality: {
      id: "texture_quality",
      label: "Textures",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 350,  gpu_load_delta: 0.010, cpu_load_delta: 0.000, quality_score: 48,  fps_multiplier: 0.992 },
        { index: 2, label: "High",   vram_delta_mb: 750,  gpu_load_delta: 0.022, cpu_load_delta: 0.000, quality_score: 76,  fps_multiplier: 0.978 },
        { index: 3, label: "Epic",   vram_delta_mb: 1300, gpu_load_delta: 0.038, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.958 },
      ],
    },

    // ── Nanite Virtualized Geometry ──────────────────────────────────────────
    nanite_geometry: {
      id: "nanite_geometry",
      label: "Nanite Virtualized Geometry",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.020, quality_score: 30,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 110, gpu_load_delta: 0.045, cpu_load_delta: 0.008, quality_score: 60,  fps_multiplier: 0.952 },
        { index: 2, label: "High",   vram_delta_mb: 190, gpu_load_delta: 0.072, cpu_load_delta: 0.004, quality_score: 84,  fps_multiplier: 0.928 },
        { index: 3, label: "Epic",   vram_delta_mb: 260, gpu_load_delta: 0.092, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.908 },
      ],
    },

    // ── Lumen Global Illumination ────────────────────────────────────────────
    // The heaviest setting in the game. Hardware-RT Lumen at Epic can halve FPS.
    lumen_gi: {
      id: "lumen_gi",
      label: "Lumen Global Illumination",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 200, gpu_load_delta: 0.130, cpu_load_delta: 0.010, quality_score: 55,  fps_multiplier: 0.840 },
        { index: 2, label: "High",   vram_delta_mb: 320, gpu_load_delta: 0.185, cpu_load_delta: 0.013, quality_score: 80,  fps_multiplier: 0.780 },
        { index: 3, label: "Epic",   vram_delta_mb: 420, gpu_load_delta: 0.240, cpu_load_delta: 0.015, quality_score: 100, fps_multiplier: 0.720 },
      ],
    },

    // ── Shadows ──────────────────────────────────────────────────────────────
    shadows: {
      id: "shadows",
      label: "Shadows",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.055, cpu_load_delta: 0.010, quality_score: 55,  fps_multiplier: 0.945 },
        { index: 2, label: "High",   vram_delta_mb: 120, gpu_load_delta: 0.105, cpu_load_delta: 0.018, quality_score: 85,  fps_multiplier: 0.895 },
        { index: 3, label: "Epic",   vram_delta_mb: 200, gpu_load_delta: 0.165, cpu_load_delta: 0.028, quality_score: 100, fps_multiplier: 0.838 },
      ],
    },

    // ── Effects ──────────────────────────────────────────────────────────────
    effects: {
      id: "effects",
      label: "Effects",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.008, quality_score: 22,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 25, gpu_load_delta: 0.030, cpu_load_delta: 0.018, quality_score: 52,  fps_multiplier: 0.968 },
        { index: 2, label: "High",   vram_delta_mb: 55, gpu_load_delta: 0.062, cpu_load_delta: 0.030, quality_score: 80,  fps_multiplier: 0.935 },
        { index: 3, label: "Epic",   vram_delta_mb: 95, gpu_load_delta: 0.100, cpu_load_delta: 0.045, quality_score: 100, fps_multiplier: 0.900 },
      ],
    },

    // ── Post-Processing ──────────────────────────────────────────────────────
    post_processing: {
      id: "post_processing",
      label: "Post-Processing",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 15, gpu_load_delta: 0.022, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.976 },
        { index: 2, label: "High",   vram_delta_mb: 30, gpu_load_delta: 0.045, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.952 },
        { index: 3, label: "Epic",   vram_delta_mb: 50, gpu_load_delta: 0.072, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.925 },
      ],
    },

    // ── View Distance ────────────────────────────────────────────────────────
    // Mostly a CPU-side draw-call cost; minor VRAM impact from extra LODs.
    view_distance: {
      id: "view_distance",
      label: "View Distance",
      category: "geometry",
      primary_resource: "CPU",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Near",   vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 30,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 20, gpu_load_delta: 0.008, cpu_load_delta: 0.025, quality_score: 60,  fps_multiplier: 0.972 },
        { index: 2, label: "Far",    vram_delta_mb: 45, gpu_load_delta: 0.018, cpu_load_delta: 0.045, quality_score: 85,  fps_multiplier: 0.945 },
        { index: 3, label: "Epic",   vram_delta_mb: 80, gpu_load_delta: 0.030, cpu_load_delta: 0.070, quality_score: 100, fps_multiplier: 0.915 },
      ],
    },

    // ── Anti-Aliasing & Super Resolution (TSR) ───────────────────────────────
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing & Super Resolution",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",        vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 10,  fps_multiplier: 1.000 },
        { index: 1, label: "TSR Medium", vram_delta_mb: 40,  gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 60,  fps_multiplier: 0.968 },
        { index: 2, label: "TSR High",   vram_delta_mb: 70,  gpu_load_delta: 0.058, cpu_load_delta: 0.000, quality_score: 88,  fps_multiplier: 0.940 },
        { index: 3, label: "TSR Epic",   vram_delta_mb: 110, gpu_load_delta: 0.090, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.910 },
      ],
    },
  },
};
