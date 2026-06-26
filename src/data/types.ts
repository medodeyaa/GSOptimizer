// ─── Hardware ───────────────────────────────────────────────────────────────

export type GPUBrand = "nvidia" | "amd" | "intel";
export type CPUBrand = "intel" | "amd";
export type Resolution = "1080p" | "1440p" | "2160p";
export type TargetFPS = 30 | 60 | 90 | 120 | 144;
export type RAMType = "DDR4" | "DDR5";

export interface GPU {
  id: string;
  brand: GPUBrand;
  label: string;
  vram_mb: number;
  memory_bandwidth_gbps: number;
  /** 0–100 normalized vs RTX 4090 */
  compute_score: number;
  /** Rasterization-specific score (slightly different from compute) */
  raster_score: number;
  architecture: string;
  released_year: number;
}

export interface CPU {
  id: string;
  brand: CPUBrand;
  label: string;
  cores_physical: number;
  cores_logical: number;
  base_clock_ghz: number;
  boost_clock_ghz: number;
  /** Generation-adjusted IPC tier 1–10 */
  ipc_tier: number;
  /**
   * Composite 0–100 gaming score.
   * Formula: clamp((ipc_tier × 8) + (boost_clock_ghz × 6) + (cores_physical × 2.5), 0, 100)
   */
  game_score: number;
}

// ─── Game Settings ────────────────────────────────────────────────────────────

export type SettingCategory =
  | "texture"
  | "shadow"
  | "geometry"
  | "effects"
  | "lighting"
  | "antialiasing"
  | "postprocess";

export type PrimaryResource = "VRAM" | "GPU_COMPUTE" | "CPU" | "BANDWIDTH";

export interface QualityTier {
  index: number;
  label: string;
  /** VRAM added (MB) relative to tier[0] at 1080p; scaled by game's resolution_vram_scalars */
  vram_delta_mb: number;
  /** Percentage points added to GPU load (0.0–1.0) */
  gpu_load_delta: number;
  /** Percentage points added to CPU load (0.0–1.0) */
  cpu_load_delta: number;
  /** Visual quality contribution 0–100 */
  quality_score: number;
  /** Compound FPS multiplier: 1.0 = no change, 0.85 = 15% slower */
  fps_multiplier: number;
}

export interface SettingDefinition {
  id: string;
  label: string;
  category: SettingCategory;
  primary_resource: PrimaryResource;
  /** Lower = shown first in UI */
  ui_order: number;
  tiers: QualityTier[];
}

export interface GameDefinition {
  id: string;
  label: string;
  engine: string;
  /** OS + engine baseline VRAM at 1080p (MB) */
  base_vram_mb: number;
  /** GPU FPS at compute_score=100, 1080p, all-Medium settings */
  gpu_baseline_fps: number;
  /** Absolute max FPS the engine can produce (CPU perfection ceiling) */
  cpu_baseline_fps: number;
  /** 0–1: how strongly this game utilises the CPU */
  cpu_weight: number;
  resolution_vram_scalars: Record<Resolution, number>;
  settings: Record<string, SettingDefinition>;
}

// ─── Computed / Engine Output ─────────────────────────────────────────────────

export interface VRAMResult {
  base_mb: number;
  settings_mb: number;
  total_mb: number;
  budget_mb: number;
  per_setting: Record<string, number>;
  utilization: number;
  over_budget: boolean;
}

export interface LoadResult {
  gpu_load: number;
  cpu_load: number;
}

export type BottleneckType = "CPU" | "GPU" | "VRAM" | "BALANCED";

export interface BottleneckResult {
  type: BottleneckType;
  severity: number;
  ratio: number;
  label: string;
}

export interface ComputedMetrics {
  vram: VRAMResult;
  loads: LoadResult;
  estimated_fps: number;
  quality_score: number;
  bottleneck: BottleneckResult;
}

export interface OptimizationResult {
  settings: Record<string, number>;
  projected_fps: number;
  projected_quality: number;
}
