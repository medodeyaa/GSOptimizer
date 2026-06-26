import type { GameDefinition } from "../types";

/**
 * VALORANT — Unreal Engine 4 (heavily modified)
 *
 * Designed to run on almost anything; even iGPUs clear 100+ FPS. At the high
 * end it is overwhelmingly CPU/engine-bound — competitive players on a 4090
 * still see frames capped by the single-thread render path, not the GPU.
 * VRAM footprint is tiny and the settings barely move the needle on FPS,
 * which is exactly what makes it a good low-end / high-refresh title.
 *
 * Tiers are modelled with four steps for a uniform UI even where the in-game
 * control is coarser — intermediate steps interpolate intensity.
 *
 * Baseline: compute_score=100 GPU, all-Medium, 1080p → ~700 FPS (GPU ceiling)
 * cpu_baseline_fps=600 makes the CPU the realistic limiter at high refresh.
 */
export const VALORANT: GameDefinition = {
  id: "valorant",
  label: "VALORANT",
  engine: "Unreal Engine 4",
  base_vram_mb: 600,
  gpu_baseline_fps: 700,
  cpu_baseline_fps: 600,
  cpu_weight: 0.70,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.15,
    "2160p": 1.35,
  },
  settings: {

    // ── Material Quality ─────────────────────────────────────────────────────
    material_quality: {
      id: "material_quality",
      label: "Material Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 25,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 55,  fps_multiplier: 0.993 },
        { index: 2, label: "High",   vram_delta_mb: 130, gpu_load_delta: 0.016, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.984 },
        { index: 3, label: "Ultra",  vram_delta_mb: 220, gpu_load_delta: 0.026, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.974 },
      ],
    },

    // ── Texture Quality ──────────────────────────────────────────────────────
    texture_quality: {
      id: "texture_quality",
      label: "Texture Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 25,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 80,  gpu_load_delta: 0.006, cpu_load_delta: 0.000, quality_score: 55,  fps_multiplier: 0.994 },
        { index: 2, label: "High",   vram_delta_mb: 180, gpu_load_delta: 0.013, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.986 },
        { index: 3, label: "Ultra",  vram_delta_mb: 300, gpu_load_delta: 0.022, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.978 },
      ],
    },

    // ── Detail Quality ───────────────────────────────────────────────────────
    detail_quality: {
      id: "detail_quality",
      label: "Detail Quality",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.006, quality_score: 25,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 15, gpu_load_delta: 0.012, cpu_load_delta: 0.012, quality_score: 55,  fps_multiplier: 0.986 },
        { index: 2, label: "High",   vram_delta_mb: 32, gpu_load_delta: 0.026, cpu_load_delta: 0.018, quality_score: 80,  fps_multiplier: 0.972 },
        { index: 3, label: "Ultra",  vram_delta_mb: 52, gpu_load_delta: 0.042, cpu_load_delta: 0.026, quality_score: 100, fps_multiplier: 0.956 },
      ],
    },

    // ── Detail Shadows ───────────────────────────────────────────────────────
    // Competitive players keep this Off; minimal FPS gain but cleaner sightlines.
    detail_shadows: {
      id: "detail_shadows",
      label: "Detail Shadows",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 22, gpu_load_delta: 0.024, cpu_load_delta: 0.008, quality_score: 50,  fps_multiplier: 0.966 },
        { index: 2, label: "High",   vram_delta_mb: 45, gpu_load_delta: 0.046, cpu_load_delta: 0.012, quality_score: 78,  fps_multiplier: 0.938 },
        { index: 3, label: "Ultra",  vram_delta_mb: 72, gpu_load_delta: 0.070, cpu_load_delta: 0.016, quality_score: 100, fps_multiplier: 0.908 },
      ],
    },

    // ── Anti-Aliasing ────────────────────────────────────────────────────────
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "None",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "MSAA 2x", vram_delta_mb: 50,  gpu_load_delta: 0.040, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.955 },
        { index: 2, label: "MSAA 4x", vram_delta_mb: 110, gpu_load_delta: 0.085, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.905 },
        { index: 3, label: "MSAA 8x", vram_delta_mb: 210, gpu_load_delta: 0.150, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.835 },
      ],
    },

    // ── Bloom ────────────────────────────────────────────────────────────────
    bloom: {
      id: "bloom",
      label: "Bloom",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 8,  gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.992 },
        { index: 2, label: "Medium", vram_delta_mb: 16, gpu_load_delta: 0.016, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.984 },
        { index: 3, label: "High",   vram_delta_mb: 26, gpu_load_delta: 0.026, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.974 },
      ],
    },

    // ── Distortion ───────────────────────────────────────────────────────────
    distortion: {
      id: "distortion",
      label: "Distortion",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 6,  gpu_load_delta: 0.010, cpu_load_delta: 0.004, quality_score: 45,  fps_multiplier: 0.990 },
        { index: 2, label: "Medium", vram_delta_mb: 14, gpu_load_delta: 0.020, cpu_load_delta: 0.008, quality_score: 75,  fps_multiplier: 0.980 },
        { index: 3, label: "High",   vram_delta_mb: 24, gpu_load_delta: 0.032, cpu_load_delta: 0.012, quality_score: 100, fps_multiplier: 0.968 },
      ],
    },

    // ── Anisotropic Filtering ────────────────────────────────────────────────
    anisotropic_filtering: {
      id: "anisotropic_filtering",
      label: "Anisotropic Filtering",
      category: "texture",
      primary_resource: "BANDWIDTH",
      ui_order: 8,
      tiers: [
        { index: 0, label: "1x",  vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 25,  fps_multiplier: 1.000 },
        { index: 1, label: "2x",  vram_delta_mb: 5,  gpu_load_delta: 0.006, cpu_load_delta: 0.000, quality_score: 55,  fps_multiplier: 0.995 },
        { index: 2, label: "8x",  vram_delta_mb: 14, gpu_load_delta: 0.014, cpu_load_delta: 0.000, quality_score: 82,  fps_multiplier: 0.989 },
        { index: 3, label: "16x", vram_delta_mb: 24, gpu_load_delta: 0.024, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.982 },
      ],
    },
  },
};
