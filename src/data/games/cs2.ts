import type { GameDefinition } from "../types";

/**
 * Counter-Strike 2 — Source 2 engine
 *
 * Competitive FPS optimised for maximum frame rate. CS2 is uniquely CPU-bound
 * at high framerates (240-300+ FPS) — the Source 2 renderer, physics, and game
 * logic saturate a single CPU core well before the GPU runs out of work.
 * At typical 1080p/1440p competitive settings, mid-range CPUs become the limit.
 *
 * Baseline: compute_score=100 GPU, all-Low, 1080p → ~820 FPS (uncapped GPU
 * ceiling; the top cards are CPU/engine-limited well below this).
 * cpu_baseline_fps=600 is the realistic single-thread ceiling: a 13900K-class
 * CPU runs CS2 at ~600 FPS, an i5-12400F-class part at ~430. Recalibrated
 * against benchmark anchors — the old 520/350 capped the top end far too low.
 *
 * VRAM is very modest — Source 2 asset streaming is efficient.
 */
export const CS2: GameDefinition = {
  id: "cs2",
  label: "Counter-Strike 2",
  engine: "Source 2",
  base_vram_mb: 700,
  gpu_baseline_fps: 820,
  cpu_baseline_fps: 600,
  cpu_weight: 0.60,
  resolution_vram_scalars: {
    "1080p": 1.00,
    "1440p": 1.18,
    "2160p": 1.42,
  },
  settings: {

    // ── Textures ─────────────────────────────────────────────────────────────
    // Very minor FPS impact; competitive players often run High for visibility.
    texture_detail: {
      id: "texture_detail",
      label: "Texture Detail",
      category: "texture",
      primary_resource: "VRAM",
      ui_order: 1,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 18,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 200, gpu_load_delta: 0.006, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.990 },
        { index: 2, label: "High",      vram_delta_mb: 500, gpu_load_delta: 0.012, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.975 },
        { index: 3, label: "Very High", vram_delta_mb: 900, gpu_load_delta: 0.020, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.958 },
      ],
    },

    // ── Shader Detail ─────────────────────────────────────────────────────────
    // Affects material complexity — surface specularity, smoke interactions.
    // Competitive players keep this at Low or Medium to gain FPS.
    shader_detail: {
      id: "shader_detail",
      label: "Shader Detail",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 2,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 15, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.983 },
        { index: 2, label: "High",      vram_delta_mb: 30, gpu_load_delta: 0.038, cpu_load_delta: 0.000, quality_score: 78,  fps_multiplier: 0.962 },
        { index: 3, label: "Very High", vram_delta_mb: 45, gpu_load_delta: 0.062, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.935 },
      ],
    },

    // ── Shadow Quality ────────────────────────────────────────────────────────
    // The single highest-impact setting in CS2. High shadows are a significant
    // FPS drain — most professionals run Very Low or Low.
    shadow_quality: {
      id: "shadow_quality",
      label: "Shadow Quality",
      category: "shadow",
      primary_resource: "GPU_COMPUTE",
      ui_order: 3,
      tiers: [
        { index: 0, label: "Very Low", vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.005, quality_score: 10,  fps_multiplier: 1.000 },
        { index: 1, label: "Low",      vram_delta_mb: 20,  gpu_load_delta: 0.032, cpu_load_delta: 0.012, quality_score: 38,  fps_multiplier: 0.968 },
        { index: 2, label: "Medium",   vram_delta_mb: 55,  gpu_load_delta: 0.075, cpu_load_delta: 0.022, quality_score: 68,  fps_multiplier: 0.920 },
        { index: 3, label: "High",     vram_delta_mb: 120, gpu_load_delta: 0.148, cpu_load_delta: 0.038, quality_score: 100, fps_multiplier: 0.848 },
      ],
    },

    // ── Anti-Aliasing (MSAA) ──────────────────────────────────────────────────
    // MSAA in Source 2 is very expensive — it increases VRAM by up to ×4 for
    // the render target. 4×MSAA at 1080p + High textures can exhaust 8 GB cards.
    anti_aliasing: {
      id: "anti_aliasing",
      label: "Anti-Aliasing (MSAA)",
      category: "antialiasing",
      primary_resource: "GPU_COMPUTE",
      ui_order: 4,
      tiers: [
        { index: 0, label: "None",     vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "2× MSAA",  vram_delta_mb: 80,  gpu_load_delta: 0.075, cpu_load_delta: 0.000, quality_score: 50,  fps_multiplier: 0.920 },
        { index: 2, label: "4× MSAA",  vram_delta_mb: 180, gpu_load_delta: 0.165, cpu_load_delta: 0.000, quality_score: 82,  fps_multiplier: 0.822 },
        { index: 3, label: "8× MSAA",  vram_delta_mb: 360, gpu_load_delta: 0.280, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.700 },
      ],
    },

    // ── Ambient Occlusion ─────────────────────────────────────────────────────
    // HBAO+ adds visible contact shadows between props and floor. Barely
    // relevant for competitive play but noticeable in screenshot comparisons.
    ambient_occlusion: {
      id: "ambient_occlusion",
      label: "Ambient Occlusion",
      category: "lighting",
      primary_resource: "GPU_COMPUTE",
      ui_order: 5,
      tiers: [
        { index: 0, label: "Off",     vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 0,   fps_multiplier: 1.000 },
        { index: 1, label: "Low",     vram_delta_mb: 15, gpu_load_delta: 0.018, cpu_load_delta: 0.000, quality_score: 38,  fps_multiplier: 0.982 },
        { index: 2, label: "Medium",  vram_delta_mb: 30, gpu_load_delta: 0.040, cpu_load_delta: 0.000, quality_score: 70,  fps_multiplier: 0.960 },
        { index: 3, label: "HBAO+",   vram_delta_mb: 50, gpu_load_delta: 0.072, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.928 },
      ],
    },

    // ── Model / Prop Quality ──────────────────────────────────────────────────
    // Controls LOD thresholds for weapon models, environment props, and players.
    model_quality: {
      id: "model_quality",
      label: "Model Quality",
      category: "geometry",
      primary_resource: "GPU_COMPUTE",
      ui_order: 6,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,   gpu_load_delta: 0.000, cpu_load_delta: 0.008, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 30,  gpu_load_delta: 0.012, cpu_load_delta: 0.015, quality_score: 50,  fps_multiplier: 0.988 },
        { index: 2, label: "High",      vram_delta_mb: 65,  gpu_load_delta: 0.025, cpu_load_delta: 0.025, quality_score: 78,  fps_multiplier: 0.972 },
        { index: 3, label: "Very High", vram_delta_mb: 110, gpu_load_delta: 0.042, cpu_load_delta: 0.038, quality_score: 100, fps_multiplier: 0.950 },
      ],
    },

    // ── Particle Effects ──────────────────────────────────────────────────────
    // Smoke, flash, and explosion particles. Competitive players often disable
    // or minimise these to reduce visual clutter in clutch situations.
    particle_detail: {
      id: "particle_detail",
      label: "Particle Detail",
      category: "effects",
      primary_resource: "GPU_COMPUTE",
      ui_order: 7,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.010, quality_score: 20,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 10, gpu_load_delta: 0.012, cpu_load_delta: 0.018, quality_score: 50,  fps_multiplier: 0.988 },
        { index: 2, label: "High",      vram_delta_mb: 25, gpu_load_delta: 0.028, cpu_load_delta: 0.030, quality_score: 78,  fps_multiplier: 0.970 },
        { index: 3, label: "Very High", vram_delta_mb: 40, gpu_load_delta: 0.048, cpu_load_delta: 0.048, quality_score: 100, fps_multiplier: 0.948 },
      ],
    },

    // ── Post-Processing ───────────────────────────────────────────────────────
    // Colour grading, bloom, and lens effects. All competitive-minded players
    // disable these entirely for maximum clarity and frame rate.
    post_processing: {
      id: "post_processing",
      label: "Post-Processing",
      category: "postprocess",
      primary_resource: "GPU_COMPUTE",
      ui_order: 8,
      tiers: [
        { index: 0, label: "Low",       vram_delta_mb: 0,  gpu_load_delta: 0.000, cpu_load_delta: 0.000, quality_score: 10,  fps_multiplier: 1.000 },
        { index: 1, label: "Medium",    vram_delta_mb: 15, gpu_load_delta: 0.012, cpu_load_delta: 0.000, quality_score: 45,  fps_multiplier: 0.987 },
        { index: 2, label: "High",      vram_delta_mb: 28, gpu_load_delta: 0.025, cpu_load_delta: 0.000, quality_score: 75,  fps_multiplier: 0.973 },
        { index: 3, label: "Very High", vram_delta_mb: 45, gpu_load_delta: 0.042, cpu_load_delta: 0.000, quality_score: 100, fps_multiplier: 0.955 },
      ],
    },
  },
};
