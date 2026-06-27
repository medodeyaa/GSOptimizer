/**
 * accuracy.bench.test.ts — formula + data calibration harness (not pass/fail).
 *
 * 1. Compares estimateFPS against real-world benchmark anchors (raster only,
 *    no upscaling / no RT) and prints mean absolute percentage error (MAPE).
 * 2. Per-game, grid-searches the gpu_baseline_fps / cpu_baseline_fps that
 *    minimise that game's anchor error, so the game files can be recalibrated
 *    against data instead of by hand.
 *
 * Anchors are approximate medians aggregated from Hardware Unboxed / Gamers
 * Nexus / TechPowerUp. They exist to calibrate *relatively*; treat the fitted
 * numbers as recommendations, not ground truth.
 *
 * Run: npx vitest run src/engine/accuracy.bench.test.ts --disable-console-intercept
 */
import { describe, it } from "vitest";
import type { GameDefinition, Resolution } from "../data/types";
import { getGPUById } from "../data/hardware/gpu";
import { getCPUById } from "../data/hardware/cpu";
import { estimateFPS } from "./fps";
import { RDR2 } from "../data/games/rdr2";
import { CYBERPUNK_2077 } from "../data/games/cyberpunk2077";
import { WITCHER_3 } from "../data/games/witcher3";
import { HOGWARTS_LEGACY } from "../data/games/hogwarts_legacy";
import { CS2 } from "../data/games/cs2";
import { VALORANT } from "../data/games/valorant";
import { FORTNITE } from "../data/games/fortnite";

type Level = "low" | "medium" | "high" | "ultra";

function settingsAt(game: GameDefinition, level: Level): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, setting] of Object.entries(game.settings)) {
    const max = setting.tiers.length - 1;
    out[id] =
      level === "low" ? 0 :
      level === "medium" ? Math.min(1, max) :
      level === "high" ? Math.min(2, max) :
      max;
  }
  return out;
}

interface Anchor {
  game: GameDefinition; gpu: string; cpu: string;
  res: Resolution; level: Level; fps: number;
}
const G = (id: string) => getGPUById(id)!;
const C = (id: string) => getCPUById(id)!;

// ── Anchor table (approximate real-world medians, raster, no upscaling/RT) ──────
const ANCHORS: Anchor[] = [
  // ── Cyberpunk 2077 (REDengine 4, no RT) ─────────────────────────────────────
  { game: CYBERPUNK_2077, gpu: "rtx_4090",    cpu: "i9_13900k", res: "1080p", level: "low",   fps: 220 },
  { game: CYBERPUNK_2077, gpu: "rtx_4090",    cpu: "i9_13900k", res: "1080p", level: "ultra", fps: 165 },
  { game: CYBERPUNK_2077, gpu: "rtx_4070",    cpu: "i9_13900k", res: "1080p", level: "ultra", fps: 108 },
  { game: CYBERPUNK_2077, gpu: "rtx_4070",    cpu: "i9_13900k", res: "1440p", level: "ultra", fps: 95  },
  { game: CYBERPUNK_2077, gpu: "rtx_4060",    cpu: "i9_13900k", res: "1080p", level: "ultra", fps: 80  },
  { game: CYBERPUNK_2077, gpu: "rtx_3060",    cpu: "i5_12400f", res: "1080p", level: "ultra", fps: 68  },
  { game: CYBERPUNK_2077, gpu: "rtx_3060",    cpu: "i5_12400f", res: "1080p", level: "low",   fps: 115 },
  { game: CYBERPUNK_2077, gpu: "rx_7900_xtx", cpu: "r7_7800x3d",res: "1440p", level: "ultra", fps: 135 },

  // ── RDR2 (Vulkan) ───────────────────────────────────────────────────────────
  { game: RDR2, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "low",    fps: 150 },
  { game: RDR2, gpu: "rtx_4090", cpu: "i9_13900k", res: "1440p", level: "ultra",  fps: 130 },
  { game: RDR2, gpu: "rtx_4070", cpu: "i9_13900k", res: "1440p", level: "ultra",  fps: 85  },
  { game: RDR2, gpu: "rtx_3060", cpu: "i5_12400f", res: "1440p", level: "medium", fps: 50  },
  { game: RDR2, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "ultra",  fps: 62  },
  { game: RDR2, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "low",    fps: 95  },

  // ── Witcher 3 (classic engine, no RT) ───────────────────────────────────────
  { game: WITCHER_3, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "ultra", fps: 200 },
  { game: WITCHER_3, gpu: "rtx_4070", cpu: "i9_13900k", res: "1440p", level: "ultra", fps: 130 },
  { game: WITCHER_3, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "ultra", fps: 100 },
  { game: WITCHER_3, gpu: "rtx_3060", cpu: "i5_12400f", res: "1440p", level: "ultra", fps: 70  },

  // ── Hogwarts Legacy (no RT) ─────────────────────────────────────────────────
  { game: HOGWARTS_LEGACY, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "ultra", fps: 130 },
  { game: HOGWARTS_LEGACY, gpu: "rtx_4070", cpu: "i9_13900k", res: "1440p", level: "ultra", fps: 80  },
  { game: HOGWARTS_LEGACY, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "high",  fps: 65  },
  { game: HOGWARTS_LEGACY, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "ultra", fps: 55  },

  // ── CS2 (Source 2, light, CPU/engine-bound at the top) ──────────────────────
  { game: CS2, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "low",  fps: 600 },
  { game: CS2, gpu: "rtx_4070", cpu: "i9_13900k", res: "1080p", level: "low",  fps: 550 },
  { game: CS2, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "high", fps: 330 },
  { game: CS2, gpu: "rtx_3050", cpu: "i5_12400f", res: "1080p", level: "low",  fps: 240 },

  // ── Valorant (very light) ───────────────────────────────────────────────────
  { game: VALORANT, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "low",  fps: 700 },
  { game: VALORANT, gpu: "rtx_4070", cpu: "i9_13900k", res: "1080p", level: "low",  fps: 650 },
  { game: VALORANT, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "high", fps: 360 },

  // ── Fortnite (DX12, no Lumen/Nanite extremes) ───────────────────────────────
  { game: FORTNITE, gpu: "rtx_4090", cpu: "i9_13900k", res: "1080p", level: "high", fps: 240 },
  { game: FORTNITE, gpu: "rtx_4070", cpu: "i9_13900k", res: "1080p", level: "high", fps: 200 },
  { game: FORTNITE, gpu: "rtx_3060", cpu: "i5_12400f", res: "1080p", level: "high", fps: 130 },
];

const GAMES: GameDefinition[] = [
  CYBERPUNK_2077, RDR2, WITCHER_3, HOGWARTS_LEGACY, CS2, VALORANT, FORTNITE,
];

/** Predict with overridden baselines (used by the fitter). */
function predict(a: Anchor, gpuBase: number, cpuBase: number): number {
  const g: GameDefinition = { ...a.game, gpu_baseline_fps: gpuBase, cpu_baseline_fps: cpuBase };
  return estimateFPS(G(a.gpu), C(a.cpu), g, settingsAt(a.game, a.level), a.res);
}

function mapeAll(): number {
  let s = 0;
  for (const a of ANCHORS) {
    const pred = estimateFPS(G(a.gpu), C(a.cpu), a.game, settingsAt(a.game, a.level), a.res);
    s += Math.abs(pred - a.fps) / a.fps * 100;
  }
  return s / ANCHORS.length;
}

/** Grid-search the baseline pair minimising a game's anchor MAPE. */
function fitGame(game: GameDefinition) {
  const anchors = ANCHORS.filter((a) => a.game === game);
  if (!anchors.length) return null;

  const gScan: number[] = [];
  for (let m = 0.5; m <= 2.0; m += 0.02) gScan.push(Math.round(game.gpu_baseline_fps * m));
  const cScan: number[] = [];
  for (let m = 0.5; m <= 2.2; m += 0.02) cScan.push(Math.round(game.cpu_baseline_fps * m));

  let best = { gpu: game.gpu_baseline_fps, cpu: game.cpu_baseline_fps, mape: Infinity };
  for (const gb of gScan) {
    for (const cb of cScan) {
      let s = 0;
      for (const a of anchors) s += Math.abs(predict(a, gb, cb) - a.fps) / a.fps * 100;
      const mape = s / anchors.length;
      if (mape < best.mape) best = { gpu: gb, cpu: cb, mape };
    }
  }
  let cur = 0;
  for (const a of anchors) {
    const pred = estimateFPS(G(a.gpu), C(a.cpu), a.game, settingsAt(a.game, a.level), a.res);
    cur += Math.abs(pred - a.fps) / a.fps * 100;
  }
  return { ...best, current: cur / anchors.length, n: anchors.length };
}

describe("FPS formula + data calibration", () => {
  it("reports overall MAPE and per-game fitted baselines", () => {
    console.log(`\n=== Overall MAPE (shipped engine + current data): ${mapeAll().toFixed(1)}% ===\n`);
    console.log("Per-game baseline fit (gpu_baseline_fps / cpu_baseline_fps):");
    for (const game of GAMES) {
      const r = fitGame(game);
      if (!r) continue;
      console.log(
        `  ${game.label.padEnd(22)} n=${r.n}  ` +
        `current ${String(game.gpu_baseline_fps).padStart(3)}/${String(game.cpu_baseline_fps).padStart(3)} (${r.current.toFixed(0)}%)  ` +
        `→ fit ${String(r.gpu).padStart(3)}/${String(r.cpu).padStart(3)} (${r.mape.toFixed(0)}%)`
      );
    }
    console.log("");
  });
});
