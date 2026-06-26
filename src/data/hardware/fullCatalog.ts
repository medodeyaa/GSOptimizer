/**
 * fullCatalog.ts
 *
 * Builds complete GPU and CPU catalogs by merging CSV-parsed entries
 * with hand-tuned entries (hand-tuned always win on exact label match).
 *
 * Sort order in the combined list:
 *   1. Hand-tuned entries — highest score first (appear at top of search)
 *   2. CSV-only entries   — alphabetically within brand/arch group
 */

import type { GPU, CPU } from "../types";
import { GPU_CATALOG } from "./gpu";
import { CPU_CATALOG } from "./cpu";
import { parseGPUsFromCSV, parseCPUsFromCSV } from "./csvParser";

// ─── GPU catalog ─────────────────────────────────────────────────────────────

function buildFullGPUCatalog(): GPU[] {
  const csvEntries = parseGPUsFromCSV();

  // Key: normalised label → entry
  const map = new Map<string, GPU>();

  // 1. Insert all CSV entries first
  for (const g of csvEntries) {
    map.set(g.label.toLowerCase(), g);
  }

  // 2. Overwrite with hand-tuned entries (accurate scores)
  for (const g of GPU_CATALOG) {
    map.set(g.label.toLowerCase(), g);
  }

  const handIds = new Set(GPU_CATALOG.map((g) => g.id));
  const all = [...map.values()];

  return all.sort((a, b) => {
    const aH = handIds.has(a.id);
    const bH = handIds.has(b.id);
    if (aH !== bH) return aH ? -1 : 1;
    // Both hand-tuned: highest score first
    if (aH) return b.compute_score - a.compute_score;
    // Both CSV: sort by brand then label
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return a.label.localeCompare(b.label);
  });
}

// ─── CPU catalog ─────────────────────────────────────────────────────────────

function buildFullCPUCatalog(): CPU[] {
  const csvEntries = parseCPUsFromCSV();

  const map = new Map<string, CPU>();

  for (const c of csvEntries) {
    map.set(c.label.toLowerCase(), c);
  }

  for (const c of CPU_CATALOG) {
    map.set(c.label.toLowerCase(), c);
  }

  const handIds = new Set(CPU_CATALOG.map((c) => c.id));
  const all = [...map.values()];

  return all.sort((a, b) => {
    const aH = handIds.has(a.id);
    const bH = handIds.has(b.id);
    if (aH !== bH) return aH ? -1 : 1;
    if (aH) return b.game_score - a.game_score;
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return a.label.localeCompare(b.label);
  });
}

// ─── Singleton catalogs ───────────────────────────────────────────────────────

export const FULL_GPU_CATALOG: GPU[] = buildFullGPUCatalog();
export const FULL_CPU_CATALOG: CPU[] = buildFullCPUCatalog();

// ─── Lookup helpers used by ConfigurePage ────────────────────────────────────

/** Fast lookup by id across the full combined GPU catalog. */
export function findGPUById(id: string): GPU | null {
  return FULL_GPU_CATALOG.find((g) => g.id === id) ?? null;
}

/** Fast lookup by id across the full combined CPU catalog. */
export function findCPUById(id: string): CPU | null {
  return FULL_CPU_CATALOG.find((c) => c.id === id) ?? null;
}

/** True if this GPU id came from the hand-tuned catalog (very accurate scores). */
const _handGPU = new Set(GPU_CATALOG.map((g) => g.id));
export function isHandTunedGPU(id: string): boolean { return _handGPU.has(id); }

/** True if this CPU id came from the hand-tuned catalog. */
const _handCPU = new Set(CPU_CATALOG.map((c) => c.id));
export function isHandTunedCPU(id: string): boolean { return _handCPU.has(id); }

// ─── Tier classification helpers (used by UI) ─────────────────────────────────

/**
 * Returns "flagship" | "mid" | "entry" for a GPU based on its compute_score
 * and name keywords.  Used by ConfigurePage to show tier badge next to the
 * selected GPU.
 */
export function gpuTier(gpu: GPU): "flagship" | "mid" | "entry" {
  const n = gpu.label.toLowerCase();
  if (
    gpu.compute_score >= 68 ||
    /titan|quadro rtx [4-8]|rtx a[456]|3090|7900 xtx|7900 xt$|6900|instinct|tesla v100|h100|h800|a100|a40|l40/.test(n)
  ) return "flagship";
  if (gpu.compute_score >= 26) return "mid";
  return "entry";
}

/**
 * Returns "flagship" | "mid" | "entry" for a CPU.
 */
export function cpuTier(cpu: CPU): "flagship" | "mid" | "entry" {
  const n = cpu.label.toLowerCase();
  if (/epyc|threadripper|xeon platinum|xeon gold|i9-|ryzen 9|knights/.test(n)) return "flagship";
  if (/i7-|ryzen 7|xeon silver|xeon w-|xeon e5-2[6-9]|xeon e7|fx-[89]/.test(n)) return "mid";
  if (/i5-|ryzen 5|fx-[0-6]|phenom ii x[34]/.test(n)) return "mid";
  return "entry";
}
