/**
 * fullCatalog.ts
 *
 * Builds the complete GPU and CPU catalogs by merging:
 *   1. CSV-parsed entries (all valid rows from the archive CSVs)
 *   2. Hand-tuned catalog entries (accurate scores, always take priority)
 *
 * Merge strategy:
 *   - Parse ALL rows from both CSVs, estimate scores from raw specs
 *   - Build a Map keyed by normalised label (lowercase)
 *   - Overwrite any CSV estimate with the hand-tuned entry when names match
 *   - Result: every unique, non-blank entry from the CSVs is selectable;
 *     hand-tuned entries have accurate performance scores for the engine.
 */

import type { GPU, CPU } from "../types";
import { GPU_CATALOG } from "./gpu";
import { CPU_CATALOG } from "./cpu";
import { parseGPUsFromCSV, parseCPUsFromCSV } from "./csvParser";

// ── Build combined GPU catalog ────────────────────────────────────────────────

function buildFullGPUCatalog(): GPU[] {
  // 1. Start with every CSV entry
  const csvEntries = parseGPUsFromCSV();

  // 2. Index by normalised label for O(1) lookup
  const byLabel = new Map<string, GPU>();
  for (const g of csvEntries) {
    byLabel.set(g.label.toLowerCase(), g);
  }

  // 3. Overwrite with hand-tuned entries (accurate scores)
  for (const g of GPU_CATALOG) {
    byLabel.set(g.label.toLowerCase(), g);
  }

  // 4. Also ensure hand-tuned entries that might not match CSV names are included
  const handTunedIds = new Set(GPU_CATALOG.map((g) => g.id));
  for (const g of GPU_CATALOG) {
    if (!byLabel.has(g.label.toLowerCase())) {
      byLabel.set(g.label.toLowerCase(), g);
    }
  }

  // 5. Return sorted: hand-tuned first (they have higher scores), then rest
  const all = [...byLabel.values()];
  return all.sort((a, b) => {
    const aHand = handTunedIds.has(a.id);
    const bHand = handTunedIds.has(b.id);
    if (aHand && !bHand) return -1;
    if (!aHand && bHand) return 1;
    // Within hand-tuned: highest score first
    if (aHand && bHand) return b.compute_score - a.compute_score;
    // Within CSV: alphabetical
    return a.label.localeCompare(b.label);
  });
}

function buildFullCPUCatalog(): CPU[] {
  // 1. Start with every CSV entry
  const csvEntries = parseCPUsFromCSV();

  // 2. Index by normalised label
  const byLabel = new Map<string, CPU>();
  for (const c of csvEntries) {
    byLabel.set(c.label.toLowerCase(), c);
  }

  // 3. Overwrite with hand-tuned entries
  for (const c of CPU_CATALOG) {
    byLabel.set(c.label.toLowerCase(), c);
  }

  // 4. Return sorted: hand-tuned first, then alphabetical
  const handTunedIds = new Set(CPU_CATALOG.map((c) => c.id));
  const all = [...byLabel.values()];
  return all.sort((a, b) => {
    const aHand = handTunedIds.has(a.id);
    const bHand = handTunedIds.has(b.id);
    if (aHand && !bHand) return -1;
    if (!aHand && bHand) return 1;
    if (aHand && bHand) return b.game_score - a.game_score;
    return a.label.localeCompare(b.label);
  });
}

// ── Cached singletons (computed once at module load) ─────────────────────────

export const FULL_GPU_CATALOG: GPU[] = buildFullGPUCatalog();
export const FULL_CPU_CATALOG: CPU[] = buildFullCPUCatalog();

/** True if this entry came from the hand-tuned catalog (accurate engine scores). */
const _handTunedGPUIds = new Set(GPU_CATALOG.map((g) => g.id));
const _handTunedCPUIds = new Set(CPU_CATALOG.map((c) => c.id));

export function isHandTunedGPU(id: string): boolean {
  return _handTunedGPUIds.has(id);
}

export function isHandTunedCPU(id: string): boolean {
  return _handTunedCPUIds.has(id);
}
