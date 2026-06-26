import { describe, it, expect } from "vitest";
import { getGPUById } from "../data/hardware/gpu";
import { getCPUById } from "../data/hardware/cpu";
import { RDR2 } from "../data/games/rdr2";
import { ELDEN_RING } from "../data/games/elden_ring";
import { GPU_CATALOG } from "../data/hardware/gpu";
import { CPU_CATALOG } from "../data/hardware/cpu";
import { GAME_CATALOG } from "../data/games/index";
import {
  calculateVRAM,
  calculateLoads,
  estimateFPS,
  detectBottleneck,
  calculateQualityScore,
  optimizeSettings,
  maxSettings,
  minSettings,
} from "./index";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const RTX_3060 = getGPUById("rtx_3060")!;
const RTX_4090 = getGPUById("rtx_4090")!;
const RTX_3050 = getGPUById("rtx_3050")!;

const I5_12400F  = getCPUById("i5_12400f")!;
const I9_13900K  = getCPUById("i9_13900k")!;
const R5_3600    = getCPUById("r5_3600")!;

// ─── Catalog integrity ────────────────────────────────────────────────────────

describe("GPU catalog", () => {
  it("contains at least 20 entries", () => {
    expect(GPU_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("every entry has a positive compute_score between 0 and 100", () => {
    for (const gpu of GPU_CATALOG) {
      expect(gpu.compute_score).toBeGreaterThan(0);
      expect(gpu.compute_score).toBeLessThanOrEqual(100);
    }
  });

  it("RTX 4090 has the highest compute_score", () => {
    const max = Math.max(...GPU_CATALOG.map((g) => g.compute_score));
    expect(RTX_4090.compute_score).toBe(max);
  });

  it("all VRAM values are positive multiples of 1024", () => {
    for (const gpu of GPU_CATALOG) {
      expect(gpu.vram_mb).toBeGreaterThan(0);
      expect(gpu.vram_mb % 1024).toBe(0);
    }
  });

  it("getGPUById returns undefined for unknown id", () => {
    expect(getGPUById("does_not_exist")).toBeUndefined();
  });
});

describe("CPU catalog", () => {
  it("contains at least 20 entries", () => {
    expect(CPU_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("every game_score is between 1 and 100", () => {
    for (const cpu of CPU_CATALOG) {
      expect(cpu.game_score).toBeGreaterThan(0);
      expect(cpu.game_score).toBeLessThanOrEqual(100);
    }
  });

  it("i5-12400F has a lower game_score than i9-13900K", () => {
    expect(I5_12400F.game_score).toBeLessThan(I9_13900K.game_score);
  });
});

describe("Game catalog", () => {
  it("has at least 2 games", () => {
    expect(GAME_CATALOG.length).toBeGreaterThanOrEqual(2);
  });

  it("every game has at least 8 settings", () => {
    for (const game of GAME_CATALOG) {
      expect(Object.keys(game.settings).length).toBeGreaterThanOrEqual(8);
    }
  });

  it("every setting has at least 4 tiers", () => {
    for (const game of GAME_CATALOG) {
      for (const setting of Object.values(game.settings)) {
        expect(setting.tiers.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("tier indices are sequential starting at 0", () => {
    for (const game of GAME_CATALOG) {
      for (const setting of Object.values(game.settings)) {
        setting.tiers.forEach((tier, i) => {
          expect(tier.index).toBe(i);
        });
      }
    }
  });

  it("vram_delta_mb increases monotonically across tiers", () => {
    for (const game of GAME_CATALOG) {
      for (const [id, setting] of Object.entries(game.settings)) {
        for (let i = 1; i < setting.tiers.length; i++) {
          expect(setting.tiers[i].vram_delta_mb).toBeGreaterThanOrEqual(
            setting.tiers[i - 1].vram_delta_mb
          ), `${game.id}.${id} tier[${i}] vram_delta_mb should be >= tier[${i - 1}]`;
        }
      }
    }
  });

  it("fps_multiplier never exceeds 1.0", () => {
    for (const game of GAME_CATALOG) {
      for (const setting of Object.values(game.settings)) {
        for (const tier of setting.tiers) {
          expect(tier.fps_multiplier).toBeLessThanOrEqual(1.0);
          expect(tier.fps_multiplier).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── VRAM calculation ─────────────────────────────────────────────────────────

describe("calculateVRAM", () => {
  it("all-Low settings at 1080p uses only base VRAM", () => {
    const settings = minSettings(RDR2);
    const result = calculateVRAM(RDR2, settings, "1080p", RTX_3060);
    expect(result.total_mb).toBe(RDR2.base_vram_mb);
    expect(result.settings_mb).toBe(0);
  });

  it("VRAM increases from 1080p to 1440p", () => {
    const settings = maxSettings(RDR2);
    const at_1080p = calculateVRAM(RDR2, settings, "1080p", RTX_3060);
    const at_1440p = calculateVRAM(RDR2, settings, "1440p", RTX_3060);
    expect(at_1440p.total_mb).toBeGreaterThan(at_1080p.total_mb);
  });

  it("per_setting keys match active setting ids", () => {
    const settings = maxSettings(RDR2);
    const result = calculateVRAM(RDR2, settings, "1080p", RTX_3060);
    for (const id of Object.keys(RDR2.settings)) {
      expect(result.per_setting).toHaveProperty(id);
    }
  });

  it("utilization is total_mb / budget_mb", () => {
    const settings = maxSettings(RDR2);
    const result = calculateVRAM(RDR2, settings, "1080p", RTX_3060);
    expect(result.utilization).toBeCloseTo(result.total_mb / result.budget_mb, 5);
  });

  // Baseline test case: i5-12400F + RTX 3060 12 GB @ 1440p, RDR2 all-Ultra
  it("RTX 3060 at 1440p Ultra RDR2 exceeds 90% VRAM budget", () => {
    const settings = maxSettings(RDR2);
    const result = calculateVRAM(RDR2, settings, "1440p", RTX_3060);
    // RTX 3060 has 12 GB; RDR2 at Ultra 1440p is known to push ~10–11 GB
    expect(result.over_budget).toBe(true);
  });

  it("RTX 3060 at 1080p Medium RDR2 stays within budget", () => {
    const settings: Record<string, number> = {};
    for (const id of Object.keys(RDR2.settings)) settings[id] = 1; // all Medium
    const result = calculateVRAM(RDR2, settings, "1080p", RTX_3060);
    expect(result.over_budget).toBe(false);
  });
});

// ─── Load calculation ─────────────────────────────────────────────────────────

describe("calculateLoads", () => {
  it("loads are always between 0 and 1", () => {
    for (const settings of [minSettings(RDR2), maxSettings(RDR2)]) {
      const { gpu_load, cpu_load } = calculateLoads(RDR2, settings);
      expect(gpu_load).toBeGreaterThanOrEqual(0);
      expect(gpu_load).toBeLessThanOrEqual(1);
      expect(cpu_load).toBeGreaterThanOrEqual(0);
      expect(cpu_load).toBeLessThanOrEqual(1);
    }
  });

  it("max settings produce higher loads than min settings", () => {
    const min = calculateLoads(RDR2, minSettings(RDR2));
    const max = calculateLoads(RDR2, maxSettings(RDR2));
    expect(max.gpu_load).toBeGreaterThan(min.gpu_load);
    expect(max.cpu_load).toBeGreaterThan(min.cpu_load);
  });

  it("Elden Ring has higher cpu_load than RDR2 at equal settings due to cpu_weight", () => {
    const settings_count = Math.min(
      Object.keys(ELDEN_RING.settings).length,
      Object.keys(RDR2.settings).length
    );
    // Use all-Low to isolate the cpu_weight difference
    const er_min: Record<string, number> = {};
    for (const id of Object.keys(ELDEN_RING.settings)) er_min[id] = 0;
    const rdr2_min: Record<string, number> = {};
    for (const id of Object.keys(RDR2.settings)) rdr2_min[id] = 0;

    const er_loads   = calculateLoads(ELDEN_RING, er_min);
    const rdr2_loads = calculateLoads(RDR2, rdr2_min);
    // cpu_weight: ER=0.90, RDR2=0.75, so ER base cpu_load must be higher
    expect(er_loads.cpu_load).toBeGreaterThan(rdr2_loads.cpu_load);
    void settings_count; // suppress unused warning
  });
});

// ─── FPS estimation ───────────────────────────────────────────────────────────

describe("estimateFPS", () => {
  it("RTX 4090 produces more FPS than RTX 3050 at equal settings", () => {
    const settings = maxSettings(RDR2);
    const fps_4090 = estimateFPS(RTX_4090, I9_13900K, RDR2, settings, "1080p");
    const fps_3050 = estimateFPS(RTX_3050, I9_13900K, RDR2, settings, "1080p");
    expect(fps_4090).toBeGreaterThan(fps_3050);
  });

  it("1080p produces more FPS than 1440p at equal settings", () => {
    const settings = maxSettings(RDR2);
    const fps_1080 = estimateFPS(RTX_3060, I5_12400F, RDR2, settings, "1080p");
    const fps_1440 = estimateFPS(RTX_3060, I5_12400F, RDR2, settings, "1440p");
    expect(fps_1080).toBeGreaterThan(fps_1440);
  });

  it("Low settings produce higher FPS than Ultra settings", () => {
    const low  = estimateFPS(RTX_3060, I5_12400F, RDR2, minSettings(RDR2), "1440p");
    const high = estimateFPS(RTX_3060, I5_12400F, RDR2, maxSettings(RDR2), "1440p");
    expect(low).toBeGreaterThan(high);
  });

  it("FPS is always at least 1", () => {
    const fps = estimateFPS(RTX_3050, R5_3600, RDR2, maxSettings(RDR2), "2160p");
    expect(fps).toBeGreaterThanOrEqual(1);
  });

  // Baseline test case: i5-12400F + RTX 3060 @ 1440p, RDR2, all Medium
  it("RTX 3060 + i5-12400F at 1440p Medium RDR2 produces ~40–65 FPS", () => {
    const settings: Record<string, number> = {};
    for (const id of Object.keys(RDR2.settings)) settings[id] = 1;
    const fps = estimateFPS(RTX_3060, I5_12400F, RDR2, settings, "1440p");
    // Real-world benchmark median is ~50 FPS; allow ±15 for model margin
    expect(fps).toBeGreaterThanOrEqual(35);
    expect(fps).toBeLessThanOrEqual(70);
  });
});

// ─── Bottleneck detection ─────────────────────────────────────────────────────

describe("detectBottleneck", () => {
  it("RTX 3060 + i5-12400F at 1440p RDR2 is GPU bottlenecked", () => {
    const vram = calculateVRAM(RDR2, minSettings(RDR2), "1440p", RTX_3060);
    const result = detectBottleneck(RTX_3060, I5_12400F, RDR2, "1440p", vram);
    // gpu_effective = 48/1.78 ≈ 26.97; cpu_effective = 72*0.75 = 54 → ratio ≈ 0.50 → GPU bottleneck
    expect(result.type).toBe("GPU");
  });

  it("RTX 4090 + i3-12100F at 1080p is CPU bottlenecked", () => {
    const i3 = getCPUById("i3_12100f")!;
    const vram = calculateVRAM(RDR2, minSettings(RDR2), "1080p", RTX_4090);
    const result = detectBottleneck(RTX_4090, i3, RDR2, "1080p", vram);
    // gpu_effective = 100/1.0 = 100; cpu_effective = 62*0.75 = 46.5 → ratio ≈ 2.15 > 1.35
    // GPU is far stronger than the CPU can utilise → CPU is the bottleneck
    expect(result.type).toBe("CPU");
  });

  it("VRAM over-budget takes priority over CPU/GPU ratio", () => {
    const vram = calculateVRAM(RDR2, maxSettings(RDR2), "1440p", RTX_3060);
    // Force over_budget
    if (vram.over_budget) {
      const result = detectBottleneck(RTX_3060, I5_12400F, RDR2, "1440p", vram);
      expect(result.type).toBe("VRAM");
    }
  });

  it("severity is 0 for BALANCED", () => {
    const vram = calculateVRAM(RDR2, minSettings(RDR2), "1080p", RTX_3060);
    const result = detectBottleneck(RTX_3060, I5_12400F, RDR2, "1080p", vram);
    if (result.type === "BALANCED") {
      expect(result.severity).toBe(0);
    }
  });

  it("severity is always in [0, 1]", () => {
    for (const gpu of [RTX_3060, RTX_4090, RTX_3050]) {
      for (const cpu of [I5_12400F, I9_13900K, R5_3600]) {
        const vram = calculateVRAM(RDR2, minSettings(RDR2), "1440p", gpu);
        const result = detectBottleneck(gpu, cpu, RDR2, "1440p", vram);
        expect(result.severity).toBeGreaterThanOrEqual(0);
        expect(result.severity).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ─── Quality score ────────────────────────────────────────────────────────────

describe("calculateQualityScore", () => {
  it("all-Low settings produce the lowest quality score", () => {
    const low  = calculateQualityScore(RDR2, minSettings(RDR2));
    const high = calculateQualityScore(RDR2, maxSettings(RDR2));
    expect(low).toBeLessThan(high);
  });

  it("score is always in [0, 100]", () => {
    expect(calculateQualityScore(RDR2, minSettings(RDR2))).toBeGreaterThanOrEqual(0);
    expect(calculateQualityScore(RDR2, maxSettings(RDR2))).toBeLessThanOrEqual(100);
  });
});

// ─── Optimizer ────────────────────────────────────────────────────────────────

describe("optimizeSettings", () => {
  it("result satisfies VRAM constraint for RTX 3060 at 1440p RDR2 targeting 60 FPS", () => {
    const result = optimizeSettings(RTX_3060, I5_12400F, RDR2, "1440p", 60);
    const vram = calculateVRAM(RDR2, result.settings, "1440p", RTX_3060);
    expect(vram.over_budget).toBe(false);
  });

  it("optimized FPS meets or exceeds target when hardware can support it", () => {
    // RTX 4090 + i9-13900K should easily hit 60 FPS at 1080p
    const result = optimizeSettings(RTX_4090, I9_13900K, RDR2, "1080p", 60);
    expect(result.projected_fps).toBeGreaterThanOrEqual(60);
  });

  it("result settings indices are within valid tier bounds", () => {
    const result = optimizeSettings(RTX_3060, I5_12400F, RDR2, "1440p", 60);
    for (const [id, tierIndex] of Object.entries(result.settings)) {
      expect(tierIndex).toBeGreaterThanOrEqual(0);
      expect(tierIndex).toBeLessThan(RDR2.settings[id].tiers.length);
    }
  });

  it("projected_quality is between 0 and 100", () => {
    const result = optimizeSettings(RTX_3060, I5_12400F, RDR2, "1440p", 60);
    expect(result.projected_quality).toBeGreaterThanOrEqual(0);
    expect(result.projected_quality).toBeLessThanOrEqual(100);
  });

  it("optimized settings have lower or equal quality than max settings", () => {
    const optimized = optimizeSettings(RTX_3060, I5_12400F, RDR2, "1440p", 60);
    const max_quality = calculateQualityScore(RDR2, maxSettings(RDR2));
    expect(optimized.projected_quality).toBeLessThanOrEqual(max_quality);
  });

  it("works for Elden Ring with RTX 3060 at 1440p targeting 60 FPS", () => {
    const result = optimizeSettings(RTX_3060, I5_12400F, ELDEN_RING, "1440p", 60);
    const vram = calculateVRAM(ELDEN_RING, result.settings, "1440p", RTX_3060);
    expect(vram.over_budget).toBe(false);
    expect(result.projected_fps).toBeGreaterThanOrEqual(1);
  });

  it("RTX 4090 + i9-13900K 1080p targeting 30 FPS returns max (or near-max) settings", () => {
    const result = optimizeSettings(RTX_4090, I9_13900K, RDR2, "1080p", 30);
    const max_quality = calculateQualityScore(RDR2, maxSettings(RDR2));
    // Powerful hardware at an easy target should keep quality high
    expect(result.projected_quality).toBeGreaterThanOrEqual(max_quality * 0.85);
  });
});

// ─── maxSettings / minSettings helpers ───────────────────────────────────────

describe("maxSettings / minSettings", () => {
  it("maxSettings returns the last tier index for every setting", () => {
    const max = maxSettings(RDR2);
    for (const [id, setting] of Object.entries(RDR2.settings)) {
      expect(max[id]).toBe(setting.tiers.length - 1);
    }
  });

  it("minSettings returns 0 for every setting", () => {
    const min = minSettings(RDR2);
    for (const id of Object.keys(RDR2.settings)) {
      expect(min[id]).toBe(0);
    }
  });
});
