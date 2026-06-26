/**
 * csvParser.ts  –  Production-quality CSV→catalog converter
 *
 * Converts every valid row in the archive CSVs into a fully-scored GPU/CPU
 * catalog entry the optimization engine can consume.
 *
 * ── Scoring philosophy ────────────────────────────────────────────────────────
 * GPU compute_score (0–140+, RTX 4090 = 100)
 *   Derived from: shader count × boost clock (TFLOPS proxy), then scaled
 *   by a per-generation efficiency factor that accounts for IPC improvements,
 *   architecture optimisations, and driver maturity.
 *   VRAM capacity adds a small budget bonus.
 *   Result is clamped and rounded to the nearest integer.
 *
 * CPU game_score (0–100)
 *   Derived from IPC tier (architecture generation) × boost clock × core count
 *   using the same formula as the hand-tuned catalog:
 *     clamp( (ipc_tier × 8) + (boost_ghz × 6) + (cores_physical × 2.5), 0, 100 )
 *
 * ── Tier classification ───────────────────────────────────────────────────────
 * GPU tier stored in `architecture` string prefix:
 *   - Flagship  → score ≥ 70  or name keyword match
 *   - Mid       → score 28–69
 *   - Entry     → score < 28
 *
 * CPU tier derived from name/model-number patterns (i9/R9 → flagship, etc.)
 */

import type { GPU, CPU, GPUBrand, CPUBrand } from "../types";

import rawCPU from "./tpu_cpus.csv?raw";
import rawGPU from "./tpu_gpus.csv?raw";

// ─── CSV line parser (quote-aware) ───────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  fields.push(cur.trim());
  return fields;
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function toId(name: string, seen: Map<string, number>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}_${count}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ─── GPU helpers ─────────────────────────────────────────────────────────────

function detectGPUBrand(name: string): GPUBrand {
  const n = name.toLowerCase();
  // NVIDIA identifiers
  if (/geforce|quadro|tesla|titan|rtx |gtx |nvs |riva |nv1 |nv\d|grid |jetson|p102|p104|cmp |h100|h800|a100|a800|l40 |l4 |t[0-9]|gh100|ga\d|tu\d|gp\d|gm\d|gk\d|gf\d|gt2\d|nv4|nv3|nvdia|vanta|spectre|xbox gpu|xbox 36/.test(n))
    return "nvidia";
  // AMD / ATI identifiers
  if (/radeon|instinct|firepro|firegl|rage |mach|all-in-wonder|rx |vega|rdna|gcn|navi|polaris|fiji|tonga|hawaii|tahiti|pitcairn|adrenalin|playstation|r9 |r7 |r5 |r300|r200|athlon.*gpu|zhongshan|steam deck|atari vcs/.test(n))
    return "amd";
  // Intel identifiers
  if (/arc |iris|uhd graphics|hd graphics|gma |i740|i752|i815|i830|xe |extreme graphics|dg1|dg2|xeon.*gpu|auburn|portola|brookdale|almador|solano|whitney|alviso|lakeport|cantiga|ironlake|sandy.*bridge.*gpu|ivy.*bridge.*gpu|haswell.*gpu/.test(n))
    return "intel";
  // fallback keyword scan
  if (n.includes("amd") || n.includes("ati")) return "amd";
  if (n.includes("intel"))                      return "intel";
  return "nvidia";
}

/**
 * Generation-adjusted efficiency multiplier.
 * Each GPU generation improves perf-per-TFLOP due to better IPC, caching,
 * memory compression, driver optimisations, etc.
 * Anchored: modern gen (2020+) = 1.0, reference era (1995–2000) = 0.01.
 */
function gpuGenEfficiency(year: number): number {
  if (year >= 2024) return 1.05;
  if (year >= 2022) return 1.00;
  if (year >= 2020) return 0.92;
  if (year >= 2018) return 0.82;
  if (year >= 2016) return 0.72;
  if (year >= 2014) return 0.62;
  if (year >= 2012) return 0.50;
  if (year >= 2010) return 0.38;
  if (year >= 2008) return 0.27;
  if (year >= 2006) return 0.18;
  if (year >= 2004) return 0.11;
  if (year >= 2002) return 0.07;
  if (year >= 2000) return 0.04;
  if (year >= 1998) return 0.025;
  if (year >= 1996) return 0.015;
  return 0.008;
}

/** Parse VRAM MB from the Memory column. */
function parseVRAM(s: string): number {
  const gb = s.match(/([\d.]+)\s*GB/i);
  if (gb) return Math.round(parseFloat(gb[1]) * 1024);
  const mb = s.match(/([\d.]+)\s*MB/i);
  if (mb) return Math.round(parseFloat(mb[1]));
  const kb = s.match(/([\d.]+)\s*KB/i);
  if (kb) return Math.max(1, Math.round(parseFloat(kb[1]) / 1024));
  return 0;
}

/** Parse first number from shader/TMU/ROP string (shader count). */
function parseShaders(s: string): number {
  const m = s.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Parse clock speed (MHz or GHz) → MHz. */
function parseClockMHz(s: string): number {
  const ghz = s.match(/([\d.]+)\s*GHz/i);
  if (ghz) return Math.round(parseFloat(ghz[1]) * 1000);
  const mhz = s.match(/([\d.]+)\s*MHz/i);
  if (mhz) return Math.round(parseFloat(mhz[1]));
  const raw = s.match(/^([\d.]+)/);
  if (raw) {
    const v = parseFloat(raw[1]);
    return v < 30 ? Math.round(v * 1000) : Math.round(v);
  }
  return 0;
}

/** Parse year from date strings like "Jun 22nd, 2000", "1992", "Never Released". */
function parseYear(s: string): number {
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : 2000;
}

/**
 * Derive architecture string from name + chip code.
 * Returns a consistent slug used for grouping in the UI.
 */
function gpuArchitecture(name: string, chip: string, year: number): string {
  const n = (name + " " + chip).toLowerCase();
  // ── NVIDIA ────────────────────────────────────────────────────────────────
  if (/gb\d/.test(n) || year >= 2025)                                  return "blackwell";
  if (/gh\d|h100|h800|hopper/.test(n))                                  return "hopper";
  if (/ad\d|rtx 4\d|rtx4\d/.test(n))                                   return "ada_lovelace";
  if (/ga\d|a100|a40|a10|a30|a16|a2 |rtx 3\d|rtx3\d/.test(n))         return "ampere";
  if (/tu\d|rtx 2\d|rtx2\d|gtx 16\d|t4 |t10/.test(n))                 return "turing";
  if (/gp\d|gtx 10\d|gtx10\d|p40|p100|p102|p104|tesla p/.test(n))     return "pascal";
  if (/gm\d|gtx 9\d|gtx9\d|gtx titan x$/.test(n))                     return "maxwell";
  if (/gk\d|gtx [67]\d|gtx[67]\d/.test(n))                             return "kepler";
  if (/gf\d|gtx [345]\d|gtx[345]\d|fermi/.test(n))                     return "fermi";
  if (/gt2\d|gt[12]\d|nv4\d|nv3\d|nv2\d|nv1[5-9]/.test(n))           return "tesla_gpu";
  if (/nv\d|riva/.test(n))                                               return "nv_legacy";
  // ── AMD / ATI ──────────────────────────────────────────────────────────────
  if (/cdna3|mi300|aldebaran/.test(n))                                   return "cdna3";
  if (/cdna2|mi200|aldebaran/.test(n))                                   return "cdna2";
  if (/cdna1|mi100|arcturus/.test(n))                                    return "cdna1";
  if (/navi 3|rdna3|rx 7[679]|rx 7[45]|rx7[679]/.test(n))              return "rdna3";
  if (/navi 2|rdna2|rx 6[89]|rx 6[56]|rx 6[45]|rx 6[23]|rx6/.test(n)) return "rdna2";
  if (/navi 1|rdna1|rx 5[567]/.test(n))                                 return "rdna1";
  if (/vega 2|vega20|mi60|mi50/.test(n))                                return "vega2";
  if (/vega|vega10|rx vega/.test(n))                                     return "vega";
  if (/polaris|rx 4\d\d|rx4\d\d|rx 580|rx 570|rx 560|rx 550|rx 540/.test(n)) return "polaris";
  if (/fiji|rx 300|rx 390|r9 fury|r9 nano/.test(n))                     return "fiji";
  if (/tonga|r9 380|r9 285/.test(n))                                     return "tonga";
  if (/hawaii|r9 290|r9 295/.test(n))                                    return "hawaii";
  if (/bonaire|r7 260|hd 7790/.test(n))                                  return "bonaire";
  if (/tahiti|r9 280|hd 7970|hd 7950/.test(n))                          return "tahiti";
  if (/pitcairn|r9 270|r7 265|hd 7870|hd 7850/.test(n))                 return "pitcairn";
  if (/r[35679]\d|hd [6-9]\d{3}|rx [23]\d|gcn|cayman|barts|turks|cedar/.test(n)) return "gcn_legacy";
  if (/r[25]00|r300|r350|r360|x8[0-9]\d|x1[89]\d\d/.test(n))           return "r300_era";
  if (/r200|r9 [5-9]\d\d|radeon 9[5-9]\d\d/.test(n))                    return "r200_era";
  if (/r100|radeon [78]\d{3}|radeon 9[012]\d\d/.test(n))                return "r100_era";
  if (/rage|mach/.test(n))                                               return "ati_rage";
  // ── Intel ──────────────────────────────────────────────────────────────────
  if (/battlemage|b[35]80|dg3/.test(n))                                  return "battlemage";
  if (/alchemist|dg2|arc a[3-7]/.test(n))                               return "alchemist";
  if (/xe max|dg1/.test(n))                                              return "xe_lp";
  if (/xe|iris xe/.test(n))                                              return "xe_graphics";
  if (/iris plus|iris pro/.test(n))                                      return "iris_plus";
  if (/uhd|iris 6[56]0/.test(n))                                        return "uhd_graphics";
  if (/hd graphics|hd [234456]\d\d0/.test(n))                           return "hd_graphics";
  if (/gma|extreme graphics/.test(n))                                    return "legacy_intel";
  return "other";
}

/**
 * Compression exponent applied to the raw TFLOPS ratio.
 *
 * Real gaming FPS does NOT scale linearly with TFLOPS: an RTX 4090 has ~24× the
 * raw compute of a GTX 1650 Ti but is only ~4–8× faster in actual 1080p games
 * (CPU/engine/bandwidth limits cap the gap). A pure-linear model therefore
 * crushes every budget/older card toward 0 (a 1650 Ti scored ~3, implying it is
 * 3 % of a 4090 — it predicted ~7 FPS in titles it really runs at 150 +).
 *
 * Raising the ratio to GAMMA (< 1) compresses the curve so mid/low cards land in
 * a realistic band. Calibrated so CSV scores match the hand-tuned catalog
 * anchors (RTX 4090 = 100, 4070 ≈ 67, 4060 ≈ 50, 3060 ≈ 48, GTX 1650 ≈ 22,
 * 1060 6 GB ≈ 24) — see calibration notes in the PR.
 */
const GPU_SCORE_GAMMA = 0.40;

/** Estimate GPU compute_score. RTX 4090 (16384 shaders × 2235 MHz) ≈ 100. */
function computeGPUScore(
  shaders: number,
  boostMHz: number,
  vramMB: number,
  year: number
): number {
  if (shaders <= 0 || boostMHz <= 0) {
    // Integrated / very old: score from VRAM alone
    if (vramMB >= 8192) return 6;
    if (vramMB >= 4096) return 3;
    if (vramMB >= 1024) return 2;
    return 1;
  }

  // Raw TFLOPS-proxy (not real FP32 but proportional)
  const tflops = (shaders * boostMHz * 2) / 1e9; // factor-of-2 for FMA

  // RTX 4090 reference: 16384 × 2235 MHz × 2 / 1e9 ≈ 73.27 TFLOPS → score 100
  const REF_TFLOPS = (16384 * 2235 * 2) / 1e9;
  const rawRatio = tflops / REF_TFLOPS; // 0–∞, RTX 4090 ≈ 1.0

  // Generation-adjusted effective ratio (architecture/driver maturity), then
  // gamma-compressed so FPS-relative scaling — not raw TFLOPS — drives the score.
  const eff = gpuGenEfficiency(year);
  const effRatio = rawRatio * eff; // RTX 4090 ≈ 1.0
  let score = Math.pow(effRatio, GPU_SCORE_GAMMA) * 100;

  // Small VRAM bonus (high VRAM → can sustain high settings)
  if (vramMB >= 32768) score += 6;
  else if (vramMB >= 24576) score += 3;
  else if (vramMB >= 16384) score += 1;

  return clamp(Math.round(score), 1, 200);
}

// ─── CPU helpers ─────────────────────────────────────────────────────────────

function detectCPUBrand(name: string): CPUBrand {
  const n = name.toLowerCase();
  if (/ryzen|epyc|opteron|athlon|threadripper|phenom|fx-|sempron|a[468] |a[468]-|a10|a12|pro a|nano quad/.test(n))
    return "amd";
  return "intel";
}

/**
 * IPC tier from process node (nm).
 * Smaller node → later generation → higher IPC, per the catalog formula.
 */
function ipcFromNode(nmStr: string): number {
  const nm = parseFloat(nmStr);
  if (isNaN(nm)) return 5;
  if (nm <= 3)  return 10; // 3nm  – Zen 5 / latest Intel
  if (nm <= 4)  return 10; // 4nm
  if (nm <= 5)  return 10; // 5nm  – Zen 4 / Alder Lake
  if (nm <= 6)  return 9;  // 6nm
  if (nm <= 7)  return 9;  // 7nm  – Zen 3 / Zen 2
  if (nm <= 10) return 8;  // 10nm – Ice Lake / Tiger Lake / Alder Lake lite
  if (nm <= 12) return 7;  // 12nm – Zen+
  if (nm <= 14) return 7;  // 14nm – Skylake / Coffee Lake / Zen
  if (nm <= 16) return 6;  // 16nm – Broadwell
  if (nm <= 22) return 6;  // 22nm – Ivy Bridge / Haswell
  if (nm <= 28) return 5;  // 28nm – Sandy Bridge / Bulldozer
  if (nm <= 32) return 4;  // 32nm – Westmere
  if (nm <= 40) return 4;  // 40nm – Nehalem
  if (nm <= 45) return 3;  // 45nm – Penryn / Phenom II
  if (nm <= 65) return 2;  // 65nm – Core 2 / Athlon X2
  if (nm <= 90) return 2;  // 90nm – Pentium D
  return 1;                 // 130nm+ – Pentium 4 / Athlon XP
}

/** Parse "Cores" column: "3", "10  / 16", "24  / 32" → { physical, logical }. */
function parseCores(s: string): { physical: number; logical: number } {
  const parts = s.split("/").map((p) => parseInt(p.trim(), 10));
  const phys = isNaN(parts[0]) ? 1 : Math.max(1, parts[0]);
  const logi = isNaN(parts[1]) ? phys : Math.max(phys, parts[1]);
  return { physical: phys, logical: logi };
}

/**
 * Parse "Clock" column → { base, boost } in GHz.
 * Formats:
 *   "3.7 to 5.6 GHz"  → base 3.7, boost 5.6
 *   "3 GHz"           → base 3.0, boost 3.0
 *   "1900 MHz"        → base 1.9, boost 1.9
 *   "7.3 to 5.4 GHz"  → typo in data; take the higher as boost
 */
function parseCPUClock(s: string): { base: number; boost: number } {
  const range = s.match(/([\d.]+)\s+to\s+([\d.]+)\s*GHz/i);
  if (range) {
    const a = parseFloat(range[1]);
    const b = parseFloat(range[2]);
    return { base: Math.min(a, b), boost: Math.max(a, b) };
  }
  const single = s.match(/([\d.]+)\s*GHz/i);
  if (single) { const v = parseFloat(single[1]); return { base: v, boost: v }; }
  const mhz = s.match(/([\d.]+)\s*MHz/i);
  if (mhz) { const v = parseFloat(mhz[1]) / 1000; return { base: v, boost: v }; }
  return { base: 2.5, boost: 3.0 };
}

/**
 * Compute game_score (0–100), calibrated to the hand-tuned catalog scale.
 *
 * The previous formula (ipc×8 + boost×6 + cores×2.5) saturated almost every
 * modern CPU near 90–100 (a 6-core i5-10400F computed ~97 where the hand-tuned
 * catalog rates it 56). This weighting reproduces the hand-tuned anchors within
 * a few points: i5-10400F ≈ 59 (hand 56), i9-10900K ≈ 71 (73), i9-12900K ≈ 89
 * (91), Ryzen 9 5950X ≈ 94 (89), i5-10300H ≈ 55.
 */
function cpuGameScore(ipcTier: number, boostGhz: number, coresPhys: number): number {
  return clamp(Math.round(ipcTier * 6 + coresPhys * 2.2 + boostGhz * 3.5 - 12), 1, 100);
}

// ─── Name-based spec inference (for rows missing clock/core/node data) ─────────
//
// ~380 rows in the archive CSV carry only a model name (a scrape gap), e.g. the
// entire 10th-gen Intel mobile block including "Core i5-10300H". Without this,
// they fell back to placeholder defaults (1 core / 3.0 GHz / IPC 5) and scored
// nonsensically. We instead derive realistic cores/boost/node from the model
// name so the engine produces sane numbers.

interface InferredSpecs { physical: number; logical: number; boost: number; nm: string; }

/** Intel Core generation → fabrication node (nm), used to derive IPC tier. */
function intelGenNode(gen: number): number {
  if (gen >= 11) return 10;          // Intel 7 (10nm ESF) / 10nm SuperFin — 11th-14th
  if (gen >= 6 && gen <= 10) return 14; // Skylake … Comet Lake
  if (gen === 5) return 14;          // Broadwell
  if (gen === 4 || gen === 3) return 22; // Haswell / Ivy Bridge
  return 32;                          // Sandy Bridge and older
}

/** Best-effort cores/boost/node from a CPU model name. */
function inferCPUSpecs(name: string): InferredSpecs {
  const n = name.toLowerCase();

  // ── Intel Core iX-NNNN[suffix] ───────────────────────────────────────────────
  let m = n.match(/core\s+i([3579])[- ](\d{3,5})([a-z]*)/);
  if (m) {
    const tier = parseInt(m[1], 10);            // 3 / 5 / 7 / 9
    const num = m[2];                            // e.g. "10300"
    const suf = m[3] || "";
    const gen = num.length >= 5 ? parseInt(num.slice(0, 2), 10) : parseInt(num.slice(0, 1), 10);
    const nm = intelGenNode(gen);
    const ulv = /[uy]/.test(suf);                // thin-and-light mobile
    const mob = /h/.test(suf);                   // performance mobile

    let cores: number;
    if (ulv) cores = tier <= 3 ? 2 : 4;
    else if (gen >= 12) cores = tier === 3 ? 4 : tier === 5 ? 6 : 8; // hybrid: P-core count
    else if (tier === 3) cores = 4;
    else if (tier === 5) cores = mob && gen <= 10 ? 4 : gen <= 7 ? 4 : 6;
    else if (tier === 7) cores = mob ? (gen <= 8 ? 4 : 6) : gen <= 7 ? 4 : 8;
    else cores = 8;                              // i9

    let boost: number;
    if (ulv) boost = tier <= 3 ? 3.4 : 3.9;
    else if (mob) boost = tier <= 5 ? 4.5 : tier === 7 ? 5.0 : 5.2;
    else boost = tier === 3 ? 4.3 : tier === 5 ? (gen >= 12 ? 4.9 : 4.4)
               : tier === 7 ? (gen >= 12 ? 5.1 : 4.8) : 5.4;
    if (gen <= 8) boost -= 0.3;                  // older silicon clocked lower

    return { physical: cores, logical: cores * 2, boost: Math.round(boost * 10) / 10, nm: String(nm) };
  }

  if (/core m-/.test(n)) return { physical: 2, logical: 4, boost: 2.6, nm: "14" };
  if (/pentium/.test(n)) return { physical: 2, logical: /g4|g5|g6|gold/.test(n) ? 4 : 2, boost: 3.5, nm: "14" };
  if (/celeron/.test(n)) return { physical: 2, logical: 2, boost: /n2|n3|n4/.test(n) ? 2.4 : 3.0, nm: "14" };
  if (/atom/.test(n))    return { physical: 4, logical: 4, boost: 1.8, nm: "14" };

  // ── AMD Ryzen X NNNN ─────────────────────────────────────────────────────────
  m = n.match(/ryzen\s+([3579])\s+(\d{4})/);
  if (m) {
    const tier = parseInt(m[1], 10);
    const series = parseInt(m[2][0], 10);        // 1/2/3/5/7/9 thousands
    const nm = series >= 9 ? 4 : series >= 7 ? 5 : series >= 3 ? 7 : 14;
    const cores = tier === 3 ? 4 : tier === 5 ? 6 : tier === 7 ? 8 : 12;
    let boost = tier === 3 ? 4.0 : tier === 5 ? 4.4 : tier === 7 ? 4.7 : 4.9;
    if (series >= 7) boost += 0.4;
    else if (series <= 2) boost -= 0.3;
    return { physical: cores, logical: cores * 2, boost: Math.round(boost * 10) / 10, nm: String(nm) };
  }

  // ── AMD APU / Athlon / FX ─────────────────────────────────────────────────────
  if (/\ba(4|6)\b|a4-|a6-/.test(n))            return { physical: 2, logical: 2, boost: 3.5, nm: "28" };
  if (/\ba(8|10|12)\b|a8-|a10-|a12-/.test(n))  return { physical: 4, logical: 4, boost: 3.8, nm: "28" };
  if (/athlon/.test(n))                         return { physical: /x4|3000|300ge/.test(n) ? 4 : 2, logical: 4, boost: 3.4, nm: "14" };
  if (/fx-/.test(n))                            return { physical: /fx-[89]/.test(n) ? 8 : /fx-6/.test(n) ? 6 : 4, logical: 8, boost: 4.0, nm: "32" };

  // ── Generic fallback (unknown family) ─────────────────────────────────────────
  return { physical: 4, logical: 4, boost: 3.2, nm: "14" };
}

// ─── Main export: parse CPUs ─────────────────────────────────────────────────

export function parseCPUsFromCSV(): CPU[] {
  const lines = rawCPU.split("\n");
  const out: CPU[] = [];
  const seenLabel = new Set<string>();
  const seenId    = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim().replace(/\r$/, "");
    if (!line) continue;

    const f = parseLine(line);
    if (f.length < 2) continue;

    const name = f[1].trim();
    if (!name)                                        continue;
    if (name.toLowerCase().includes("no cpus found")) continue;

    const key = name.toLowerCase();
    if (seenLabel.has(key)) continue;
    seenLabel.add(key);

    // Many archive rows carry only a model name (scrape gap). When the core/clock
    // columns are blank, derive realistic specs from the name instead of falling
    // back to the placeholder defaults that produced nonsensical scores.
    const hasSpecs = !!(f[3]?.trim() && f[4]?.trim());

    let physical: number, logical: number, base: number, boost: number, nodeStr: string;
    if (hasSpecs) {
      ({ physical, logical } = parseCores(f[3] ?? "1"));
      ({ base, boost }       = parseCPUClock(f[4] ?? "2 GHz"));
      nodeStr                = f[6]?.trim() || "14 nm";
    } else {
      const g = inferCPUSpecs(name);
      physical = g.physical; logical = g.logical;
      base = Math.round((g.boost - 0.5) * 10) / 10; boost = g.boost;
      nodeStr = g.nm;
    }

    const ipcTier   = ipcFromNode(nodeStr);
    const brand     = detectCPUBrand(name);
    const gameScore = cpuGameScore(ipcTier, boost, physical);

    out.push({
      id:              toId(name, seenId),
      brand,
      label:           name,
      cores_physical:  physical,
      cores_logical:   logical,
      base_clock_ghz:  Math.round(base  * 10) / 10,
      boost_clock_ghz: Math.round(boost * 10) / 10,
      ipc_tier:        ipcTier,
      game_score:      gameScore,
    });
  }
  return out;
}

// ─── Main export: parse GPUs ─────────────────────────────────────────────────

export function parseGPUsFromCSV(): GPU[] {
  const lines = rawGPU.split("\n");
  const out: GPU[] = [];
  const seenLabel = new Set<string>();
  const seenId    = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim().replace(/\r$/, "");
    if (!line) continue;

    const f = parseLine(line);
    if (f.length < 2) continue;

    const name = f[1].trim();
    if (!name)                                                    continue;
    if (name.toLowerCase().includes("no graphics cards found"))  continue;

    const key = name.toLowerCase();
    if (seenLabel.has(key)) continue;
    seenLabel.add(key);

    const chip       = f[2]?.trim() ?? "";
    const released   = f[3]?.trim() ?? "";
    const memStr     = f[5]?.trim() ?? "";
    const gpuClock   = f[6]?.trim() ?? "0";
    const shadersStr = f[8]?.trim() ?? "0";

    const year     = parseYear(released);
    const vramMB   = parseVRAM(memStr);
    const boostMHz = parseClockMHz(gpuClock);
    const shaders  = parseShaders(shadersStr);
    const brand    = detectGPUBrand(name);
    const arch     = gpuArchitecture(name, chip, year);
    const score    = computeGPUScore(shaders, boostMHz, vramMB, year);
    const bwEst    = estimateBandwidth(vramMB, year, memStr);

    out.push({
      id:                    toId(name, seenId),
      brand,
      label:                 name,
      vram_mb:               vramMB,
      memory_bandwidth_gbps: bwEst,
      compute_score:         score,
      raster_score:          Math.round(score * (brand === "amd" ? 1.03 : 1.0)),
      architecture:          arch,
      released_year:         year,
    });
  }
  return out;
}

/**
 * Rough memory bandwidth estimate (GB/s) from VRAM size, year, and memory type string.
 * Used by the UI only (badge display); engine uses vram_mb for budget decisions.
 */
function estimateBandwidth(vramMB: number, year: number, memStr: string): number {
  const m = memStr.toLowerCase();

  // Modern high-bandwidth memory
  if (m.includes("hbm3"))  return Math.round(vramMB / 1024 * 75); // ~3.2 TB/s per stack normalised
  if (m.includes("hbm2e")) return Math.round(vramMB / 1024 * 50);
  if (m.includes("hbm2"))  return Math.round(vramMB / 1024 * 40);
  if (m.includes("hbm"))   return Math.round(vramMB / 1024 * 35);

  // GDDR bandwidth roughly proportional to year + VRAM
  if (m.includes("gddr7")) return Math.round(vramMB / 8 * 1.5);
  if (m.includes("gddr6x")) return Math.round(vramMB / 8 * 1.2);
  if (m.includes("gddr6"))  return Math.round(vramMB / 8 * 0.9);
  if (m.includes("gddr5x")) return Math.round(vramMB / 8 * 0.7);
  if (m.includes("gddr5"))  return Math.round(vramMB / 8 * 0.5);

  // Older memory — scale by year
  const base = year >= 2020 ? 350 : year >= 2016 ? 240 : year >= 2012 ? 150 :
               year >= 2008 ? 80  : year >= 2004 ? 30  : 10;
  return Math.round(base * (vramMB / 8192));
}
