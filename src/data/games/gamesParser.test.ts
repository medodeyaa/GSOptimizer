import { describe, it, expect } from "vitest";
import { parseGameListings, buildGeneratedGame } from "./gamesParser";
import { GAME_LISTINGS, getGameById } from "./index";

describe("Generated game catalog", () => {
  const listings = parseGameListings();

  it("parses thousands of PC games", () => {
    expect(listings.length).toBeGreaterThan(10000);
  });

  it("is sorted most-played first", () => {
    for (let i = 1; i < Math.min(listings.length, 500); i++) {
      expect(listings[i].plays).toBeLessThanOrEqual(listings[i - 1].plays);
    }
  });

  it("every generated definition upholds the engine's structural invariants", () => {
    // Sample across the popularity range so we exercise heavy AAA and light indie.
    const sample = [0, 1, 2, 10, 100, 1000, 5000, listings.length - 1]
      .map((i) => listings[Math.min(i, listings.length - 1)]);

    for (const l of sample) {
      const def = buildGeneratedGame(l.id);
      expect(def, l.id).toBeDefined();
      if (!def) continue;

      const settings = Object.values(def.settings);
      expect(Object.keys(def.settings).length, `${l.id} settings`).toBeGreaterThanOrEqual(8);

      for (const s of settings) {
        expect(s.tiers.length, `${l.id}.${s.id} tiers`).toBeGreaterThanOrEqual(4);
        s.tiers.forEach((t, i) => expect(t.index).toBe(i));
        for (let i = 1; i < s.tiers.length; i++) {
          expect(s.tiers[i].vram_delta_mb).toBeGreaterThanOrEqual(s.tiers[i - 1].vram_delta_mb);
        }
        for (const t of s.tiers) {
          expect(t.fps_multiplier).toBeGreaterThan(0);
          expect(t.fps_multiplier).toBeLessThanOrEqual(1);
        }
      }

      expect(def.cpu_weight).toBeGreaterThanOrEqual(0.3);
      expect(def.cpu_weight).toBeLessThanOrEqual(0.95);
      expect(def.base_vram_mb).toBeGreaterThan(0);
      expect(def.gpu_baseline_fps).toBeGreaterThan(0);
    }
  });

  it("infers plausible engines for well-known franchises", () => {
    const find = (label: string) => listings.find((l) => l.label === label);
    const skyrim = find("The Elder Scrolls V: Skyrim");
    if (skyrim) expect(skyrim.engine).toBe("Creation Engine");
    const gta = find("Grand Theft Auto V");
    if (gta) expect(gta.engine).toBe("RAGE");
  });
});

describe("Merged catalog (hand-tuned + generated)", () => {
  it("surfaces the hand-tuned games first under Featured", () => {
    expect(GAME_LISTINGS[0].genre).toBe("Featured");
  });

  it("resolves both hand-tuned and generated ids to full definitions", () => {
    const handtuned = getGameById("elden_ring");
    expect(handtuned?.engine).toBe("Havok / From Engine"); // hand-tuned wins

    // pick a generated listing (skip the 8 featured)
    const generated = GAME_LISTINGS.find((l) => l.genre !== "Featured");
    expect(generated).toBeDefined();
    const def = getGameById(generated!.id);
    expect(def).toBeDefined();
    expect(Object.keys(def!.settings).length).toBeGreaterThanOrEqual(8);
  });

  it("does not list the same title twice (hand-tuned vs generated)", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const seen = new Set<string>();
    for (const l of GAME_LISTINGS) {
      const k = norm(l.label);
      expect(seen.has(k), `duplicate listing: ${l.label}`).toBe(false);
      seen.add(k);
    }
  });
});
