/**
 * csvParser.ts
 *
 * Parses the archive CSV files (tpu_cpus.csv, tpu_gpus.csv) at module-load
 * time via Vite's `?raw` import and produces full GPU / CPU catalog entries
 * with estimated performance scores.
 *
 * Rules:
 *  - Skip blank name rows (name-only archive scraped placeholders)
 *  - Skip "No CPUs/GPUs found…" sentinel rows
 *  - Deduplicate by normalised name (first occurrence wins)
 *  - Hand-tuned catalog entries always override CSV estimates
 */

import type { GPU, CPU, GPUBrand, CPUBrand } from "../types";

// ─── Raw CSV text imported at build time ──────────────────────────────────────
// Vite resolves `?raw` imports as plain strings — no async fetch needed.
import rawCPU from "./tpu_cpus.csv?raw";
import rawGPU from "./tpu_gpus.csv?raw";

// ─── Shared utilities ─────────────────────────────────────────────────────────

/** Slugify a hardware name into a safe id string */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Parse a CSV line respecting quoted fields (commas inside quotes are safe). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

// ─── CPU parsing ──────────────────────────────────────────────────────────────

/**
 * Estimate IPC tier (1–10) from process node string.
 * Newer / smaller nodes → higher IPC tier.
 */
function ipcTierFromProcess(processStr: string): number {
  const nm = parseFloat(processStr);
  if (isNaN(nm)) return 5;
  if (nm <= 3)  return 10;
  if (nm <= 5)  return 10;
  if (nm <= 7)  return 9;
  if (nm <= 10) return 8;
  if (nm <= 14) return 7;
  if (nm <= 22) return 6;
  if (nm <= 32) return 5;
  if (nm <= 45) return 4;
  return 3;
}

/**
 * Parse "Cores" column – formats seen in the CSV:
 *   "3 " → 3 physical / 3 logical
 *   "10  / 12" → 10 physical / 12 logical
 *   "12  / 24" → 12 physical / 24 logical
 */
function parseCores(coresStr: string): { physical: number; logical: number } {
  const parts = coresStr.split("/").map((s) => parseInt(s.trim(), 10));
  const physical = parts[0] || 1;
  const logical = parts[1] || physical;
  return { physical, logical };
}

/**
 * Parse "Clock" column – formats seen:
 *   "2.1 to 2.4 GHz"  → base 2.1 / boost 2.4
 *   "3 GHz"           → base 3 / boost 3
 *   "1900 MHz"        → 1.9 GHz
 */
function parseClock(clockStr: string): { base: number; boost: number } {
  // MHz fallback
  const mhzMatch = clockStr.match(/^(\d+(?:\.\d+)?)\s*MHz$/i);
  if (mhzMatch) {
    const ghz = parseFloat(mhzMatch[1]) / 1000;
    return { base: ghz, boost: ghz };
  }
  // "X to Y GHz"
  const rangeMatch = clockStr.match(/([\d.]+)\s+to\s+([\d.]+)\s*GHz/i);
  if (rangeMatch) {
    return { base: parseFloat(rangeMatch[1]), boost: parseFloat(rangeMatch[2]) };
  }
  // "X GHz"
  const singleMatch = clockStr.match(/([\d.]+)\s*GHz/i);
  if (singleMatch) {
    const v = parseFloat(singleMatch[1]);
    return { base: v, boost: v };
  }
  return { base: 2.5, boost: 3.0 };
}

/**
 * Detect CPU brand from the name string.
 */
function detectCPUBrand(name: string): CPUBrand {
  const n = name.toLowerCase();
  if (
    n.includes("ryzen") ||
    n.includes("epyc") ||
    n.includes("opteron") ||
    n.includes("athlon") ||
    n.includes("threadripper") ||
    n.includes("phenom") ||
    n.includes("fx-") ||
    n.includes("sempron") ||
    n.includes("a4 ") ||
    n.includes("a6 ") ||
    n.includes("a8 ") ||
    n.includes("a10 ") ||
    n.startsWith("a4-") ||
    n.startsWith("a6-") ||
    n.startsWith("a8-") ||
    n.startsWith("a10-") ||
    n.includes("pro a")
  )
    return "amd";
  return "intel";
}

/**
 * Compute an estimated game_score (0–100) from parsed CPU fields.
 * Formula mirrors the hand-tuned catalog: clamp((ipc×8) + (boost×6) + (cores×2.5), 0, 100)
 */
function estimateCPUGameScore(
  ipcTier: number,
  boostGhz: number,
  coresPhysical: number
): number {
  const raw = ipcTier * 8 + boostGhz * 6 + coresPhysical * 2.5;
  return Math.min(100, Math.max(1, Math.round(raw)));
}

// ─── GPU parsing ──────────────────────────────────────────────────────────────

/**
 * Parse the "Memory" column to extract VRAM in MB.
 * Format examples: "32 KB, DRAM, 32 bit", "8 GB, GDDR6, 256 bit", "System Shared"
 */
function parseVRAM(memStr: string): number {
  const gbMatch = memStr.match(/([\d.]+)\s*GB/i);
  if (gbMatch) return Math.round(parseFloat(gbMatch[1]) * 1024);
  const mbMatch = memStr.match(/([\d.]+)\s*MB/i);
  if (mbMatch) return Math.round(parseFloat(mbMatch[1]));
  const kbMatch = memStr.match(/([\d.]+)\s*KB/i);
  if (kbMatch) return Math.max(1, Math.round(parseFloat(kbMatch[1]) / 1024));
  return 0; // System Shared / unknown
}

/**
 * Parse shader count from the "Shaders_TMUs_ROPs" column.
 * Format: "4608 / 288 / 96" or "4608 / 288 / 96 / 192" (older 4-part).
 */
function parseShaders(shadersStr: string): number {
  const parts = shadersStr.split("/").map((s) => parseInt(s.trim(), 10));
  return isNaN(parts[0]) ? 0 : parts[0];
}

/**
 * Parse a clock speed string like "2205 MHz" or "1400" into a numeric MHz value.
 */
function parseClockMHz(clockStr: string): number {
  const match = clockStr.match(/([\d.]+)/);
  if (!match) return 0;
  const v = parseFloat(match[1]);
  // If it looks like GHz (< 30) convert
  return v < 30 ? v * 1000 : v;
}

/**
 * Parse a year from the "Released" column.
 * Examples: "Jun 22nd, 2000", "1992", "Never Released", "Unknown"
 */
function parseYear(relStr: string): number {
  const match = relStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : 2000;
}

/**
 * Detect GPU brand from the product name string.
 */
function detectGPUBrand(name: string): GPUBrand {
  const n = name.toLowerCase();
  if (
    n.includes("geforce") ||
    n.includes("quadro") ||
    n.includes("tesla") ||
    n.includes("titan") ||
    n.includes("nvs ") ||
    n.includes("rtx ") ||
    n.includes("gtx ") ||
    n.includes("nvida") ||
    n.includes("riva") ||
    n.includes("nv1") ||
    n.includes("grid ") ||
    n.includes("jetson") ||
    n.includes("p102") ||
    n.includes("p104") ||
    n.includes("cmp ") ||
    n.includes("rtx a") ||
    n.includes("rtx titan") ||
    n.includes("h100") ||
    n.includes("h800") ||
    n.includes("a100") ||
    n.includes("a800") ||
    n.includes("l40") ||
    n.startsWith("t1") ||
    n.startsWith("t4") ||
    n.startsWith("t5") ||
    n.startsWith("t6")
  )
    return "nvidia";
  if (
    n.includes("radeon") ||
    n.includes("instinct") ||
    n.includes("firepro") ||
    n.includes("firegl") ||
    n.includes("rage") ||
    n.includes("vega") ||
    n.includes("rx ") ||
    n.includes("arc pro") === false // intel arc — handled below
  ) {
    const isAMD =
      n.includes("radeon") ||
      n.includes("instinct") ||
      n.includes("firepro") ||
      n.includes("firegl") ||
      n.includes("rage") ||
      n.includes("rx ") ||
      n.includes("vega") ||
      n.includes("all-in-wonder") ||
      n.includes("mach") ||
      n.includes("playstation") ||
      n.includes("xbox");
    if (isAMD) return "amd";
  }
  if (
    n.includes("arc ") ||
    n.includes("iris") ||
    n.includes("uhd graphics") ||
    n.includes("gma ") ||
    n.includes("i740") ||
    n.includes("i752") ||
    n.includes("i815") ||
    n.includes("i830") ||
    n.includes("xe ") ||
    n.includes("xe max") ||
    n.includes("extreme graphics")
  )
    return "intel";
  // Fallback heuristics
  if (n.includes("amd") || n.includes("ati")) return "amd";
  if (n.includes("intel") || n.includes("dg1") || n.includes("dg2")) return "intel";
  return "nvidia";
}

/**
 * Derive a rough GPU architecture string from the chip / product name.
 */
function detectGPUArch(productName: string, chip: string): string {
  const n = (productName + " " + chip).toLowerCase();
  // NVIDIA
  if (n.includes("gh1") || n.includes("h100") || n.includes("h800")) return "hopper";
  if (n.includes("ad1")) return "ada_lovelace";
  if (n.includes("ga1")) return "ampere";
  if (n.includes("tu1")) return "turing";
  if (n.includes("gp1") || n.includes("gp10")) return "pascal";
  if (n.includes("gm1") || n.includes("gm2")) return "maxwell";
  if (n.includes("gk1") || n.includes("gk2")) return "kepler";
  if (n.includes("gf1")) return "fermi";
  if (n.includes("gt2") || n.includes("nv4") || n.includes("nv3")) return "tesla_gpu";
  if (n.includes("rtx 5") || n.includes("rtx5")) return "blackwell";
  if (n.includes("rtx 4") || n.includes("rtx4")) return "ada_lovelace";
  if (n.includes("rtx 3") || n.includes("rtx3")) return "ampere";
  if (n.includes("rtx 2") || n.includes("rtx2") || n.includes("gtx 16")) return "turing";
  if (n.includes("gtx 10") || n.includes("gtx10")) return "pascal";
  if (n.includes("gtx 9") || n.includes("gtx9")) return "maxwell";
  if (n.includes("gtx 7") || n.includes("gtx 6")) return "kepler";
  // AMD / ATI
  if (n.includes("navi 3") || n.includes("rdna3") || n.includes("rx 7")) return "rdna3";
  if (n.includes("navi 2") || n.includes("rdna2") || n.includes("rx 6")) return "rdna2";
  if (n.includes("navi 1") || n.includes("rdna1") || n.includes("rx 5")) return "rdna1";
  if (n.includes("vega 2") || n.includes("vega20")) return "vega";
  if (n.includes("vega") || n.includes("vega10")) return "vega";
  if (n.includes("fiji") || n.includes("polaris") || n.includes("rx 4")) return "gcn4";
  if (n.includes("hawaii") || n.includes("tonga") || n.includes("rx 3") || n.includes("r9 3")) return "gcn3";
  if (n.includes("tahiti") || n.includes("pitcairn") || n.includes("hd 7")) return "gcn1";
  if (n.includes("r9 9") || n.includes("r9 8") || n.includes("r9 7")) return "gcn1";
  if (n.includes("r7 2") || n.includes("r7 3")) return "gcn1";
  if (n.includes("r300") || n.includes("r350") || n.includes("r360")) return "r300";
  if (n.includes("radeon 9") || n.includes("r200")) return "r200";
  if (n.includes("rage") || n.includes("mach")) return "rage";
  // Intel
  if (n.includes("battlemage") || n.includes("b5") || n.includes("b580")) return "battlemage";
  if (n.includes("alchemist") || n.includes("dg2") || n.includes("arc a")) return "alchemist";
  if (n.includes("xe") || n.includes("dg1")) return "xe";
  if (n.includes("iris") || n.includes("uhd") || n.includes("hd graphics")) return "gen_graphics";
  return "unknown";
}

/**
 * Estimate a GPU compute_score (0–135+) from shaders, clock MHz, and VRAM.
 * Anchored so that an RTX 4090 equivalent (~16384 shaders @ 2235 MHz, 24 GB) ≈ 100.
 *
 * Formula: (shaders × boostMHz) / normFactor, then scale by VRAM bonus
 */
function estimateGPUComputeScore(
  shaders: number,
  boostMHz: number,
  vramMB: number
): number {
  if (shaders <= 0 || boostMHz <= 0) {
    // Very old or integrated GPU – score from VRAM only
    if (vramMB >= 8192) return 8;
    if (vramMB >= 4096) return 4;
    if (vramMB >= 1024) return 2;
    return 1;
  }
  // RTX 4090: 16384 shaders × 2235 MHz ≈ 36,618,240 → score 100
  const normFactor = 16384 * 2235 * 0.01; // = 366_182.4 → result in ~0-100 range
  const raw = (shaders * boostMHz) / normFactor;
  // VRAM bonus: cards with ≥16 GB get a small uplift
  let vramBonus = 0;
  if (vramMB >= 32768) vramBonus = 5;
  else if (vramMB >= 24576) vramBonus = 3;
  else if (vramMB >= 16384) vramBonus = 1;
  return Math.min(200, Math.max(1, Math.round(raw + vramBonus)));
}

// ─── CPU parser ───────────────────────────────────────────────────────────────

export function parseCPUsFromCSV(): CPU[] {
  const lines = rawCPU.split("\n");
  const results: CPU[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    // CSV columns: index, Name, Codename, Cores, Clock, Socket, Process, L3_Cache, TDP, Release
    // We need at least name (index 1)
    if (fields.length < 2) continue;

    const name = fields[1].trim();

    // Skip sentinels and blanks
    if (!name || name.toLowerCase().includes("no cpus found")) continue;

    // Deduplicate
    const normName = name.toLowerCase();
    if (seen.has(normName)) continue;
    seen.add(normName);

    const coresStr  = fields[3]?.trim() || "1";
    const clockStr  = fields[4]?.trim() || "2 GHz";
    const processStr = fields[6]?.trim() || "14 nm";

    const { physical, logical } = parseCores(coresStr);
    const { base, boost }       = parseClock(clockStr);
    const ipcTier               = ipcTierFromProcess(processStr);
    const brand                 = detectCPUBrand(name);
    const gameScore             = estimateCPUGameScore(ipcTier, boost, physical);

    results.push({
      id:              toId(name),
      brand,
      label:           name,
      cores_physical:  physical,
      cores_logical:   logical,
      base_clock_ghz:  Math.round(base * 10) / 10,
      boost_clock_ghz: Math.round(boost * 10) / 10,
      ipc_tier:        ipcTier,
      game_score:      gameScore,
    });
  }

  return results;
}

// ─── GPU parser ───────────────────────────────────────────────────────────────

export function parseGPUsFromCSV(): GPU[] {
  const lines = rawGPU.split("\n");
  const results: GPU[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    // Columns: index, Product_Name, GPU_Chip, Released, Bus, Memory, GPU_clock, Memory_clock, Shaders_TMUs_ROPs
    if (fields.length < 2) continue;

    const name = fields[1].trim();

    // Skip sentinels and blanks
    if (!name || name.toLowerCase().includes("no graphics cards found")) continue;

    // Deduplicate
    const normName = name.toLowerCase();
    if (seen.has(normName)) continue;
    seen.add(normName);

    const chip      = fields[2]?.trim() || "";
    const released  = fields[3]?.trim() || "";
    const memStr    = fields[5]?.trim() || "";
    const gpuClock  = fields[6]?.trim() || "0";
    const shadersStr = fields[8]?.trim() || "0 / 0 / 0";

    const vramMB   = parseVRAM(memStr);
    const boostMHz = parseClockMHz(gpuClock);
    const shaders  = parseShaders(shadersStr);
    const year     = parseYear(released);
    const brand    = detectGPUBrand(name);
    const arch     = detectGPUArch(name, chip);
    const score    = estimateGPUComputeScore(shaders, boostMHz, vramMB);

    results.push({
      id:                    toId(name),
      brand,
      label:                 name,
      vram_mb:               vramMB,
      memory_bandwidth_gbps: 0, // not in CSV; engine falls back gracefully
      compute_score:         score,
      raster_score:          score,
      architecture:          arch,
      released_year:         year,
    });
  }

  return results;
}
