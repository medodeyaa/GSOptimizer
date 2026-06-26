import { useRef, useState } from "react";
import type { Resolution, TargetFPS, RAMType } from "../data/types";
import { GAME_LISTINGS, getGameById, getRealGameById } from "../data/games/index";
import {
  FULL_GPU_CATALOG,
  FULL_CPU_CATALOG,
  findGPUById,
  findCPUById,
} from "../data/hardware/fullCatalog";
import {
  useActions,
  useSelectedGPU,
  useSelectedCPU,
  useRAM,
  useRAMType,
  useResolution,
  useTargetFPS,
  useSelectedGame,
  useIsConfigured,
} from "../store/selectors";
import {
  Card,
  SectionLabel,
  Badge,
  HardwareTierBadge,
  HardwareSearchSelect,
  TabGroup,
} from "../components/ui/index";
import type { SelectOption } from "../components/ui/index";

// All GPU/CPU options come from the FULL merged catalog (CSV + hand-tuned).
// The search bar shows every valid entry; the optimization engine uses hand-tuned
// scores for known cards and estimated scores for CSV-only entries.
const GPU_OPTIONS: SelectOption[] = FULL_GPU_CATALOG.map((g) => ({
  value: g.id,
  label: g.label,
  group: `${g.brand.toUpperCase()} — ${g.architecture.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
}));

const CPU_OPTIONS: SelectOption[] = FULL_CPU_CATALOG.map((c) => ({
  value: c.id,
  label: c.label,
  group: c.brand === "intel" ? "Intel" : "AMD",
}));

// 20k+ games come from the generated catalog (CSV-derived estimated specs);
// the 8 hand-tuned games surface first under "Featured". Searchable, like the
// hardware pickers — rendering them all as buttons would freeze the page.
const GAME_OPTIONS: SelectOption[] = GAME_LISTINGS.map((g) => ({
  value: g.id,
  label: g.label,
  group: g.genre,
}));

const RAM_OPTIONS = [8, 16, 32, 64] as const;

const DDR_OPTIONS: { value: RAMType; label: string; description: string }[] = [
  { value: "DDR4", label: "DDR4", description: "Standard — most desktops" },
  { value: "DDR5", label: "DDR5", description: "+5% CPU FPS in CPU-bound games" },
];

const RESOLUTION_TABS: { value: Resolution; label: string }[] = [
  { value: "1080p", label: "1080p" },
  { value: "1440p", label: "1440p" },
  { value: "2160p", label: "4K" },
];

const FPS_TABS: { value: TargetFPS; label: string }[] = [
  { value: 30,  label: "30" },
  { value: 60,  label: "60" },
  { value: 90,  label: "90" },
  { value: 120, label: "120" },
  { value: 144, label: "144" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ConfigurePageProps {
  onAnalyze: () => void;
}

export function ConfigurePage({ onAnalyze }: ConfigurePageProps) {
  const { setGPU, setCPU, setRAM, setRAMType, setResolution, setTargetFPS, setGame } = useActions();
  const selectedGPU  = useSelectedGPU();
  const selectedCPU  = useSelectedCPU();
  const ram_gb       = useRAM();
  const ram_type     = useRAMType();
  const resolution   = useResolution();
  const targetFPS    = useTargetFPS();
  const selectedGame = useSelectedGame();
  const configured   = useIsConfigured();

  // Tracks the most recently requested game id so a slow PCGamingWiki fetch for
  // a previously-selected game can't clobber a newer selection.
  const latestGameReq = useRef<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  function handleSelectGame(id: string) {
    latestGameReq.current = id || null;
    if (!id) { setGame(null); setEnriching(false); return; }

    // 1. Instant: CSV / hand-tuned estimate so the UI never waits on the network.
    setGame(getGameById(id) ?? null);

    // 2. Upgrade in the background to real PCGamingWiki specs when available.
    setEnriching(true);
    getRealGameById(id)
      .then((real) => {
        if (real && latestGameReq.current === id) setGame(real);
      })
      .catch(() => { /* keep the estimate */ })
      .finally(() => { if (latestGameReq.current === id) setEnriching(false); });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-[#f5f5f5] tracking-tight">
            GSOptimizer
          </span>
        </div>
        <Badge variant="muted">Phase 1 Data · Phase 2 Engine</Badge>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Hardware ─────────────────────────────────────────── */}
        <div className="w-1/2 border-r border-surface-800 p-8 overflow-y-auto gso-scroll flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[#f5f5f5] tracking-tight mb-1">
              Your Hardware
            </h1>
            <p className="text-[13px] text-surface-400">
              Enter your exact specs for an accurate optimization.
            </p>
          </div>

          {/* GPU */}
          <Card className="p-5">
            <SectionLabel>Graphics Card</SectionLabel>
            <HardwareSearchSelect
              options={GPU_OPTIONS}
              value={selectedGPU?.id ?? null}
              onChange={(id) => setGPU(findGPUById(id))}
              placeholder="Search your GPU…"
              icon="gpu"
            />
            {selectedGPU && (
              <div className="flex items-center gap-2 mt-3">
                <HardwareTierBadge score={selectedGPU.compute_score} />
                <span className="text-[12px] text-surface-400">
                  {selectedGPU.vram_mb > 0
                    ? `${(selectedGPU.vram_mb / 1024).toFixed(0)} GB VRAM`
                    : "Shared VRAM"}
                  {selectedGPU.memory_bandwidth_gbps > 0
                    ? ` · ${selectedGPU.memory_bandwidth_gbps} GB/s`
                    : ""}
                </span>
              </div>
            )}
          </Card>

          {/* CPU */}
          <Card className="p-5">
            <SectionLabel>Processor</SectionLabel>
            <HardwareSearchSelect
              options={CPU_OPTIONS}
              value={selectedCPU?.id ?? null}
              onChange={(id) => setCPU(findCPUById(id))}
              placeholder="Search your CPU…"
              icon="cpu"
            />
            {selectedCPU && (
              <div className="flex items-center gap-2 mt-3">
                <HardwareTierBadge score={selectedCPU.game_score} />
                <span className="text-[12px] text-surface-400">
                  {selectedCPU.cores_physical}C / {selectedCPU.cores_logical}T
                  · {selectedCPU.boost_clock_ghz} GHz boost
                </span>
              </div>
            )}
          </Card>

          {/* RAM — capacity + type */}
          <Card className="p-5">
            <SectionLabel>System RAM</SectionLabel>

            {/* Capacity buttons */}
            <div className="flex gap-2 mb-4">
              {RAM_OPTIONS.map((gb) => {
                const active = gb === ram_gb;
                return (
                  <button
                    key={gb}
                    type="button"
                    onClick={() => setRAM(gb)}
                    className={`
                      flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all duration-150
                      ${active
                        ? "bg-surface-700 text-[#f5f5f5] border-surface-600"
                        : "bg-surface-900 text-surface-400 border-surface-700 hover:border-surface-500"
                      }
                    `}
                  >
                    {gb} GB
                  </button>
                );
              })}
            </div>

            {/* DDR type toggle */}
            <div className="flex gap-2">
              {DDR_OPTIONS.map(({ value, label, description }) => {
                const active = value === ram_type;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRAMType(value)}
                    className={`
                      flex-1 py-2.5 px-3 rounded-lg border text-left transition-all duration-150
                      ${active
                        ? "bg-accent-primary/10 border-accent-primary/40 text-[#f5f5f5]"
                        : "bg-surface-900 border-surface-700 text-surface-400 hover:border-surface-500"
                      }
                    `}
                  >
                    <div className={`text-[13px] font-semibold ${active ? "text-accent-primary" : ""}`}>
                      {label}
                    </div>
                    <div className="text-[11px] text-surface-400 mt-0.5">{description}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Right: Game & Display ───────────────────────────────────── */}
        <div className="w-1/2 p-8 overflow-y-auto gso-scroll flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[#f5f5f5] tracking-tight mb-1">
              Game & Display
            </h1>
            <p className="text-[13px] text-surface-400">
              Select the game and target display configuration.
            </p>
          </div>

          {/* Game picker */}
          <Card className="p-5">
            <SectionLabel>Select Game</SectionLabel>
            <HardwareSearchSelect
              options={GAME_OPTIONS}
              value={selectedGame?.id ?? null}
              onChange={handleSelectGame}
              placeholder="Search your game…"
              icon="game"
            />
            {selectedGame && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="muted">{selectedGame.engine}</Badge>
                {/* Provenance: real published requirements vs. estimated specs. */}
                {enriching ? (
                  <Badge variant="muted">Checking PCGamingWiki…</Badge>
                ) : selectedGame.specSource === "pcgw" ? (
                  <Badge variant="primary">Real specs · PCGamingWiki</Badge>
                ) : selectedGame.specSource === "estimated" ? (
                  <Badge variant="muted">Estimated specs</Badge>
                ) : null}
                <span className="text-[12px] text-surface-400">
                  {Object.keys(selectedGame.settings).length} configurable settings
                </span>
              </div>
            )}
          </Card>

          {/* Resolution */}
          <Card className="p-5">
            <SectionLabel>Display Resolution</SectionLabel>
            <TabGroup
              tabs={RESOLUTION_TABS}
              value={resolution}
              onChange={setResolution}
            />
          </Card>

          {/* Target FPS */}
          <Card className="p-5">
            <SectionLabel>Target Frame Rate</SectionLabel>
            <TabGroup
              tabs={FPS_TABS}
              value={targetFPS}
              onChange={setTargetFPS}
            />
          </Card>

          {/* CTA */}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!configured}
            className="
              w-full py-3.5 rounded-xl text-[14px] font-semibold tracking-wide
              transition-all duration-200
              disabled:opacity-30 disabled:cursor-not-allowed
              bg-accent-primary text-surface-900
              hover:brightness-110 active:brightness-95
            "
          >
            {configured ? "Analyze Performance →" : "Select GPU, CPU, and a game to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
