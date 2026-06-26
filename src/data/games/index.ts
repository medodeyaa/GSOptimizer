import type { GameDefinition } from "../types";
import { RDR2 }             from "./rdr2";
import { ELDEN_RING }       from "./elden_ring";
import { CYBERPUNK_2077 }   from "./cyberpunk2077";
import { CS2 }              from "./cs2";
import { WITCHER_3 }        from "./witcher3";
import { HOGWARTS_LEGACY }  from "./hogwarts_legacy";
import { FORTNITE }         from "./fortnite";
import { VALORANT }         from "./valorant";
import { parseGameListings, buildGeneratedGame, getGameMeta } from "./gamesParser";
import type { GameListing } from "./gamesParser";
import { fetchPcgwDefinition } from "./pcgwClient";

export type { GameListing };

// ─── Hand-tuned catalog (authoritative; overrides generated specs) ────────────

export const GAME_CATALOG: GameDefinition[] = [
  RDR2,
  ELDEN_RING,
  CYBERPUNK_2077,
  CS2,
  WITCHER_3,
  HOGWARTS_LEGACY,
  FORTNITE,
  VALORANT,
];

const HANDTUNED_BY_ID = new Map(GAME_CATALOG.map((g) => [g.id, g]));

// Hand-tuned ids may differ in spelling from a generated id derived from the
// title (e.g. "cyberpunk2077" vs "cyberpunk_2077"). Dedupe generated listings
// against hand-tuned titles by a normalized label so the same game never shows
// twice in the picker.
const normLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const HANDTUNED_LABELS = new Set(GAME_CATALOG.map((g) => normLabel(g.label)));

// ─── Combined listings for the picker ─────────────────────────────────────────
// Hand-tuned games first (most relevant + accurate), then the generated catalog
// ordered by popularity (the CSV is pre-sorted most-played-first).

export const GAME_LISTINGS: GameListing[] = (() => {
  const handtuned: GameListing[] = GAME_CATALOG.map((g) => ({
    id: g.id,
    label: g.label,
    engine: g.engine,
    genre: "Featured",
    year: 0,
    plays: Number.MAX_SAFE_INTEGER,
  }));

  const generated = parseGameListings().filter(
    (g) => !HANDTUNED_BY_ID.has(g.id) && !HANDTUNED_LABELS.has(normLabel(g.label))
  );

  return [...handtuned, ...generated];
})();

// ─── Lookup ───────────────────────────────────────────────────────────────────
// Hand-tuned wins; otherwise build the estimated definition lazily (cached).

export function getGameById(id: string): GameDefinition | undefined {
  return HANDTUNED_BY_ID.get(id) ?? buildGeneratedGame(id);
}

// ─── Real-data enrichment (PCGamingWiki) ──────────────────────────────────────
// Complements getGameById: tries to upgrade a generated (estimated) game to one
// backed by real published requirements. Returns null when no enrichment is
// possible (hand-tuned games are already authoritative; CSV-only games that
// aren't on the wiki keep their estimate). Never throws — selection always has
// the synchronous getGameById result to fall back on.

export async function getRealGameById(id: string): Promise<GameDefinition | null> {
  // Hand-tuned games are the most accurate we have — don't override them.
  if (HANDTUNED_BY_ID.has(id)) return null;

  const meta = getGameMeta(id);
  if (!meta) return null;

  return fetchPcgwDefinition(
    { id: meta.id, label: meta.label, engine: meta.engine, year: meta.year },
    { gpu: meta.gpu_demand, cpu: meta.cpu_demand }
  );
}

export { RDR2, ELDEN_RING, CYBERPUNK_2077, CS2, WITCHER_3, HOGWARTS_LEGACY, FORTNITE, VALORANT };
