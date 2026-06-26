import type { GameDefinition } from "../types";

/**
 * Elden Ring — Havok / FromSoftware in-house engine
 *
 * Characteristics vs RDR2:
 *   - Higher cpu_weight: the engine is notoriously CPU-bound at high draw
 *     distances (open-world streaming, NPC AI, physics).
 *   - Lower gpu_baseline_fps at equivalent GPU: engine is less GPU-efficient
 *     than RAGE (DX12 overhead on Nvidia, driver bottlenecks on AMD RDNA2).
 *   - Textures consume less VRAM than RDR2 (lower resolution asset pack).
 *   - Shadow maps are extremely CPU-heavy due to cascaded shadow map count.
 *   - Anti-aliasing options are limited (TAA-only without mods), reflected
 *     in fewer viable tiers.
 *
 * VRAM and FPS figures sourced from Digital Foundry, Gamers Nexus, and
 * aggregated community benchmark threads (PC Gaming Wiki, Reddit r/PCGaming).
 */
export const ELDEN_RING: GameDefinition = {
  id: "elden_ring",
  label: "Elden Ring",
  engine: "Havok / From Engine",
  base_vram_mb: 1800,
  // Calibrated at compute_score=100 GPU, 1080p, all-Low settings.
  // RTX 3060 (score=48) → ~67 FPS at 1080p Low, ~50 at 1080p Medium. ✓
  gpu_baseline_fps: 140,
  cpu_baseline_fps: 110,
  cpu_weight: 0.90,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.28,
    "2160p": 1.62,
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
        { index: 0, label: "Low",    vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.00, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 600,  gpu_load_delta: 0.008, cpu_load_delta: 0.00, quality_score: 52,  fps_multiplier: 0.980 },
        { index: 2, label: "High",   vram_delta_mb: 1600, gpu_load_delta: 0.018, cpu_load_delta: 0.00, quality_score: 78,  fps_multiplier: 0.960 },
        { index: 3, label: "Maximum", vram_delta_mb: 3000, gpu_load_delta: 0.030, cpu_load_delta: 0.00, quality_score: 100, fps_multiplier: 0.935 },
      ],
    },

    // ── Shadow Quality ────────────────────────────────────────────────────────
    // Cascaded shadow maps; each step roughly doubles cascade count.
    // CPU impact is very high — FromSoft's shadow renderer is single-threaded.
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "CPU",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.010, cpu_load_delta: 0.040, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.040, cpu_load_delta: 0.090, quality_score: 50,  fps_multiplier: 0.930 },
        { index: 2, label: "High",   vram_delta_mb: 140, gpu_load_delta: 0.085, cpu_load_delta: 0.160, quality_score: 78,  fps_multiplier: 0.855 },
        { index: 3, label: "Maximum", vram_delta_mb: 260, gpu_load_delta: 0.140, cpu_load_delta: 0.240, quality_score: 100, fps_multiplier: 0.770 },
      ],
    },

    // ── Lighting Quality ──────────────────────────────────────────────────────
    lighting_quality: {
      id: "lighting_quality",
      label: "Lighting Quality",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 40, gpu_load_delta: 0.030, cpu_load_delta: 0.005, quality_score: 48,  fps_multiplier: 0.965 },
        { index: 2, label: "High",   vram_delta_mb: 90, gpu_load_delta: 0.070, cpu_load_delta: 0.010, quality_score: 78,  fps_multiplier: 0.925 },
        { index: 3, label: "Maximum", vram_delta_mb: 160, gpu_load_delta: 0.120, cpu_load_delta: 0.015, quality_score: 100, fps_multiplier: 0.875 },
      ],
    },

    // ── Anti-Aliasing ─────────────────────────────────────────────────────────
    // Elden Ring supports TAA only natively; DLSS/FSR via mods not included.
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 20, gpu_load_delta: 0.020, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.975 },
        { index: 2, label: "High",   vram_delta_mb: 40, gpu_load_delta: 0.040, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.950 },
        { index: 3, label: "Maximum", vram_delta_mb: 80, gpu_load_delta: 0.080, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.910 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 20, gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.968 },
        { index: 2, label: "High",   vram_delta_mb: 45, gpu_load_delta: 0.055, cpu_load_delta: 0.000, quality_score: 82,  fps_multiplier: 0.935 },
        { index: 3, label: "Maximum", vram_delta_mb: 70, gpu_load_delta: 0.090, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.900 },
      ],
    },

    // ── Effects Quality (particle, volumetric combined) ───────────────────────
    effects_quality: {
      id: "effects_quality",
      label: "Effects Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.010, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 30, gpu_load_delta: 0.025, cpu_load_delta: 0.020, quality_score: 52,  fps_multiplier: 0.970 },
        { index: 2, label: "High",   vram_delta_mb: 65, gpu_load_delta: 0.055, cpu_load_delta: 0.035, quality_score: 78,  fps_multiplier: 0.938 },
        { index: 3, label: "Maximum", vram_delta_mb: 110, gpu_load_delta: 0.090, cpu_load_delta: 0.055, quality_score: 100, fps_multiplier: 0.900 },
      ],
    },

    // ── Grass & Foliage ───────────────────────────────────────────────────────
    // Open-world grass density is a major CPU/GPU split in the Limgrave areas.
    foliage_quality: {
      id: "foliage_quality",
      label: "Grass & Foliage",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.020, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 50,  gpu_load_delta: 0.030, cpu_load_delta: 0.040, quality_score: 52,  fps_multiplier: 0.960 },
        { index: 2, label: "High",   vram_delta_mb: 110, gpu_load_delta: 0.065, cpu_load_delta: 0.070, quality_score: 78,  fps_multiplier: 0.915 },
        { index: 3, label: "Maximum", vram_delta_mb: 200, gpu_load_delta: 0.110, cpu_load_delta: 0.110, quality_score: 100, fps_multiplier: 0.860 },
      ],
    },

    // ── Motion Blur ───────────────────────────────────────────────────────────
    motion_blur: {
      id: "motion_blur",
      label: "Motion Blur",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 10, gpu_load_delta: 0.010, cpu_load_delta: 0.000, quality_score: 40,  fps_multiplier: 0.988 },
        { index: 2, label: "High",   vram_delta_mb: 20, gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.972 },
        { index: 3, label: "Maximum", vram_delta_mb: 35, gpu_load_delta: 0.045, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.952 },
      ],
    },

    // ── Depth of Field ────────────────────────────────────────────────────────
    depth_of_field: {
      id: "depth_of_field",
      label: "Depth of Field",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 9,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 15, gpu_load_delta: 0.015, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.982 },
        { index: 2, label: "High",   vram_delta_mb: 30, gpu_load_delta: 0.035, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.960 },
        { index: 3, label: "Maximum", vram_delta_mb: 50, gpu_load_delta: 0.060, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.932 },
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
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.010, cpu_load_delta: 0.025, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.035, cpu_load_delta: 0.065, quality_score: 50,  fps_multiplier: 0.960 },
        { index: 2, label: "High",   vram_delta_mb: 150, gpu_load_delta: 0.070, cpu_load_delta: 0.115, quality_score: 78,  fps_multiplier: 0.912 },
        { index: 3, label: "Maximum", vram_delta_mb: 280, gpu_load_delta: 0.115, cpu_load_delta: 0.175, quality_score: 100, fps_multiplier: 0.852 },
      ],
    },
  },
};
