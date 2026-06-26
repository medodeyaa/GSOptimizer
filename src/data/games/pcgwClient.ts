/**
 * pcgwClient.ts  –  live PCGamingWiki enrichment (real published requirements)
 *
 * Complements the CSV/genre heuristic in gamesParser.ts. When a user selects a
 * game, we try to pull its *real* minimum/recommended system requirements from
 * PCGamingWiki and turn them into a GameDefinition. If the game isn't on the
 * wiki, has no requirements block, or we're offline, the caller keeps the CSV
 * estimate — the two data sources are complementary, never exclusive.
 *
 * ── Why this works from the browser ───────────────────────────────────────────
 *   • PCGamingWiki is a public MediaWiki — no API key, no auth.
 *   • api.php supports anonymous CORS via &origin=* (verified), so fetch() works
 *     directly from the SPA with no proxy.
 *   • Rate limit is 30 req/min; one selection = one request, and results are
 *     cached in localStorage, so we stay far under it.
 *
 * ── Pipeline ──────────────────────────────────────────────────────────────────
 *   title ──► resolve page + fetch wikitext (action=query&redirects=1)
 *          ──► parseSystemRequirements()      raw {{System requirements}} fields
 *          ──► requirementsToDemand()         real specs → 0–1 gpu/cpu demand
 *          ──► buildDefinitionFromDemand()    (shared with the CSV path)
 *
 * The hardware-name → score mapping reuses the scored entries already in
 * FULL_GPU_CATALOG / FULL_CPU_CATALOG, so a game that recommends an RTX 4080 is
 * correctly treated as far heavier than one recommending a GTX 660 — and the
 * score is normalised against the top card of the game's release year so old
 * games aren't unfairly rated "light" just for naming an old GPU.
 */

import type { GameDefinition, GameRequirements } from "../types";
import { FULL_GPU_CATALOG, FULL_CPU_CATALOG } from "../hardware/fullCatalog";
import { buildDefinitionFromDemand, eraDemandFactor, type DemandInput } from "./gamesParser";

const API = "https://www.pcgamingwiki.com/w/api.php";
const CACHE_PREFIX = "pcgw:v1:";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ─── 1. Requirements-template parsing (pure) ──────────────────────────────────

/** "6 GB" → 6144, "512 MB" → 512, "2gb" → 2048. Returns undefined if unparsable. */
export function parseMB(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*(g|m)\s*b?/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return undefined;
  return Math.round(m[2].toLowerCase() === "g" ? v * 1024 : v);
}

/** Strip wiki noise: {{note|…}}, [[link|text]], <ref>…</ref>, html, refs. */
function cleanValue(s: string): string {
  return s
    .replace(/\{\{note\|[^}]*\}\}/gi, "")
    .replace(/<ref[^>]*>.*?<\/ref>/gis, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[A|B]] → B, [[A]] → A
    .replace(/'''?/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the fields of the first {{System requirements}} template from raw
 * page wikitext. Returns null when there's no requirements block at all.
 */
export function parseSystemRequirements(wikitext: string): GameRequirements | null {
  const start = wikitext.search(/\{\{\s*System requirements/i);
  if (start === -1) return null;

  // Walk forward to the matching "}}" (templates here don't nest the closer in
  // a way the simple field regex below can't tolerate, but bound the slice).
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const block = wikitext.slice(start, end);

  const fields: Record<string, string> = {};
  // | key = value   (PCGW puts one field per line; capture to end-of-line so a
  // pipe inside an inline template like {{note|…}} doesn't truncate the value).
  const re = /\n\s*\|\s*([A-Za-z0-9]+)\s*=\s*([^\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const val = cleanValue(m[2]);
    if (val) fields[key] = val;
  }

  const pick = (...keys: string[]) => {
    for (const k of keys) if (fields[k]) return fields[k];
    return undefined;
  };

  const req: GameRequirements = {
    os: pick("recOS", "minOS", "OSfamily"),
    minCPU: pick("minCPU"),
    recCPU: pick("recCPU"),
    minGPU: pick("minGPU"),
    recGPU: pick("recGPU"),
    minRAM_mb: parseMB(pick("minRAM")),
    recRAM_mb: parseMB(pick("recRAM")),
    minVRAM_mb: parseMB(pick("minVRAM")),
    recVRAM_mb: parseMB(pick("recVRAM")),
  };

  // Require at least one usable hardware signal, else treat as "no real data".
  if (!req.minCPU && !req.recCPU && !req.minGPU && !req.recGPU && !req.recVRAM_mb && !req.minVRAM_mb) {
    return null;
  }
  return req;
}

// ─── 2. Hardware-name → catalog score matching ────────────────────────────────

const VENDOR_NOISE = /\b(nvidia|amd|ati|intel|geforce|radeon|graphics|series|gpu|cpu|processor|core|edition|gb|or|equivalent|better|higher|class|video card|with|support)\b/gi;

function normHw(s: string): string {
  return s.toLowerCase().replace(/®|™|\(r\)|\(tm\)/g, "").replace(VENDOR_NOISE, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Build a normalized token index over a catalog once. */
function buildIndex<T extends { label: string }>(catalog: T[]) {
  return catalog.map((entry) => ({ entry, norm: normHw(entry.label), tokens: new Set(normHw(entry.label).split(" ").filter(Boolean)) }));
}
let _gpuIndex: ReturnType<typeof buildIndex<typeof FULL_GPU_CATALOG[number]>> | null = null;
let _cpuIndex: ReturnType<typeof buildIndex<typeof FULL_CPU_CATALOG[number]>> | null = null;

/** Best-effort fuzzy match of a requirement string to a scored catalog entry. */
function matchScore<T extends { label: string }>(
  index: ReturnType<typeof buildIndex<T>>,
  raw: string | undefined,
  score: (e: T) => number
): number | undefined {
  if (!raw) return undefined;
  // PCGW often lists alternatives: "GTX 660 / Radeon HD 7870" → take the first.
  const name = normHw(raw.split(/\s*[/,]|\bor\b/i)[0] || raw);
  if (!name) return undefined;
  const want = new Set(name.split(" ").filter(Boolean));
  if (want.size === 0) return undefined;

  let best: { score: number; overlap: number } | null = null;
  for (const row of index) {
    let overlap = 0;
    for (const t of want) if (row.tokens.has(t)) overlap++;
    // Require a model-number-ish overlap: at least 2 shared tokens, or the full
    // requirement name appearing inside the catalog label.
    const strong = overlap >= 2 || row.norm.includes(name);
    if (!strong) continue;
    const ratio = overlap / want.size;
    if (!best || ratio > best.overlap) best = { score: score(row.entry), overlap: ratio };
  }
  return best ? best.score : undefined;
}

// ─── 3. Requirements → demand ─────────────────────────────────────────────────
//
// compute_score is normalised so the RTX 4090 (2022) ≈ 100. The "top card" of
// any given year is a moving target, so we normalise a recommended GPU's score
// against an era reference: recommending the best card of your year ⇒ demand ~1;
// recommending a mid card ⇒ ~0.5. This keeps a 2013 game that names a 2013-era
// GPU from being mis-scored as trivially light.

const ERA_TOP_GPU: [number, number][] = [
  [2008, 4], [2010, 6], [2012, 9], [2014, 13], [2016, 20],
  [2018, 33], [2020, 55], [2022, 100], [2024, 118], [2026, 130],
];

function eraTopGpuScore(year: number): number {
  const pts = ERA_TOP_GPU;
  if (year <= pts[0][0]) return pts[0][1];
  if (year >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (year <= pts[i][0]) {
      const [y0, s0] = pts[i - 1], [y1, s1] = pts[i];
      return s0 + ((s1 - s0) * (year - y0)) / (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Turn parsed requirements into a 0–1 (gpu, cpu) demand pair, falling back to
 * the supplied genre-derived demand for whichever side can't be matched.
 */
export function requirementsToDemand(
  req: GameRequirements,
  year: number,
  fallback: { gpu: number; cpu: number }
): { gpu: number; cpu: number } {
  _gpuIndex ??= buildIndex(FULL_GPU_CATALOG);
  _cpuIndex ??= buildIndex(FULL_CPU_CATALOG);

  // GPU: prefer the recommended card; if only minimum is listed, scale it up
  // (recommended is typically ~1.6× the minimum tier).
  let recGpu = matchScore(_gpuIndex, req.recGPU, (g) => g.compute_score);
  if (recGpu === undefined) {
    const minGpu = matchScore(_gpuIndex, req.minGPU, (g) => g.compute_score);
    if (minGpu !== undefined) recGpu = minGpu * 1.6;
  }
  let gpu = fallback.gpu;
  if (recGpu !== undefined) {
    gpu = clamp(0.12 + 0.92 * (recGpu / eraTopGpuScore(year)), 0.1, 1);
  }

  // CPU: game_score is far less era-spread than GPU compute, and older CPUs
  // already carry lower scores, so a direct normalisation + blend with the
  // genre fallback is steadier than another era table.
  let recCpu = matchScore(_cpuIndex, req.recCPU, (c) => c.game_score);
  if (recCpu === undefined) {
    const minCpu = matchScore(_cpuIndex, req.minCPU, (c) => c.game_score);
    if (minCpu !== undefined) recCpu = minCpu * 1.3;
  }
  let cpu = fallback.cpu;
  if (recCpu !== undefined) {
    const fromSpec = clamp(0.25 + recCpu / 110, 0.1, 1);
    cpu = clamp(0.5 * fromSpec + 0.5 * fallback.cpu, 0.1, 1);
  }

  return { gpu, cpu };
}

// ─── 4. Networked fetch + cache ───────────────────────────────────────────────

interface CacheEntry {
  // `null` = confirmed "no real data on the wiki" (negative cache, so we don't refetch).
  requirements: GameRequirements | null;
  ts: number;
}

function readCache(label: string): CacheEntry | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + label.toLowerCase());
    return raw ? (JSON.parse(raw) as CacheEntry) : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(label: string, requirements: GameRequirements | null) {
  try {
    localStorage.setItem(CACHE_PREFIX + label.toLowerCase(), JSON.stringify({ requirements, ts: Date.now() } satisfies CacheEntry));
  } catch {
    /* localStorage full / unavailable — non-fatal, we just refetch next time. */
  }
}

/** Fetch + parse the requirements for a title (cached). null = no real data. */
async function fetchRequirements(label: string): Promise<GameRequirements | null> {
  const cached = readCache(label);
  if (cached) return cached.requirements;

  const url =
    `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&redirects=1&format=json&origin=*&titles=${encodeURIComponent(label)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`PCGW ${res.status}`);
  const data = await res.json();

  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as
    | { missing?: string; revisions?: { slots?: { main?: { "*"?: string } } }[] }
    | undefined;
  const wikitext = page?.revisions?.[0]?.slots?.main?.["*"];

  const requirements = wikitext ? parseSystemRequirements(wikitext) : null;
  writeCache(label, requirements);
  return requirements;
}

/**
 * Try to build a real-data GameDefinition for a game from PCGamingWiki.
 * Returns null when the wiki has no usable requirements (caller keeps the CSV
 * estimate). Network/parse errors are swallowed → null, so enrichment can never
 * break selection.
 *
 * @param base    identity + engine + year (from the CSV listing)
 * @param fallback genre-derived demand to use for any spec we can't match
 */
export async function fetchPcgwDefinition(
  base: Omit<DemandInput, "gpu_demand" | "cpu_demand">,
  fallback: { gpu: number; cpu: number }
): Promise<GameDefinition | null> {
  try {
    const req = await fetchRequirements(base.label);
    if (!req) return null;

    const demand = requirementsToDemand(req, base.year, fallback);
    const era = eraDemandFactor(base.year);
    const base_vram_mb = req.recVRAM_mb ?? (req.minVRAM_mb ? Math.round(req.minVRAM_mb * 1.4) : undefined);

    return buildDefinitionFromDemand(
      { ...base, gpu_demand: demand.gpu * era, cpu_demand: demand.cpu * era },
      { specSource: "pcgw", requirements: req, base_vram_mb }
    );
  } catch {
    return null;
  }
}
