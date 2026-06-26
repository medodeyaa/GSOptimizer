// build-archive.mjs ─────────────────────────────────────────────────────────
// Converts the raw TechPowerUp spec dumps in /archive into compact, deduped
// JSON catalogs the app can lazy-load as a SEARCH FALLBACK when a part is not
// in the hand-curated dropdown.
//
//   archive/tpu_gpus.csv  ->  public/data/gpu-archive.json
//   archive/tpu_cpus.csv  ->  public/data/cpu-archive.json
//
// The TPU dumps contain RAW SPECS ONLY (no gaming-performance scores), so the
// engine-critical fields (compute_score / raster_score / game_score) are
// ESTIMATED here from the documented formulas. They are explicitly flagged
// `estimated: true` so the UI can warn the user — they are NOT benchmark-grade,
// especially across architectures. See src/data/types.ts for the schemas.
//
// Run:  npm run build:archive
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");

// ─── Tiny CSV parser (handles quoted fields with commas) ──────────────────────
function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const normName = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

function parseYear(s = "") {
  const m = s.match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : 0;
}

// ─── GPU conversion ───────────────────────────────────────────────────────────
// Memory data-rate multiplier (effective Gbps per MHz of the listed mem clock),
// reverse-derived from known cards: 4090 (GDDR6X, ×16), 7900XTX (GDDR6, ×8),
// HD7870 (GDDR5, ×4). HBM uses a very wide bus at a low multiplier.
const MEM_MULT = {
  GDDR7: 16, GDDR6X: 16, GDDR6: 8, GDDR5X: 8, GDDR5: 4, GDDR4: 4,
  GDDR3: 2, GDDR2: 2, GDDR: 2, DDR4: 2, DDR3: 2, DDR2: 2, DDR: 2,
  HBM2E: 2, HBM2: 2, HBM: 2, SDR: 1,
};

// Per-era efficiency factor: real gaming perf per (shader × clock) drops on
// older architectures. Anchored at Ada/RDNA3 (2022+) = 1.0.
function eraEfficiency(year) {
  if (year >= 2024) return 1.05;
  if (year >= 2022) return 1.0;
  if (year >= 2020) return 0.95;
  if (year >= 2018) return 0.82;
  if (year >= 2016) return 0.70;
  if (year >= 2014) return 0.56;
  if (year >= 2012) return 0.44;
  return 0.3;
}

// RTX 4090 anchor = compute_score 100.  shaders(16384) × clock(2235) × eff(1.0)
const GPU_ANCHOR = 16384 * 2235 * 1.0;

function gpuBrand(name) {
  const n = name.toLowerCase();
  if (/radeon|\brx ?\d|firepro|\bvega\b/.test(n)) return "amd";
  if (/arc |intel|\bdg2\b/.test(n)) return "intel";
  return "nvidia";
}

function parseMemory(mem = "") {
  // e.g. "24 GB, GDDR6X, 384 bit"
  const parts = mem.split(",").map((p) => p.trim());
  let vram_mb = 0;
  const sizeM = parts[0]?.match(/([\d.]+)\s*(GB|MB|KB)/i);
  if (sizeM) {
    const v = parseFloat(sizeM[1]);
    const unit = sizeM[2].toUpperCase();
    vram_mb = unit === "GB" ? v * 1024 : unit === "MB" ? v : 0;
  }
  const type = (parts[1] || "").toUpperCase().replace(/\s+/g, "");
  const busM = mem.match(/(\d+)\s*bit/i);
  const bus_bits = busM ? parseInt(busM[1], 10) : 0;
  return { vram_mb: Math.round(vram_mb), type, bus_bits };
}

function buildGPU(r) {
  const [, name, chip, released, , memory, gpuClockRaw, memClockRaw, shadersRaw] = r;
  if (!name) return null;

  const shaders = parseInt((shadersRaw || "").split("/")[0]?.trim() || "0", 10);
  const gpu_clock = parseInt((gpuClockRaw || "").match(/\d+/)?.[0] || "0", 10);
  const mem_clock = parseInt((memClockRaw || "").match(/\d+/)?.[0] || "0", 10);
  const { vram_mb, type, bus_bits } = parseMemory(memory);
  const year = parseYear(released);

  // Gaming-relevant filter: discrete cards with real shaders + VRAM, 2012+.
  if (!shaders || vram_mb < 1024 || year < 2012 || !gpu_clock) return null;
  // Drop pro/compute-only & oddities that aren't consumer gaming parts.
  if (/quadro|firepro|tesla|instinct|\bcmp\b|mining|arctic sound/i.test(name)) return null;

  const eff = eraEfficiency(year);
  const compute_score = Math.round((shaders * gpu_clock * eff) / GPU_ANCHOR * 100);

  const mult = MEM_MULT[type] ?? 4;
  const bw =
    bus_bits && mem_clock
      ? Math.round((mem_clock * (bus_bits / 8) * mult) / 1000)
      : 0;

  const brand = gpuBrand(name);
  return {
    id: slugify(name),
    brand,
    label: brand === "nvidia" ? `NVIDIA ${name}` : brand === "amd" ? `AMD ${name}` : `Intel ${name}`,
    vram_mb,
    memory_bandwidth_gbps: bw || Math.round(compute_score * 6), // crude fallback
    compute_score: Math.max(1, compute_score),
    raster_score: Math.max(1, compute_score + (brand !== "nvidia" ? 2 : 0)),
    architecture: (chip || "unknown").trim(),
    released_year: year,
    estimated: true,
  };
}

// ─── CPU conversion ───────────────────────────────────────────────────────────
function cpuBrand(name) {
  const n = name.toLowerCase();
  if (/ryzen|athlon|threadripper|\bfx\b|\bepyc\b|phenom|sempron|\ba\d{1,2}-/.test(n)) return "amd";
  return "intel";
}

// Estimated IPC tier (1–10) by architecture codename, fallback by year.
const CPU_CODENAME_TIER = {
  // AMD
  raphael: 9, granit14: 10, "granite ridge": 10, vermeer: 8, matisse: 7,
  zen2: 7, "pinnacle ridge": 6, "summit ridge": 5, "raven ridge": 5,
  // Intel
  "raptor lake": 9, "raptor lake-s": 9, "alder lake": 8, "alder lake-s": 8,
  "rocket lake": 7, "comet lake": 7, "coffee lake": 6, "kaby lake": 5,
  skylake: 5, "broadwell": 4, haswell: 4, "ivy bridge": 3, "sandy bridge": 3,
};

function ipcTierFor(codename, year) {
  const key = (codename || "").toLowerCase().trim();
  if (CPU_CODENAME_TIER[key] != null) return CPU_CODENAME_TIER[key];
  if (year >= 2023) return 9;
  if (year >= 2021) return 8;
  if (year >= 2019) return 7;
  if (year >= 2017) return 6;
  if (year >= 2015) return 5;
  if (year >= 2013) return 4;
  if (year >= 2011) return 3;
  return 2;
}

function buildCPU(r) {
  const [, name, codename, coresRaw, clockRaw, , process, , , release] = r;
  if (!name || !coresRaw || !clockRaw) return null;

  const coreParts = coresRaw.split("/").map((x) => parseInt(x.trim(), 10));
  const cores_physical = coreParts[0] || 0;
  const cores_logical = coreParts[1] || cores_physical;

  const clocks = (clockRaw.match(/[\d.]+/g) || []).map(Number);
  if (!cores_physical || !clocks.length) return null;
  const base_clock_ghz = clocks[0];
  const boost_clock_ghz = clocks[clocks.length - 1];

  const year = parseYear(release);
  if (year && year < 2011) return null;

  const ipc_tier = ipcTierFor(codename, year);
  const game_score = Math.round(
    Math.max(0, Math.min(100, ipc_tier * 8 + boost_clock_ghz * 6 + cores_physical * 2.5)),
  );

  return {
    id: slugify(name),
    brand: cpuBrand(name),
    label: name,
    cores_physical,
    cores_logical,
    base_clock_ghz,
    boost_clock_ghz,
    ipc_tier,
    game_score,
    estimated: true,
  };
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function convert(file, builder) {
  const rows = parseCSV(readFileSync(join(ROOT, "archive", file), "utf8"));
  rows.shift(); // header
  const seen = new Set();
  const out = [];
  let skipped = 0;
  for (const r of rows) {
    const item = builder(r);
    if (!item) { skipped++; continue; }
    const key = normName(item.label);
    if (seen.has(key)) { skipped++; continue; } // dedupe — first occurrence wins
    seen.add(key);
    out.push(item);
  }
  out.sort((a, b) => b.released_year - a.released_year || a.label.localeCompare(b.label));
  return { out, skipped, total: rows.length };
}

mkdirSync(OUT_DIR, { recursive: true });

const gpu = convert("tpu_gpus.csv", buildGPU);
writeFileSync(join(OUT_DIR, "gpu-archive.json"), JSON.stringify(gpu.out));
console.log(`GPU: ${gpu.out.length} kept / ${gpu.total} rows (${gpu.skipped} skipped)`);

const cpu = convert("tpu_cpus.csv", buildCPU);
writeFileSync(join(OUT_DIR, "cpu-archive.json"), JSON.stringify(cpu.out));
console.log(`CPU: ${cpu.out.length} kept / ${cpu.total} rows (${cpu.skipped} skipped)`);
