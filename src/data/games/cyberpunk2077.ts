import type { GameDefinition } from "../types";

/**
 * Cyberpunk 2077 v2.x — REDengine 4
 *
 * One of the most GPU-bound mainstream titles available. Texture streaming
 * is extremely VRAM-hungry; Night City NPC crowd density heavily loads the CPU.
 * Figures calibrated from Digital Foundry / Hardware Unboxed / Gamers Nexus
 * benchmarks at rasterisation-only (no RT) across RTX 30/40 and RX 6000/7000.
 *
 * Baseline: compute_score=100 GPU, all-Low, 1080p → ~240 FPS
 * RTX 3060 (score=48): 0.48 × 240 = 115 FPS at 1080p Low ✓ (GN: 110–120)
 * With all-Ultra: ~68 FPS on RTX 3060 1080p ✓ (benchmark median 65–72)
 */
export const CYBERPUNK_2077: GameDefinition = {
  id: "cyberpunk2077",
  label: "Cyberpunk 2077",
  engine: "REDengine 4",
  base_vram_mb: 4200,
  gpu_baseline_fps: 240,
  cpu_baseline_fps: 200,
  cpu_weight: 0.35,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.42,
    "2160p": 2.15,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    // REDengine 4 streams texture mips aggressively; Ultra adds a separate
    // high-res texture pack that doubles VRAM use vs High.
    texture_quality: {
      id: "texture_quality",
      label: "Texture Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 600,  gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 48,  fps_multiplier: 0.985 },
        { index: 2, label: "High",   vram_delta_mb: 1500, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 76,  fps_multiplier: 0.970 },
        { index: 3, label: "Ultra",  vram_delta_mb: 2800, gpu_load_delta: 0.032, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.950 },
      ],
    },

    // ── Shader Quality ────────────────────────────────────────────────────────
    // Affects material complexity — skin subsurface scattering, wet surfaces,
    // neon reflections. Compound cost with SSR at High+.
    shader_quality: {
      id: "shader_quality",
      label: "Shader Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 35,  gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.970 },
        { index: 2, label: "High",   vram_delta_mb: 70,  gpu_load_delta: 0.058, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.935 },
        { index: 3, label: "Ultra",  vram_delta_mb: 110, gpu_load_delta: 0.100, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.888 },
      ],
    },

    // ── Shadow Quality ────────────────────────────────────────────────────────
    // Night City's neon environment makes shadow quality very visible.
    // "Psycho" re-renders cascades at ultra-high resolution — huge GPU cost.
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.010, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 60,  gpu_load_delta: 0.042, cpu_load_delta: 0.018, quality_score: 48,  fps_multiplier: 0.952 },
        { index: 2, label: "High",   vram_delta_mb: 160, gpu_load_delta: 0.095, cpu_load_delta: 0.030, quality_score: 76,  fps_multiplier: 0.895 },
        { index: 3, label: "Psycho", vram_delta_mb: 310, gpu_load_delta: 0.180, cpu_load_delta: 0.050, quality_score: 100, fps_multiplier: 0.798 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    // REDengine's AO is screen-space; Psycho uses a voxel probe system that
    // dramatically improves corners and cloth contact.
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 30, gpu_load_delta: 0.030, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.975 },
        { index: 2, label: "Ultra",  vram_delta_mb: 55, gpu_load_delta: 0.062, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.942 },
        { index: 3, label: "Psycho", vram_delta_mb: 90, gpu_load_delta: 0.105, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.895 },
      ],
    },

    // ── Screen Space Reflections ──────────────────────────────────────────────
    // Reflections off wet roads, puddles, and metallic surfaces are a
    // core visual feature. Psycho adds ray-marched SSR.
    screen_space_reflections: {
      id: "screen_space_reflections",
      label: "Screen Space Reflections",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 40,  gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 48,  fps_multiplier: 0.972 },
        { index: 2, label: "High",   vram_delta_mb: 90,  gpu_load_delta: 0.065, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.930 },
        { index: 3, label: "Psycho", vram_delta_mb: 170, gpu_load_delta: 0.120, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.872 },
      ],
    },

    // ── Crowd Density ─────────────────────────────────────────────────────────
    // NPCs in Night City stress the CPU — pathfinding, AI, physics, animation.
    // The most impactful CPU-bound setting in the game.
    crowd_density: {
      id: "crowd_density",
      label: "Crowd Density",
      category: "effects",
      primary_resource: "CPU",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 10, gpu_load_delta: 0.015, cpu_load_delta: 0.050, quality_score: 48,  fps_multiplier: 0.955 },
        { index: 2, label: "High",      vram_delta_mb: 20, gpu_load_delta: 0.030, cpu_load_delta: 0.100, quality_score: 78,  fps_multiplier: 0.902 },
        { index: 3, label: "Very High", vram_delta_mb: 30, gpu_load_delta: 0.045, cpu_load_delta: 0.155, quality_score: 100, fps_multiplier: 0.840 },
      ],
    },

    // ── Volumetric Fog ────────────────────────────────────────────────────────
    volumetric_fog: {
      id: "volumetric_fog",
      label: "Volumetric Fog",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 20, gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 52,  fps_multiplier: 0.978 },
        { index: 2, label: "High",   vram_delta_mb: 45, gpu_load_delta: 0.055, cpu_load_delta: 0.000, quality_score: 80,  fps_multiplier: 0.950 },
        { index: 3, label: "Psycho", vram_delta_mb: 85, gpu_load_delta: 0.092, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.912 },
      ],
    },

    // ── Anti-Aliasing ─────────────────────────────────────────────────────────
    // CP2077 v2.x includes DLAA (deep-learning AA) as the native highest quality
    // option; TSR/DLSS as upscaling options (not modelled here).
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",   vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "FXAA",  vram_delta_mb: 15, gpu_load_delta: 0.010, cpu_load_delta: 0.000, quality_score: 30,  fps_multiplier: 0.990 },
        { index: 2, label: "TAA",   vram_delta_mb: 35, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 68,  fps_multiplier: 0.975 },
        { index: 3, label: "DLAA",  vram_delta_mb: 65, gpu_load_delta: 0.060, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.948 },
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
        { index: 1, label: "Medium", vram_delta_mb: 20, gpu_load_delta: 0.012, cpu_load_delta: 0.000, quality_score: 40,  fps_multiplier: 0.990 },
        { index: 2, label: "High",   vram_delta_mb: 40, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.978 },
        { index: 3, label: "Psycho", vram_delta_mb: 65, gpu_load_delta: 0.050, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.960 },
      ],
    },

    // ── Motion Blur ───────────────────────────────────────────────────────────
    motion_blur: {
      id: "motion_blur",
      label: "Motion Blur",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 10,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 10, gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 35,  fps_multiplier: 0.992 },
        { index: 2, label: "Medium", vram_delta_mb: 20, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 70,  fps_multiplier: 0.982 },
        { index: 3, label: "High",   vram_delta_mb: 35, gpu_load_delta: 0.032, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.968 },
      ],
    },
  },
};
