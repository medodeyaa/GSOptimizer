import type { GameDefinition } from "../types";

/**
 * The Witcher 3: Wild Hunt (Next Gen update) — REDengine 3
 *
 * The 2022 Next Gen update added ray tracing, reworked hair, and new shaders.
 * Open-world areas (Novigrad, Velen) stress both CPU (NPC pathfinding, physics)
 * and GPU (dense vegetation, distant LODs). Kaer Morhen is GPU-bound;
 * Novigrad marketplaces can be CPU-bound on 4-core/8-thread CPUs.
 *
 * Baseline: compute_score=100 GPU, all-Low, 1080p → ~310 FPS
 * RTX 3060 (score=48): 0.48 × 310 = 148.8 FPS at 1080p Low ✓ (GN: 140–155)
 * RTX 3060 + i5-12400F at 1080p Medium: ~110 FPS ✓ (benchmark median 105–115)
 * RTX 3060 + i5-12400F at 1080p Ultra:  ~88 FPS ✓  (benchmark median 85–92)
 */
export const WITCHER_3: GameDefinition = {
  id: "witcher3",
  label: "The Witcher 3: Wild Hunt",
  engine: "REDengine 3 (Next Gen)",
  base_vram_mb: 1900,
  gpu_baseline_fps: 310,
  cpu_baseline_fps: 250,
  cpu_weight: 0.48,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.30,
    "2160p": 1.72,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    // The Next Gen update ships with higher-resolution texture packs.
    // Ultra textures add ~3 GB vs Low at 1080p — very visible at close range.
    texture_quality: {
      id: "texture_quality",
      label: "Texture Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 700,  gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.980 },
        { index: 2, label: "High",  vram_delta_mb: 1800, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.960 },
        { index: 3, label: "Ultra", vram_delta_mb: 3200, gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.935 },
      ],
    },

    // ── Shadow Quality ────────────────────────────────────────────────────────
    // REDengine 3 uses cascaded shadow maps. Ultra triples cascade resolution
    // and adds actor-distance shadows — very costly on wooded areas.
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.012, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 70,  gpu_load_delta: 0.048, cpu_load_delta: 0.025, quality_score: 45,  fps_multiplier: 0.942 },
        { index: 2, label: "High",  vram_delta_mb: 175, gpu_load_delta: 0.105, cpu_load_delta: 0.048, quality_score: 75,  fps_multiplier: 0.872 },
        { index: 3, label: "Ultra", vram_delta_mb: 325, gpu_load_delta: 0.185, cpu_load_delta: 0.080, quality_score: 100, fps_multiplier: 0.785 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    // HBAO+ is the highest-tier option since the Next Gen update.
    // Very visible in the game's dense forest scenes.
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "SSAO",   vram_delta_mb: 25, gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 48,  fps_multiplier: 0.970 },
        { index: 2, label: "HBAO",   vram_delta_mb: 50, gpu_load_delta: 0.065, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.935 },
        { index: 3, label: "HBAO+",  vram_delta_mb: 80, gpu_load_delta: 0.108, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.892 },
      ],
    },

    // ── Foliage Visibility Range ──────────────────────────────────────────────
    // Controls how far grass and shrubs are rendered. Highest single CPU-cost
    // setting due to draw-call overhead per blade/cluster.
    foliage_visibility: {
      id: "foliage_visibility",
      label: "Foliage Visibility",
      category: "geometry",
      primary_resource: "CPU",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,   gpu_load_delta: 0.008, cpu_load_delta: 0.025, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 60,  gpu_load_delta: 0.028, cpu_load_delta: 0.065, quality_score: 50,  fps_multiplier: 0.960 },
        { index: 2, label: "High",  vram_delta_mb: 145, gpu_load_delta: 0.060, cpu_load_delta: 0.115, quality_score: 78,  fps_multiplier: 0.912 },
        { index: 3, label: "Ultra", vram_delta_mb: 260, gpu_load_delta: 0.105, cpu_load_delta: 0.175, quality_score: 100, fps_multiplier: 0.852 },
      ],
    },

    // ── Grass Density ─────────────────────────────────────────────────────────
    // Separate from foliage visibility — controls blade density per unit area.
    // Very impactful in Velen's swamplands.
    grass_density: {
      id: "grass_density",
      label: "Grass Density",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.015, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 30,  gpu_load_delta: 0.028, cpu_load_delta: 0.030, quality_score: 50,  fps_multiplier: 0.972 },
        { index: 2, label: "High",  vram_delta_mb: 70,  gpu_load_delta: 0.062, cpu_load_delta: 0.055, quality_score: 78,  fps_multiplier: 0.938 },
        { index: 3, label: "Ultra", vram_delta_mb: 135, gpu_load_delta: 0.112, cpu_load_delta: 0.090, quality_score: 100, fps_multiplier: 0.892 },
      ],
    },

    // ── Water Quality ─────────────────────────────────────────────────────────
    // Affects river/ocean tessellation, caustics, and SSR on water surfaces.
    water_quality: {
      id: "water_quality",
      label: "Water Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 35,  gpu_load_delta: 0.022, cpu_load_delta: 0.000, quality_score: 52,  fps_multiplier: 0.978 },
        { index: 2, label: "High",  vram_delta_mb: 75,  gpu_load_delta: 0.050, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.950 },
        { index: 3, label: "Ultra", vram_delta_mb: 135, gpu_load_delta: 0.088, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.912 },
      ],
    },

    // ── Terrain Quality ───────────────────────────────────────────────────────
    terrain_quality: {
      id: "terrain_quality",
      label: "Terrain Quality",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.010, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 45,  gpu_load_delta: 0.020, cpu_load_delta: 0.018, quality_score: 50,  fps_multiplier: 0.978 },
        { index: 2, label: "High",  vram_delta_mb: 95,  gpu_load_delta: 0.045, cpu_load_delta: 0.030, quality_score: 78,  fps_multiplier: 0.952 },
        { index: 3, label: "Ultra", vram_delta_mb: 165, gpu_load_delta: 0.080, cpu_load_delta: 0.048, quality_score: 100, fps_multiplier: 0.918 },
      ],
    },

    // ── Anti-Aliasing ─────────────────────────────────────────────────────────
    // Next Gen update adds a new TAA+ pass with better temporal stability.
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",     vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "FXAA",    vram_delta_mb: 15, gpu_load_delta: 0.010, cpu_load_delta: 0.000, quality_score: 30,  fps_multiplier: 0.990 },
        { index: 2, label: "TAA",     vram_delta_mb: 35, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 68,  fps_multiplier: 0.972 },
        { index: 3, label: "TAA+",    vram_delta_mb: 55, gpu_load_delta: 0.052, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.948 },
      ],
    },

    // ── Effects Quality ───────────────────────────────────────────────────────
    // Spell particles, fire, blood, and weather effects.
    effects_quality: {
      id: "effects_quality",
      label: "Effects Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 9,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.015, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 25, gpu_load_delta: 0.020, cpu_load_delta: 0.025, quality_score: 50,  fps_multiplier: 0.982 },
        { index: 2, label: "High",  vram_delta_mb: 55, gpu_load_delta: 0.045, cpu_load_delta: 0.042, quality_score: 78,  fps_multiplier: 0.960 },
        { index: 3, label: "Ultra", vram_delta_mb: 95, gpu_load_delta: 0.078, cpu_load_delta: 0.065, quality_score: 100, fps_multiplier: 0.930 },
      ],
    },

    // ── Post-Processing ───────────────────────────────────────────────────────
    // Colour grading, depth of field, lens flares, and chromatic aberration.
    post_processing: {
      id: "post_processing",
      label: "Post-Processing",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 10,
      tiers: [
        { index: 0, label: "Low",   vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 10,  fps_multiplier: 1.000 },
        { index: 1, label: "Med",   vram_delta_mb: 20, gpu_load_delta: 0.012, cpu_load_delta: 0.000, quality_score: 42,  fps_multiplier: 0.988 },
        { index: 2, label: "High",  vram_delta_mb: 45, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.972 },
        { index: 3, label: "Ultra", vram_delta_mb: 75, gpu_load_delta: 0.050, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.950 },
      ],
    },
  },
};
