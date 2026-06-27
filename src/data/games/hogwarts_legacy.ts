import type { GameDefinition } from "../types";

/**
 * Hogwarts Legacy — Unreal Engine 4
 *
 * One of the most demanding open-world titles on PC at launch. Known for
 * extreme VRAM requirements at 1440p+ Ultra and severe CPU overhead in
 * Hogsmeade (hundreds of NPCs, dense asset streaming, physics).
 * The Unreal Engine 4 draw-call overhead makes it particularly sensitive
 * to CPU core performance in crowded outdoor areas.
 *
 * Baseline: compute_score=100 GPU, all-Low, 1080p → ~200 FPS
 * RTX 3060 (score=48): gpu_fps = 0.48 × 200 = 96 FPS at 1080p Low ✓ (GN: 90–105)
 * RTX 3060 + i5-12400F (score≈62) at 1080p Medium: ~72 FPS ✓ (benchmark 68–78)
 * RTX 3060 + i5-12400F at 1080p Ultra: ~50 FPS ✓ (benchmark 46–55)
 */
export const HOGWARTS_LEGACY: GameDefinition = {
  id: "hogwarts_legacy",
  label: "Hogwarts Legacy",
  engine: "Unreal Engine 4",
  base_vram_mb: 2800,
  gpu_baseline_fps: 200,
  cpu_baseline_fps: 135,
  cpu_weight: 0.65,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.52,
    "2160p": 2.25,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    // Hogwarts Legacy is notorious for VRAM consumption — the castle interior
    // and Hogsmeade textures alone can exceed 10 GB at Ultra + 1440p.
    texture_quality: {
      id: "texture_quality",
      label: "Texture Quality",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,    gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 800,  gpu_load_delta: 0.008, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.982 },
        { index: 2, label: "High",   vram_delta_mb: 2000, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.962 },
        { index: 3, label: "Ultra",  vram_delta_mb: 4000, gpu_load_delta: 0.032, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.935 },
      ],
    },

    // ── Shadow Quality ────────────────────────────────────────────────────────
    // Cascaded shadow maps across large castle + grounds areas.
    // "Ultra" increases cascade count and adds contact hardening shadows (PCSS).
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.012, quality_score: 15,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 80,  gpu_load_delta: 0.052, cpu_load_delta: 0.025, quality_score: 45,  fps_multiplier: 0.942 },
        { index: 2, label: "High",   vram_delta_mb: 200, gpu_load_delta: 0.112, cpu_load_delta: 0.048, quality_score: 75,  fps_multiplier: 0.875 },
        { index: 3, label: "Ultra",  vram_delta_mb: 390, gpu_load_delta: 0.202, cpu_load_delta: 0.082, quality_score: 100, fps_multiplier: 0.788 },
      ],
    },

    // ── View Distance ─────────────────────────────────────────────────────────
    // Controls actor LOD distances and scene streaming aggressiveness.
    // "Epic" in Hogsmeade can drop framerate by 30%+ vs "Near" due to UE4
    // draw-call overhead from the dense medieval architecture.
    view_distance: {
      id: "view_distance",
      label: "View Distance",
      category: "geometry",
      primary_resource: "CPU",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Near",   vram_delta_mb: 0,   gpu_load_delta: 0.010, cpu_load_delta: 0.020, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 100, gpu_load_delta: 0.028, cpu_load_delta: 0.060, quality_score: 48,  fps_multiplier: 0.955 },
        { index: 2, label: "Far",    vram_delta_mb: 225, gpu_load_delta: 0.060, cpu_load_delta: 0.115, quality_score: 78,  fps_multiplier: 0.898 },
        { index: 3, label: "Epic",   vram_delta_mb: 410, gpu_load_delta: 0.105, cpu_load_delta: 0.185, quality_score: 100, fps_multiplier: 0.825 },
      ],
    },

    // ── Foliage & Nature Quality ──────────────────────────────────────────────
    // The Forbidden Forest and Highlands areas have very dense grass/foliage.
    // A major contributor to both GPU load and CPU streaming overhead.
    foliage_quality: {
      id: "foliage_quality",
      label: "Foliage Quality",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.020, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 70,  gpu_load_delta: 0.035, cpu_load_delta: 0.042, quality_score: 48,  fps_multiplier: 0.958 },
        { index: 2, label: "High",   vram_delta_mb: 170, gpu_load_delta: 0.078, cpu_load_delta: 0.072, quality_score: 78,  fps_multiplier: 0.908 },
        { index: 3, label: "Ultra",  vram_delta_mb: 315, gpu_load_delta: 0.138, cpu_load_delta: 0.112, quality_score: 100, fps_multiplier: 0.842 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    // Very visible in Hogwarts' stone corridors and stairwells.
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Off",     vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "SSAO",    vram_delta_mb: 25, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 42,  fps_multiplier: 0.968 },
        { index: 2, label: "High",    vram_delta_mb: 52, gpu_load_delta: 0.060, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.932 },
        { index: 3, label: "Maximum", vram_delta_mb: 85, gpu_load_delta: 0.102, cpu_load_delta: 0.005, quality_score: 100, fps_multiplier: 0.888 },
      ],
    },

    // ── Anti-Aliasing ─────────────────────────────────────────────────────────
    // UE4's built-in TAA is the baseline; TSR (Temporal Super Resolution)
    // is the highest-quality native option in the UE4 build used here.
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Off",   vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "FXAA",  vram_delta_mb: 15, gpu_load_delta: 0.010, cpu_load_delta: 0.000, quality_score: 30,  fps_multiplier: 0.990 },
        { index: 2, label: "TAA",   vram_delta_mb: 30, gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 68,  fps_multiplier: 0.975 },
        { index: 3, label: "TSR",   vram_delta_mb: 55, gpu_load_delta: 0.055, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.948 },
      ],
    },

    // ── Effects Quality ───────────────────────────────────────────────────────
    // Spell visual effects, particle systems, environmental destruction.
    // Combat-heavy scenes with many spells are particularly GPU-intensive.
    effects_quality: {
      id: "effects_quality",
      label: "Effects Quality",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.018, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 40,  gpu_load_delta: 0.030, cpu_load_delta: 0.035, quality_score: 48,  fps_multiplier: 0.972 },
        { index: 2, label: "High",   vram_delta_mb: 92,  gpu_load_delta: 0.068, cpu_load_delta: 0.060, quality_score: 78,  fps_multiplier: 0.935 },
        { index: 3, label: "Ultra",  vram_delta_mb: 165, gpu_load_delta: 0.118, cpu_load_delta: 0.095, quality_score: 100, fps_multiplier: 0.888 },
      ],
    },

    // ── Ray Tracing ───────────────────────────────────────────────────────────
    // Limited RT implementation — adds ray-traced shadows in indoor areas.
    // Even "Low" RT roughly halves FPS on non-Ampere/RDNA3 hardware.
    ray_tracing: {
      id: "ray_tracing",
      label: "Ray Tracing",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Off",    vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",    vram_delta_mb: 30,  gpu_load_delta: 0.095, cpu_load_delta: 0.005, quality_score: 50,  fps_multiplier: 0.905 },
        { index: 2, label: "Medium", vram_delta_mb: 65,  gpu_load_delta: 0.188, cpu_load_delta: 0.010, quality_score: 80,  fps_multiplier: 0.820 },
        { index: 3, label: "High",   vram_delta_mb: 115, gpu_load_delta: 0.298, cpu_load_delta: 0.015, quality_score: 100, fps_multiplier: 0.718 },
      ],
    },

    // ── Post-Processing ───────────────────────────────────────────────────────
    // Depth of field, bloom, lens flares, and film grain.
    post_processing: {
      id: "post_processing",
      label: "Post-Processing",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 9,
      tiers: [
        { index: 0, label: "Low",    vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 10,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium", vram_delta_mb: 25, gpu_load_delta: 0.012, cpu_load_delta: 0.000, quality_score: 42,  fps_multiplier: 0.988 },
        { index: 2, label: "High",   vram_delta_mb: 55, gpu_load_delta: 0.028, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.972 },
        { index: 3, label: "Ultra",  vram_delta_mb: 92, gpu_load_delta: 0.052, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.950 },
      ],
    },
  },
};
