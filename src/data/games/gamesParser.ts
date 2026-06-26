/**
 * gamesParser.ts  –  CSV → GameDefinition converter (estimated specs)
 *
 * Turns every row of the trimmed backloggd PC-games dump (games.csv, produced
 * by scripts/gen-games.mjs) into a fully-scored GameDefinition the optimization
 * engine can consume.
 *
 * ⚠️  ESTIMATED DATA — NOT BENCHMARK-GRADE
 * The source dump carries no hardware/performance figures, only metadata
 * (developer, genre, release year, popularity). Every performance number below
 * is *derived* from that metadata with the heuristics documented inline. They
 * are intended to be "accurate, not perfect": good enough to rank settings and
 * estimate bottlenecks, but the 8 hand-tuned games in this folder always
 * override their generated counterparts (see index.ts).
 *
 * ── Derivation pipeline ───────────────────────────────────────────────────────
 *   developer / franchise  ──► engine                 (inferEngine)
 *   genres                 ──► gpu_demand, cpu_demand  (genreDemand)   0–1 each
 *   release year           ──► asset/era scale         (yearScale)
 *   (demand, year)         ──► base_vram, baselines, cpu_weight
 *   (demand, year, vram)   ──► per-setting tier tables  (buildSettings)
 *
 * Listings (id/label/engine/genre) are built eagerly and cheaply for the
 * dropdown; the heavy per-setting tier tables are built lazily on first
 * selection and cached.
 */

import type {
  GameDefinition,
  SettingDefinition,
  QualityTier,
  SettingCategory,
  PrimaryResource,
} from "../types";

import rawGames from "./games.csv?raw";

// ─── Public listing type (lightweight — for the picker dropdown) ──────────────

export interface GameListing {
  id: string;
  label: string;
  engine: string;
  /** Primary genre, used as the dropdown group header. */
  genre: string;
  year: number;
  plays: number;
}

// ─── Internal per-game metadata (parsed once) ─────────────────────────────────

export interface GameMeta {
  id: string;
  label: string;
  engine: string;
  genres: string[];
  genre: string;
  year: number;
  plays: number;
  gpu_demand: number; // 0–1
  cpu_demand: number; // 0–1
}

// ─── CSV line parser (quote-aware) ────────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) { fields.push(cur); cur = ""; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function toId(name: string, seen: Map<string, number>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "game";
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}_${count}`;
}

// ─── Engine inference ─────────────────────────────────────────────────────────
//
// Studio / publisher / franchise → engine. Most rows resolve via developer; the
// rest fall back to an era + scale heuristic (big-budget unknowns are almost
// always Unreal these days; small indies are almost always Unity).

interface EngineRule { re: RegExp; engine: string; }

const FRANCHISE_ENGINES: EngineRule[] = [
  { re: /elden ring|dark souls|sekiro|bloodborne|armored core|demon's souls/, engine: "From Engine" },
  { re: /grand theft auto|red dead|max payne 3|gta/, engine: "RAGE" },
  { re: /the witcher|cyberpunk/, engine: "REDengine" },
  { re: /counter-strike|half-life|portal|left 4 dead|dota|team fortress/, engine: "Source" },
  { re: /the elder scrolls|fallout|starfield/, engine: "Creation Engine" },
  { re: /assassin's creed|far cry|watch dogs|rainbow six/, engine: "AnvilNext / Dunia" },
  { re: /battlefield|need for speed|dragon age|mass effect|fifa|madden/, engine: "Frostbite" },
  { re: /resident evil|devil may cry|monster hunter|street fighter/, engine: "RE Engine" },
  { re: /call of duty|modern warfare|warzone/, engine: "IW Engine" },
  { re: /doom|quake|wolfenstein|rage/, engine: "id Tech" },
  { re: /minecraft/, engine: "Bedrock / Java" },
  { re: /final fantasy xv|forspoken/, engine: "Luminous" },
];

const STUDIO_ENGINES: EngineRule[] = [
  { re: /fromsoftware/, engine: "From Engine" },
  { re: /rockstar/, engine: "RAGE" },
  { re: /cd projekt/, engine: "REDengine" },
  { re: /\bvalve\b/, engine: "Source" },
  { re: /bethesda/, engine: "Creation Engine" },
  { re: /ubisoft/, engine: "AnvilNext / Dunia" },
  { re: /\bdice\b|electronic arts|ea \b/, engine: "Frostbite" },
  { re: /capcom/, engine: "RE Engine" },
  { re: /id software/, engine: "id Tech" },
  { re: /infinity ward|treyarch|sledgehammer/, engine: "IW Engine" },
  { re: /epic games|people can fly/, engine: "Unreal Engine" },
  { re: /unity technologies/, engine: "Unity" },
  { re: /croteam/, engine: "Serious Engine" },
  { re: /crytek/, engine: "CryEngine" },
  { re: /\b4a games\b/, engine: "4A Engine" },
  { re: /remedy/, engine: "Northlight" },
  { re: /guerrilla|naughty dog|insomniac|santa monica/, engine: "Proprietary (Sony)" },
];

function inferEngine(title: string, developers: string, genres: string[], year: number): string {
  const t = title.toLowerCase();
  for (const r of FRANCHISE_ENGINES) if (r.re.test(t)) return r.engine;

  const d = developers.toLowerCase();
  for (const r of STUDIO_ENGINES) if (r.re.test(d)) return r.engine;

  // Fallback by scale + era.
  const indie = genres.some((g) => /indie/i.test(g));
  if (indie) return year >= 2014 ? "Unity" : "Custom 2D";
  if (genres.some((g) => /visual novel|card|quiz/i.test(g))) return "Custom 2D";
  if (year >= 2014) return "Unreal Engine";
  if (year >= 2006) return "Proprietary";
  return "Legacy Engine";
}

// ─── Demand model ─────────────────────────────────────────────────────────────
//
// Each genre carries a (gpu, cpu) demand weight in 0–1. A game's demand is the
// max across its genres (its most demanding facet) nudged toward the average so
// a single light tag doesn't fully cancel a heavy one.

const GENRE_DEMAND: Record<string, [number, number]> = {
  "shooter":              [0.82, 0.70],
  "rpg":                  [0.78, 0.74],
  "adventure":            [0.70, 0.55],
  "simulator":            [0.58, 0.82],
  "strategy":             [0.50, 0.86],
  "real time strategy":   [0.56, 0.90],
  "turn based strategy":  [0.44, 0.80],
  "tactical":             [0.55, 0.70],
  "moba":                 [0.50, 0.66],
  "racing":               [0.76, 0.58],
  "sport":                [0.66, 0.58],
  "fighting":             [0.56, 0.50],
  "brawler":              [0.55, 0.50],
  "platform":             [0.36, 0.36],
  "puzzle":               [0.26, 0.30],
  "indie":                [0.42, 0.42],
  "arcade":               [0.36, 0.36],
  "music":                [0.40, 0.40],
  "point-and-click":      [0.30, 0.30],
  "card & board game":    [0.20, 0.24],
  "visual novel":         [0.16, 0.20],
  "quiz/trivia":          [0.16, 0.20],
  "pinball":              [0.30, 0.30],
};

// Genres that signal a small-scope / typically-2D production. When a game is
// tagged "Indie" together with one of these, its real hardware needs are far
// below what a literal reading of its RPG/Strategy/Shooter tags would imply
// (e.g. Stardew Valley is tagged RPG+Simulator+Strategy but is a tiny 2D game).
const LIGHT_GENRES = new Set([
  "platform", "puzzle", "arcade", "card & board game", "visual novel",
  "quiz/trivia", "pinball", "point-and-click", "music",
]);

function genreDemand(genres: string[]): { gpu: number; cpu: number } {
  let maxG = 0, maxC = 0, sumG = 0, sumC = 0, n = 0;
  let hasIndie = false, hasLight = false;
  for (const g of genres) {
    const key = g.trim().toLowerCase();
    if (key === "indie") hasIndie = true;
    if (LIGHT_GENRES.has(key)) hasLight = true;
    const w = GENRE_DEMAND[key];
    if (!w) continue;
    maxG = Math.max(maxG, w[0]); maxC = Math.max(maxC, w[1]);
    sumG += w[0]; sumC += w[1]; n++;
  }
  if (n === 0) return { gpu: 0.45, cpu: 0.45 }; // unknown genre → modest default

  // Blend toward the average so one heavy tag can't dominate a light game;
  // the peak still pulls it up a bit.
  let gpu = 0.4 * maxG + 0.6 * (sumG / n);
  let cpu = 0.4 * maxC + 0.6 * (sumC / n);

  // Damping for small-scope productions.
  if (hasIndie) { gpu *= 0.6; cpu *= 0.65; }
  if (hasLight && (hasIndie || maxG < 0.6)) { gpu *= 0.6; cpu *= 0.7; }

  return { gpu: clamp(gpu, 0.08, 1), cpu: clamp(cpu, 0.08, 1) };
}

/** Asset/era scale: newer games ship heavier assets and demand more VRAM/GPU. */
function yearScale(year: number): number {
  if (year >= 2023) return 1.15;
  if (year >= 2020) return 1.00;
  if (year >= 2017) return 0.82;
  if (year >= 2014) return 0.64;
  if (year >= 2011) return 0.48;
  if (year >= 2008) return 0.32;
  if (year >= 2004) return 0.18;
  if (year >= 2000) return 0.10;
  return 0.05;
}

/**
 * Era attenuation for genre-derived demand.
 *
 * Genre demand has NO sense of time: "Shooter; Racing; Adventure" yields the
 * same ~0.78 GPU demand whether the game is GTA: San Andreas (2004) or a 2020
 * AAA title. But demand here is measured against *modern* reference hardware
 * (RTX 4090 = 100), and a 2004 game is trivial for it — so an old game's real
 * demand on today's GPUs is a fraction of its genre's. Without this, a flagship
 * was predicting ~30 FPS in San Andreas at 4K/max.
 *
 * Modern games (2022+) are unaffected (factor 1.0); older games are scaled down
 * toward their true difficulty. Only applied to the CSV genre heuristic — the
 * PCGamingWiki path derives demand from era-appropriate published requirements
 * and must not be attenuated again.
 */
export function eraDemandFactor(year: number): number {
  if (year >= 2022) return 1.00;
  if (year >= 2019) return 0.92;
  if (year >= 2016) return 0.80;
  if (year >= 2013) return 0.66;
  if (year >= 2010) return 0.52;
  if (year >= 2007) return 0.40;
  if (year >= 2004) return 0.30;
  if (year >= 2000) return 0.22;
  return 0.16;
}

// ─── Settings template builder ────────────────────────────────────────────────
//
// A 9-setting template (matches the hand-tuned games' structure). Per-tier base
// numbers are scaled by the game's demand + era so a 2023 open-world RPG gets
// far steeper costs than a 2010 indie platformer, while staying monotonic in
// vram_delta and with fps_multiplier always in (0, 1].

interface TierSpec {
  label: string;
  vram: number;        // base vram_delta (MB) before scaling
  gpu: number;         // base gpu_load_delta
  cpu: number;         // base cpu_load_delta
  quality: number;     // 0–100
  drop: number;        // base fps drop (1 - fps_multiplier) before scaling
}

interface SettingSpec {
  id: string;
  label: string;
  category: SettingCategory;
  primary: PrimaryResource;
  tiers: TierSpec[];
}

// Standard 4-step quality ramp and a 4-step on/off ramp.
const Q4 = [20, 52, 78, 100];
const Q_TOGGLE = [0, 45, 75, 100];

function ramp(labels: string[], vram: number[], gpu: number[], cpu: number[], quality: number[], drop: number[]): TierSpec[] {
  return labels.map((label, i) => ({
    label, vram: vram[i], gpu: gpu[i], cpu: cpu[i], quality: quality[i], drop: drop[i],
  }));
}

const SETTING_TEMPLATE: SettingSpec[] = [
  {
    id: "texture_quality", label: "Texture Quality", category: "texture", primary: "VRAM",
    tiers: ramp(["Low", "Medium", "High", "Maximum"],
      [0, 600, 1500, 2800], [0, 0.008, 0.018, 0.03], [0, 0, 0, 0], Q4, [0, 0.02, 0.04, 0.065]),
  },
  {
    id: "shadow_quality", label: "Shadow Quality", category: "shadow", primary: "GPU_COMPUTE",
    tiers: ramp(["Low", "Medium", "High", "Maximum"],
      [0, 60, 140, 260], [0.01, 0.04, 0.085, 0.14], [0.02, 0.05, 0.09, 0.14], Q4, [0, 0.05, 0.11, 0.18]),
  },
  {
    id: "lighting_quality", label: "Lighting Quality", category: "lighting", primary: "GPU_COMPUTE",
    tiers: ramp(["Low", "Medium", "High", "Maximum"],
      [0, 40, 90, 160], [0, 0.03, 0.07, 0.12], [0, 0.005, 0.01, 0.015], Q4, [0, 0.035, 0.075, 0.125]),
  },
  {
    id: "effects_quality", label: "Effects Quality", category: "effects", primary: "GPU_COMPUTE",
    tiers: ramp(["Low", "Medium", "High", "Maximum"],
      [0, 30, 65, 110], [0, 0.025, 0.055, 0.09], [0.01, 0.02, 0.035, 0.055], Q4, [0, 0.03, 0.062, 0.1]),
  },
  {
    id: "geometry_quality", label: "Geometry / Draw Distance", category: "geometry", primary: "CPU",
    tiers: ramp(["Low", "Medium", "High", "Maximum"],
      [0, 60, 150, 280], [0.01, 0.035, 0.07, 0.115], [0.025, 0.065, 0.115, 0.175], Q4, [0, 0.04, 0.088, 0.148]),
  },
  {
    id: "ambient_occlusion", label: "Ambient Occlusion", category: "lighting", primary: "GPU_COMPUTE",
    tiers: ramp(["Off", "Low", "High", "Maximum"],
      [0, 20, 45, 70], [0, 0.025, 0.055, 0.09], [0, 0, 0, 0.005], Q_TOGGLE, [0, 0.032, 0.065, 0.1]),
  },
  {
    id: "anti_aliasing", label: "Anti-Aliasing", category: "antialiasing", primary: "GPU_COMPUTE",
    tiers: ramp(["Off", "Low", "High", "Maximum"],
      [0, 20, 40, 80], [0, 0.02, 0.04, 0.08], [0, 0, 0, 0], Q_TOGGLE, [0, 0.025, 0.05, 0.09]),
  },
  {
    id: "post_processing", label: "Post-Processing", category: "postprocess", primary: "GPU_COMPUTE",
    tiers: ramp(["Off", "Low", "High", "Maximum"],
      [0, 15, 30, 50], [0, 0.015, 0.035, 0.06], [0, 0, 0, 0], Q_TOGGLE, [0, 0.018, 0.04, 0.068]),
  },
  {
    id: "motion_blur", label: "Motion Blur", category: "postprocess", primary: "GPU_COMPUTE",
    tiers: ramp(["Off", "Low", "High", "Maximum"],
      [0, 10, 20, 35], [0, 0.01, 0.025, 0.045], [0, 0, 0, 0], Q_TOGGLE, [0, 0.012, 0.028, 0.048]),
  },
];

function buildSettings(gpu_demand: number, cpu_demand: number, vramScale: number): Record<string, SettingDefinition> {
  // Load multipliers: a high-demand game pushes the same setting harder.
  const gpuMul = 0.6 + 0.85 * gpu_demand; // 0.6 … 1.45
  const cpuMul = 0.6 + 0.85 * cpu_demand;

  const out: Record<string, SettingDefinition> = {};
  SETTING_TEMPLATE.forEach((spec, order) => {
    const tiers: QualityTier[] = spec.tiers.map((t, i) => {
      // Drop is scaled by whichever resource the drop mostly comes from (use gpu
      // for visual settings, cpu for geometry); template drops are small enough
      // that scaled drop stays < 1 → fps_multiplier stays in (0, 1].
      const dropMul = spec.primary === "CPU" ? cpuMul : gpuMul;
      const fps_multiplier = clamp(1 - t.drop * dropMul, 0.4, 1);
      return {
        index: i,
        label: t.label,
        vram_delta_mb: Math.round(t.vram * vramScale),
        gpu_load_delta: Math.round(t.gpu * gpuMul * 1000) / 1000,
        cpu_load_delta: Math.round(t.cpu * cpuMul * 1000) / 1000,
        quality_score: t.quality,
        fps_multiplier: Math.round(fps_multiplier * 1000) / 1000,
      };
    });
    out[spec.id] = {
      id: spec.id,
      label: spec.label,
      category: spec.category,
      primary_resource: spec.primary,
      ui_order: order + 1,
      tiers,
    };
  });
  return out;
}

// ─── Parse pass (run once, memoized) ──────────────────────────────────────────

let _metas: GameMeta[] | null = null;
let _byId: Map<string, GameMeta> | null = null;

function parse(): GameMeta[] {
  if (_metas) return _metas;

  const lines = rawGames.split("\n");
  const out: GameMeta[] = [];
  const seenId = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim()) continue;

    const f = parseLine(line);
    const title = (f[0] ?? "").trim();
    if (!title) continue;

    const year = parseInt(f[1] ?? "", 10) || 2010;
    const developers = (f[2] ?? "").trim();
    const genres = (f[3] ?? "").split(";").map((g) => g.trim()).filter(Boolean);
    const plays = parseInt(f[4] ?? "0", 10) || 0;

    const { gpu, cpu } = genreDemand(genres);

    out.push({
      id: toId(title, seenId),
      label: title,
      engine: inferEngine(title, developers, genres, year),
      genres,
      genre: genres[0] ?? "Other",
      year,
      plays,
      gpu_demand: gpu,
      cpu_demand: cpu,
    });
  }

  _metas = out;
  _byId = new Map(out.map((m) => [m.id, m]));
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Lightweight listings for the picker (already most-played-first from the CSV). */
export function parseGameListings(): GameListing[] {
  return parse().map((m) => ({
    id: m.id,
    label: m.label,
    engine: m.engine,
    genre: m.genre,
    year: m.year,
    plays: m.plays,
  }));
}

/** Look up the parsed metadata for one generated game id (fallback demand). */
export function getGameMeta(id: string): GameMeta | undefined {
  if (!_byId) parse();
  return _byId!.get(id);
}

/**
 * The minimum inputs needed to synthesize a GameDefinition: identity + a 0–1
 * gpu/cpu demand pair + release year. The CSV path derives demand from genre;
 * the PCGamingWiki path derives it from real published requirements. Both then
 * funnel through buildDefinitionFromDemand so settings/baselines stay
 * consistent across data sources.
 */
export interface DemandInput {
  id: string;
  label: string;
  engine: string;
  year: number;
  gpu_demand: number; // 0–1
  cpu_demand: number; // 0–1
}

/** Optional real-data overrides applied on top of the demand-derived defaults. */
export interface DefinitionOverrides {
  base_vram_mb?: number;
  specSource?: GameDefinition["specSource"];
  requirements?: GameDefinition["requirements"];
}

/**
 * Synthesize a fully-scored GameDefinition from a demand pair. Shared by the
 * CSV heuristic (buildGeneratedGame) and the PCGamingWiki client (pcgwClient).
 */
export function buildDefinitionFromDemand(
  m: DemandInput,
  overrides: DefinitionOverrides = {}
): GameDefinition {
  const gpu_demand = clamp(m.gpu_demand, 0.08, 1);
  const cpu_demand = clamp(m.cpu_demand, 0.08, 1);
  const era = eraDemandFactor(m.year);
  const ys = yearScale(m.year);

  // We reconstruct the era-relative demand for VRAM calculations
  // because an old game that was era-heavy still used the maximum VRAM of its time.
  const relative_gpu_demand = clamp(gpu_demand / era, 0.08, 1);

  // base_vram: OS/engine baseline that scales with graphical ambition + era.
  // A real published VRAM figure (overrides.base_vram_mb) wins when available.
  const base_vram_mb =
    overrides.base_vram_mb ??
    Math.round(clamp((300 + relative_gpu_demand * 2600) * (0.55 + 0.45 * ys), 250, 4000));

  // Base modern FPS is determined by absolute demand, then inflated by 1/era
  // so older GPUs can achieve playable framerates when scaled.
  const base_gpu_fps = (1 - gpu_demand) * 320 + 110;
  const base_cpu_fps = (1 - cpu_demand) * 300 + 120;

  const gpu_baseline_fps = Math.round(clamp(base_gpu_fps / era, 90, 3000));
  const cpu_baseline_fps = Math.round(clamp(base_cpu_fps / era, 90, 3000));

  const cpu_weight = Math.round(clamp(0.3 + cpu_demand * 0.6, 0.3, 0.95) * 100) / 100;

  // vramScale references the hand-tuned ~1500 MB texture-Max delta as "1.0".
  const vramScale = clamp(base_vram_mb / 1500, 0.35, 2.0);

  return {
    id: m.id,
    label: m.label,
    engine: m.engine,
    base_vram_mb,
    gpu_baseline_fps,
    cpu_baseline_fps,
    cpu_weight,
    resolution_vram_scalars: { "1080p": 1.0, "1440p": 1.28, "2160p": 1.62 },
    settings: buildSettings(gpu_demand, cpu_demand, vramScale),
    specSource: overrides.specSource,
    requirements: overrides.requirements,
  };
}

/** Build the full (estimated) GameDefinition for one id. Cached. */
const _defCache = new Map<string, GameDefinition>();

export function buildGeneratedGame(id: string): GameDefinition | undefined {
  if (_defCache.has(id)) return _defCache.get(id);
  const m = getGameMeta(id);
  if (!m) return undefined;

  // Attenuate genre demand by release era so old games aren't modelled as
  // demanding as modern ones of the same genre (see eraDemandFactor).
  const era = eraDemandFactor(m.year);
  const gpu_demand = clamp(m.gpu_demand * era, 0.08, 1);
  const cpu_demand = clamp(m.cpu_demand * era, 0.08, 1);

  const def = buildDefinitionFromDemand(
    { id: m.id, label: m.label, engine: m.engine, year: m.year, gpu_demand, cpu_demand },
    { specSource: "estimated" }
  );

  _defCache.set(id, def);
  return def;
}
