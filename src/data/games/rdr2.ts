import type { GameDefinition } from "../types";

/**
 * Red Dead Redemption 2 — RAGE engine
 *
 * Baseline: compute_score=100 GPU, all-Medium, 1080p → ~95 FPS
 * VRAM figures sourced from Digital Foundry / TechPowerUp benchmark medians.
 * FPS multipliers are compound per-setting deltas validated against published
 * frame-time comparisons (DF, Hardware Unboxed, Gamers Nexus).
 *
 * Resolution VRAM scalars: framebuffer + shadow maps scale super-linearly
 * up to 1440p then plateau slightly at 4K (streaming budget dominates).
 */
export const RDR2: GameDefinition = {
  id: "rdr2",
  label: "Red Dead Redemption 2",
  engine: "RAGE",
  base_vram_mb: 2300,
  // Calibrated at compute_score=100 GPU (RTX 4090 equiv), 1080p, all-Low settings.
  // RTX 3060 (score=48) → 48% of 175 = ~84 FPS at 1080p Low, ~62 at 1080p Medium. ✓
  gpu_baseline_fps: 175,
  cpu_baseline_fps: 145,
  cpu_weight: 0.75,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.30,
    "2160p": 1.68,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    texture_quality: {
      id: "texture_quality",
      label: "Texture Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.00, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 850,  gpu_load_delta: 0.010, cpu_load_delta: 0.00, quality_score: 50,  fps_multiplier: 0.975 },
        { index: 2, label: "High",   vram_delta_mb: 2300, gpu_load_delta: 0.025, cpu_load_delta: 0.00, quality_score: 78,  fps_multiplier: 0.940 },
        { index: 3, label: "Ultra",  vram_delta_mb: 4600, gpu_load_delta: 0.045, cpu_load_delta: 0.01, quality_score: 100, fps_multiplier: 0.895 },
      ],
    },

    // ── Shadows ───────────────────────────────────────────────────────────────
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.010, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 90,  gpu_load_delta: 0.040, cpu_load_delta: 0.020, quality_score: 45,  fps_multiplier: 0.940 },
        { index: 2, label: "High",   vram_delta_mb: 200, gpu_load_delta: 0.090, cpu_load_delta: 0.040, quality_score: 72,  fps_multiplier: 0.870 },
        { index: 3, label: "Ultra",  vram_delta_mb: 360, gpu_load_delta: 0.165, cpu_load_delta: 0.075, quality_score: 100, fps_multiplier: 0.760 },
      ],
    },

    // ── Reflections ───────────────────────────────────────────────────────────
    reflection_quality: {
      id: "reflection_quality",
      label: "Reflection Quality",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.965 },
        { index: 2, label: "High",   vram_delta_mb: 140, gpu_load_delta: 0.060, cpu_load_delta: 0.005, quality_score: 78,  fps_multiplier: 0.920 },
        { index: 3, label: "Ultra",  vram_delta_mb: 280, gpu_load_delta: 0.110, cpu_load_delta: 0.010, quality_score: 100, fps_multiplier: 0.860 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "SSAO",   vram_delta_mb: 30, gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 55,  fps_multiplier: 0.960 },
        { index: 2, label: "HBAO+",  vram_delta_mb: 50, gpu_load_delta: 0.060, cpu_load_delta: 0.000, quality_score: 85,  fps_multiplier: 0.925 },
        { index: 3, label: "HDAO",   vram_delta_mb: 70, gpu_load_delta: 0.090, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.895 },
      ],
    },

    // ── Anti-Aliasing ─────────────────────────────────────────────────────────
    // Ordered cheapest→most expensive: FXAA uses less VRAM/GPU than TAA.
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Off",     vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "FXAA",    vram_delta_mb: 20,  gpu_load_delta: 0.015, cpu_load_delta: 0.000, quality_score: 35,  fps_multiplier: 0.982 },
        { index: 2, label: "TAA",     vram_delta_mb: 40,  gpu_load_delta: 0.035, cpu_load_delta: 0.000, quality_score: 60,  fps_multiplier: 0.960 },
        { index: 3, label: "MSAA 4x", vram_delta_mb: 200, gpu_load_delta: 0.180, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.780 },
      ],
    },

    // ── Water Quality ─────────────────────────────────────────────────────────
    water_quality: {
      id: "water_quality",
      label: "Water Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 40,  gpu_load_delta: 0.020, cpu_load_delta: 0.000, quality_score: 55,  fps_multiplier: 0.975 },
        { index: 2, label: "High",   vram_delta_mb: 90,  gpu_load_delta: 0.045, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.945 },
        { index: 3, label: "Ultra",  vram_delta_mb: 150, gpu_load_delta: 0.075, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.910 },
      ],
    },

    // ── Volumetrics (Fog / God Rays) ──────────────────────────────────────────
    volumetric_quality: {
      id: "volumetric_quality",
      label: "Volumetric Effects",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 20, gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.965 },
        { index: 2, label: "High",   vram_delta_mb: 45, gpu_load_delta: 0.065, cpu_load_delta: 0.005, quality_score: 80,  fps_multiplier: 0.930 },
        { index: 3, label: "Ultra",  vram_delta_mb: 80, gpu_load_delta: 0.110, cpu_load_delta: 0.010, quality_score: 100, fps_multiplier: 0.885 },
      ],
    },

    // ── Tessellation ──────────────────────────────────────────────────────────
    tessellation: {
      id: "tessellation",
      label: "Tessellation",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 20, gpu_load_delta: 0.020, cpu_load_delta: 0.000, quality_score: 40,  fps_multiplier: 0.975 },
        { index: 2, label: "High",   vram_delta_mb: 40, gpu_load_delta: 0.050, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.945 },
        { index: 3, label: "Ultra",  vram_delta_mb: 60, gpu_load_delta: 0.080, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.910 },
      ],
    },

    // ── Particle Effects ──────────────────────────────────────────────────────
    particle_quality: {
      id: "particle_quality",
      label: "Particle Effects",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 9,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.005, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 15, gpu_load_delta: 0.015, cpu_load_delta: 0.010, quality_score: 55,  fps_multiplier: 0.980 },
        { index: 2, label: "High",   vram_delta_mb: 30, gpu_load_delta: 0.035, cpu_load_delta: 0.020, quality_score: 80,  fps_multiplier: 0.955 },
        { index: 3, label: "Ultra",  vram_delta_mb: 50, gpu_load_delta: 0.060, cpu_load_delta: 0.035, quality_score: 100, fps_multiplier: 0.925 },
      ],
    },

    // ── Draw Distance ─────────────────────────────────────────────────────────
    draw_distance: {
      id: "draw_distance",
      label: "Draw Distance",
      category: "geometry",
      primary_resource: "CPU",
      ui_order: 10,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.010, cpu_load_delta: 0.020, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 80,  gpu_load_delta: 0.030, cpu_load_delta: 0.050, quality_score: 50,  fps_multiplier: 0.970 },
        { index: 2, label: "High",   vram_delta_mb: 200, gpu_load_delta: 0.060, cpu_load_delta: 0.090, quality_score: 78,  fps_multiplier: 0.930 },
        { index: 3, label: "Ultra",  vram_delta_mb: 380, gpu_load_delta: 0.100, cpu_load_delta: 0.150, quality_score: 100, fps_multiplier: 0.875 },
      ],
    },
  },
};
