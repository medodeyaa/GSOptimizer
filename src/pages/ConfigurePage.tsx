import type { Resolution, TargetFPS, RAMType } from "../data/types";
import { GPU_CATALOG } from "../data/hardware/gpu";
import { CPU_CATALOG } from "../data/hardware/cpu";
import { GAME_CATALOG } from "../data/games/index";
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
  DropdownSelect,
  TabGroup,
} from "../components/ui/index";
import type { SelectOption } from "../components/ui/index";

// ─── Option builders ──────────────────────────────────────────────────────────

const GPU_OPTIONS: SelectOption[] = GPU_CATALOG.map((g) => ({
  value: g.id,
  label: g.label,
  group: `${g.brand.toUpperCase()} — ${g.architecture.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
}));

const CPU_OPTIONS: SelectOption[] = CPU_CATALOG.map((c) => ({
  value: c.id,
  label: c.label,
  group: c.brand === "intel" ? "Intel" : "AMD",
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
            <DropdownSelect
              options={GPU_OPTIONS}
              value={selectedGPU?.id ?? null}
              onChange={(id) => {
                const gpu = GPU_CATALOG.find((g) => g.id === id) ?? null;
                setGPU(gpu);
              }}
              placeholder="Select your GPU…"
            />
            {selectedGPU && (
              <div className="flex items-center gap-2 mt-3">
                <HardwareTierBadge score={selectedGPU.compute_score} />
                <span className="text-[12px] text-surface-400">
                  {(selectedGPU.vram_mb / 1024).toFixed(0)} GB VRAM
                  · {selectedGPU.memory_bandwidth_gbps} GB/s
                </span>
              </div>
            )}
          </Card>

          {/* CPU */}
          <Card className="p-5">
            <SectionLabel>Processor</SectionLabel>
            <DropdownSelect
              options={CPU_OPTIONS}
              value={selectedCPU?.id ?? null}
              onChange={(id) => {
                const cpu = CPU_CATALOG.find((c) => c.id === id) ?? null;
                setCPU(cpu);
              }}
              placeholder="Select your CPU…"
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
          <div>
            <SectionLabel>Select Game</SectionLabel>
            <div className="flex flex-col gap-3">
              {GAME_CATALOG.map((game) => {
                const active = selectedGame?.id === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setGame(game)}
                    className={`
                      w-full text-left p-4 rounded-xl border transition-all duration-150
                      ${active
                        ? "bg-accent-primary/8 border-accent-primary/30"
                        : "bg-surface-800 border-surface-700 hover:border-surface-500"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[14px] font-semibold ${active ? "text-[#f5f5f5]" : "text-surface-200"}`}>
                        {game.label}
                      </span>
                      {active && (
                        <svg className="w-4 h-4 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="muted">{game.engine}</Badge>
                      <span className="text-[11px] text-surface-400">
                        {Object.keys(game.settings).length} configurable settings
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

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
