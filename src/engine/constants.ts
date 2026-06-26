import type { Resolution } from "../data/types";

export const RESOLUTION_CONFIG: Record<Resolution, { pixel_scalar: number; label: string }> = {
  "1080p": { pixel_scalar: 1.00, label: "1080p FHD" },
  "1440p": { pixel_scalar: 1.78, label: "1440p QHD" },
  "2160p": { pixel_scalar: 4.00, label: "4K UHD"   },
};

/**
 * FPS scaling factors per resolution, separate from the VRAM pixel-count scalar.
 * Real GPUs don't lose FPS proportional to pixel count — bandwidth and compute
 * bound transitions mean the actual FPS drop from 1080p→1440p is ~30–38%, not 78%.
 */
export const RESOLUTION_FPS_CONFIG: Record<Resolution, { fps_scalar: number }> = {
  "1080p": { fps_scalar: 1.00 },
  "1440p": { fps_scalar: 1.35 },
  "2160p": { fps_scalar: 2.30 },
};

/** GPU load fraction treated as base engine + OS overhead before any settings */
export const GPU_BASE_LOAD = 0.35;

/** CPU base load fraction relative to game's cpu_weight */
export const CPU_BASE_LOAD_FACTOR = 0.30;

/** VRAM safety ceiling — warn/flag above this fraction of GPU VRAM */
export const VRAM_SAFETY_THRESHOLD = 0.90;

/** Bottleneck ratio below this → CPU bottleneck */
export const BOTTLENECK_CPU_RATIO = 0.75;

/** Bottleneck ratio above this → GPU bottleneck */
export const BOTTLENECK_GPU_RATIO = 1.35;
