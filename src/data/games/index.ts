import type { GameDefinition } from "../types";
import { RDR2 }             from "./rdr2";
import { ELDEN_RING }       from "./elden_ring";
import { CYBERPUNK_2077 }   from "./cyberpunk2077";
import { CS2 }              from "./cs2";
import { WITCHER_3 }        from "./witcher3";
import { HOGWARTS_LEGACY }  from "./hogwarts_legacy";

export const GAME_CATALOG: GameDefinition[] = [
  RDR2,
  ELDEN_RING,
  CYBERPUNK_2077,
  CS2,
  WITCHER_3,
  HOGWARTS_LEGACY,
];

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}

export { RDR2, ELDEN_RING, CYBERPUNK_2077, CS2, WITCHER_3, HOGWARTS_LEGACY };
