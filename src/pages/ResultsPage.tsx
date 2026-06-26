import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { SettingCategory, SettingDefinition } from "../data/types";
import { estimateFPS } from "../engine/fps";
import { VRAM_SAFETY_THRESHOLD } from "../engine/constants";
import { useAppStore } from "../store/appStore";
import {
  useSelectedGPU,
  useSelectedCPU,
  useSelectedGame,
  useResolution,
  useTargetFPS,
  useActiveSettings,
  useRAMType,
  useVRAMResult,
  useLoadResult,
  useEstimatedFPS,
  useQualityScore,
  useBottleneck,
  useActions,
} from "../store/selectors";
import { useOptimizer } from "../hooks/useOptimizer";
import {
  Card,
  SectionLabel,
  Badge,
  BottleneckBadge,
  ProgressBar,
  Slider,
} from "../components/ui/index";
import { RadialGauge, VRAMBreakdownBar, BottleneckBar } from "../components/charts/index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  texture:      "Textures",
  shadow:       "Shadows",
  lighting:     "Lighting",
  antialiasing: "Anti-Aliasing",
  effects:      "Effects",
  geometry:     "Geometry",
  postprocess:  "Post-Processing",
};

const RESOURCE_BADGE: Record<string, { label: string; variant: "warn" | "info" | "primary" | "muted" }> = {
  VRAM:        { label: "VRAM",    variant: "warn"    },
  GPU_COMPUTE: { label: "GPU",     variant: "info"    },
  CPU:         { label: "CPU",     variant: "primary" },
  BANDWIDTH:   { label: "BW",      variant: "muted"   },
};

function groupByCategory(settings: Record<string, SettingDefinition>) {
  const groups: Partial<Record<SettingCategory, SettingDefinition[]>> = {};
  for (const s of Object.values(settings)) {
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category]!.push(s);
  }
  for (const list of Object.values(groups)) {
    list?.sort((a, b) => a.ui_order - b.ui_order);
  }
  return groups;
}

function fpsColor(fps: number, target: number): string {
  if (fps >= target * 1.1) return "text-accent-primary";
  if (fps >= target * 0.85) return "text-accent-warn";
  return "text-accent-danger";
}

// Staggered card entrance animation
const CARD_HIDDEN = { opacity: 0, y: 8 };
const CARD_SHOW   = { opacity: 1, y: 0 };
const cardTransition = (i: number) => ({ duration: 0.22, delay: i * 0.07, ease: "easeOut" as const });

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const game           = useSelectedGame();
  const activeSettings = useActiveSettings();
  const gpu            = useSelectedGPU();
  const resolution     = useResolution();
  const vram           = useVRAMResult();
  const { setSettingTier } = useActions();

  // Per-setting max allowed tier: highest tier index whose VRAM delta fits in remaining budget.
  // Prevents sliders from being pushed into settings that would overflow VRAM.
  const vramLockMap = useMemo<Record<string, number>>(() => {
    if (!game || !gpu || !vram) return {};
    const res_scalar  = game.resolution_vram_scalars[resolution];
    const budget_safe = gpu.vram_mb * VRAM_SAFETY_THRESHOLD;
    const map: Record<string, number> = {};

    for (const [settingId, setting] of Object.entries(game.settings)) {
      const currentContrib = vram.per_setting[settingId] ?? 0;
      // Headroom = budget remaining if this setting were removed from total
      const headroom = budget_safe - vram.total_mb + currentContrib;

      // Find highest tier that fits within headroom (tiers are ordered Low→Ultra)
      let maxAllowed = setting.tiers.length - 1;
      for (let t = 0; t < setting.tiers.length; t++) {
        if (setting.tiers[t].vram_delta_mb * res_scalar > headroom) {
          maxAllowed = t - 1;
          break;
        }
      }
      map[settingId] = Math.max(0, maxAllowed);
    }
    return map;
  }, [game, gpu, vram, resolution]);

  if (!game) return null;

  const groups = groupByCategory(game.settings);

  return (
    <div className="flex flex-col gap-5">
      {(Object.entries(groups) as [SettingCategory, SettingDefinition[]][]).map(([cat, settings]) => (
        <div key={cat}>
          <SectionLabel>{CATEGORY_LABELS[cat]}</SectionLabel>
          <div className="flex flex-col gap-3">
            {settings.map((setting) => {
              const tierIndex     = activeSettings[setting.id] ?? 0;
              const tier          = setting.tiers[tierIndex];
              const res           = RESOURCE_BADGE[setting.primary_resource];
              const maxAllowedRaw = vramLockMap[setting.id];
              // Only pass maxAllowed when there's an actual restriction
              const maxAllowed    = maxAllowedRaw !== undefined && maxAllowedRaw < setting.tiers.length - 1
                ? maxAllowedRaw
                : undefined;
              const overLimit = maxAllowed !== undefined && tierIndex > maxAllowed;

              return (
                <Card
                  key={setting.id}
                  className={`p-4 transition-colors duration-200 ${overLimit ? "border-accent-danger/25" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-[#f5f5f5]">
                      {setting.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={res.variant}>{res.label}</Badge>
                      <span className={`text-[11px] ${overLimit ? "text-accent-danger" : "text-surface-400"}`}>
                        {tier.vram_delta_mb > 0 ? `+${tier.vram_delta_mb} MB` : "—"}
                      </span>
                    </div>
                  </div>
                  <Slider
                    value={tierIndex}
                    max={setting.tiers.length - 1}
                    labels={setting.tiers.map((t) => t.label)}
                    onChange={(v) => setSettingTier(setting.id, v)}
                    maxAllowed={maxAllowed}
                  />
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metrics panel ────────────────────────────────────────────────────────────

function MetricsPanel({ animate = true }: { animate?: boolean }) {
  // When not animating (shared-link refresh), render cards at their final state.
  const cardInitial = animate ? CARD_HIDDEN : false;
  const gpu        = useSelectedGPU();
  const cpu        = useSelectedCPU();
  const game       = useSelectedGame();
  const resolution = useResolution();
  const ramType    = useRAMType();
  const targetFPS  = useTargetFPS();
  const vram       = useVRAMResult();
  const loads      = useLoadResult();
  const fps        = useEstimatedFPS();
  const quality    = useQualityScore();
  const bottleneck = useBottleneck();

  // FPS range: compute all-Low and all-Ultra for the current hardware.
  const fpsRange = useMemo(() => {
    if (!gpu || !cpu || !game) return null;
    const lowSettings:   Record<string, number> = {};
    const ultraSettings: Record<string, number> = {};
    for (const [id, setting] of Object.entries(game.settings)) {
      lowSettings[id]   = 0;
      ultraSettings[id] = setting.tiers.length - 1;
    }
    return {
      low:   estimateFPS(gpu, cpu, game, lowSettings,   resolution, ramType),
      ultra: estimateFPS(gpu, cpu, game, ultraSettings, resolution, ramType),
    };
  }, [gpu, cpu, game, resolution, ramType]);

  if (!vram || !loads || fps === null) {
    return (
      <div className="flex items-center justify-center h-40 text-surface-400 text-[13px]">
        Select hardware and a game to see metrics.
      </div>
    );
  }

  const vramGB   = vram.total_mb / 1024;
  const budgetGB = vram.budget_mb / 1024;

  const fpsRangePct = fpsRange
    ? Math.max(0, Math.min(100,
        ((fps - fpsRange.ultra) / Math.max(1, fpsRange.low - fpsRange.ultra)) * 100
      ))
    : null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── FPS ─────────────────────────────────────────────────────────── */}
      <motion.div initial={cardInitial} animate={CARD_SHOW} transition={cardTransition(0)}>
        <Card className="p-5">
          <SectionLabel>Estimated FPS</SectionLabel>
          <div className="flex items-end gap-2">
            <span
              className={`text-5xl font-bold tabular-nums tracking-tighter ${fpsColor(fps, targetFPS)}`}
              aria-live="polite"
              aria-label={`${fps} frames per second`}
            >
              {fps}
            </span>
            <span className="text-surface-400 text-[13px] mb-1.5">
              / {targetFPS} target
            </span>
          </div>

          <div className="mt-3">
            <ProgressBar value={Math.min(fps / (targetFPS * 1.5), 1)} variant="auto" />
          </div>

          {fpsRange && fpsRangePct !== null && (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-surface-300 w-14 text-right tabular-nums">
                  {fpsRange.ultra} FPS
                </span>
                <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-primary/40 rounded-full"
                    style={{ width: `${fpsRangePct}%`, transition: "width 0.4s ease-out" }}
                  />
                </div>
                <span className="text-[10px] text-surface-300 w-14 tabular-nums">
                  {fpsRange.low} FPS
                </span>
              </div>
              <div className="flex justify-between mt-0.5 pl-16 pr-16 text-[9px] text-surface-400">
                <span>Ultra</span>
                <span>All Low</span>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── VRAM ─────────────────────────────────────────────────────────── */}
      <motion.div initial={cardInitial} animate={CARD_SHOW} transition={cardTransition(1)}>
        <Card className="p-5">
          <SectionLabel>VRAM Usage</SectionLabel>
          <div className="flex items-baseline justify-between mb-3">
            <span className={`text-xl font-semibold tabular-nums ${vram.over_budget ? "text-accent-danger" : "text-[#f5f5f5]"}`}>
              {vramGB.toFixed(1)} GB
            </span>
            <span className="text-[12px] text-surface-400">
              of {budgetGB.toFixed(0)} GB
              {gpu && ` (${gpu.label.split(" ").slice(-1)[0]})`}
              {vram.over_budget && (
                <span className="ml-1 text-accent-danger font-semibold">— over limit</span>
              )}
            </span>
          </div>
          {game && <VRAMBreakdownBar vram={vram} game={game} />}
        </Card>
      </motion.div>

      {/* ── Hardware Load ─────────────────────────────────────────────────── */}
      <motion.div initial={cardInitial} animate={CARD_SHOW} transition={cardTransition(2)}>
        <Card className="p-5">
          <SectionLabel>Hardware Load</SectionLabel>
          <div className="flex justify-around items-center gap-4 mt-2">
            <RadialGauge value={loads.gpu_load} label="GPU Load" size="w-32" />
            <RadialGauge value={loads.cpu_load} label="CPU Load" size="w-32" />
          </div>
        </Card>
      </motion.div>

      {/* ── Visual Quality ────────────────────────────────────────────────── */}
      <motion.div initial={cardInitial} animate={CARD_SHOW} transition={cardTransition(3)}>
        <Card className="p-5">
          <SectionLabel>Visual Quality Score</SectionLabel>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-semibold text-[#f5f5f5] tabular-nums">
              {quality ?? 0}
            </span>
            <span className="text-[12px] text-surface-400">/ 100</span>
          </div>
          <ProgressBar value={(quality ?? 0) / 100} variant="primary" />
        </Card>
      </motion.div>

      {/* ── Bottleneck ────────────────────────────────────────────────────── */}
      {bottleneck && (
        <motion.div initial={cardInitial} animate={CARD_SHOW} transition={cardTransition(4)}>
          <Card className="p-5">
            <SectionLabel>Bottleneck Analysis</SectionLabel>
            <div className="flex items-center gap-2 mb-2">
              <BottleneckBadge type={bottleneck.type} />
            </div>
            <p className="text-[12px] text-surface-400 leading-relaxed mb-4">
              {bottleneck.label}
            </p>
            {bottleneck.type !== "VRAM" && (
              <BottleneckBar bottleneck={bottleneck} />
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// ─── Optimizer panel ──────────────────────────────────────────────────────────

function OptimizerPanel() {
  const { optimize } = useOptimizer();
  const { resetSettings } = useActions();
  const bottleneck = useBottleneck();
  const fps        = useEstimatedFPS();
  const targetFPS  = useTargetFPS();

  const presets = [
    {
      id:          "performance" as const,
      label:       "Performance",
      description: "Target 90 FPS — prioritise frame rate",
      icon:        "⚡",
    },
    {
      id:          "balanced" as const,
      label:       "Balanced",
      description: "Target 60 FPS — best quality/FPS trade-off",
      icon:        "⚖",
    },
    {
      id:          "quality" as const,
      label:       "Quality",
      description: "Target 30 FPS — maximum visual fidelity",
      icon:        "✦",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel>Auto-Optimize Presets</SectionLabel>
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => optimize(p.id)}
              className="
                w-full text-left p-3.5 rounded-xl border border-surface-700
                bg-surface-800 hover:border-surface-500
                transition-all duration-150
              "
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px]">{p.icon}</span>
                <span className="text-[13px] font-semibold text-[#f5f5f5]">{p.label}</span>
              </div>
              <p className="text-[11px] text-surface-400 pl-5">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {fps !== null && (
        <Card className="p-4">
          <SectionLabel>Current Status</SectionLabel>
          <div className="space-y-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-surface-400">FPS vs target</span>
              <span className={fpsColor(fps, targetFPS)}>
                {fps >= targetFPS ? `+${fps - targetFPS} above` : `${targetFPS - fps} below`} target
              </span>
            </div>
            {bottleneck && (
              <div className="flex justify-between text-[12px]">
                <span className="text-surface-400">Constraint</span>
                <BottleneckBadge type={bottleneck.type} />
              </div>
            )}
          </div>
        </Card>
      )}

      {bottleneck?.type === "CPU" && (
        <Card className="p-4">
          <SectionLabel>Tip</SectionLabel>
          <p className="text-[12px] text-surface-400 leading-relaxed">
            Your GPU has spare headroom. Raising GPU-heavy settings like
            Reflections or Anti-Aliasing will improve visuals without
            costing FPS.
          </p>
        </Card>
      )}
      {bottleneck?.type === "VRAM" && (
        <Card className="p-4 border-accent-danger/20">
          <SectionLabel>Warning</SectionLabel>
          <p className="text-[12px] text-accent-danger/80 leading-relaxed">
            VRAM budget exceeded. Texture Quality is the highest-impact
            setting to reduce. Expect hitching and stuttering until usage
            drops below 90%.
          </p>
        </Card>
      )}

      <button
        type="button"
        onClick={resetSettings}
        className="
          w-full py-2.5 rounded-lg border border-surface-700
          text-[12px] text-surface-400 hover:text-surface-200 hover:border-surface-500
          transition-all duration-150
        "
      >
        Reset to Medium
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ResultsPageProps {
  onBack: () => void;
  /** Play the staggered card entrance. False on a shared-link refresh. */
  animateEntrance?: boolean;
}

export function ResultsPage({ onBack, animateEntrance = true }: ResultsPageProps) {
  const gpu        = useSelectedGPU();
  const cpu        = useSelectedCPU();
  const game       = useSelectedGame();
  const resolution = useResolution();
  const [copied, setCopied] = useState(false);

  const subtitle = gpu && cpu && game
    ? `${cpu.label.replace("Intel Core ", "").replace("AMD ", "")}  ·  ${gpu.label.replace("NVIDIA GeForce ", "").replace("AMD Radeon ", "")}  ·  ${game.label}  ·  ${resolution}`
    : "";

  const handleShare = useCallback(() => {
    const s = useAppStore.getState();
    const params = new URLSearchParams();
    if (s.selectedGPU)  params.set("gpu",  s.selectedGPU.id);
    if (s.selectedCPU)  params.set("cpu",  s.selectedCPU.id);
    if (s.selectedGame) params.set("game", s.selectedGame.id);
    params.set("res", s.resolution);
    params.set("fps", String(s.targetFPS));
    params.set("ram", String(s.ram_gb));
    params.set("ddr", s.ram_type);
    if (s.selectedGame) {
      for (const id of Object.keys(s.selectedGame.settings)) {
        params.set(`s_${id}`, String(s.activeSettings[id] ?? 0));
      }
    }
    const url = `${window.location.origin}${window.location.pathname}?${params}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-surface-800 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back to configuration"
          className="flex items-center gap-1.5 text-surface-400 hover:text-[#f5f5f5] transition-colors text-[13px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-surface-700" aria-hidden="true" />
        <span className="text-[12px] text-surface-400 truncate flex-1">{subtitle}</span>

        {/* Share button — only shown when fully configured */}
        {gpu && cpu && game && (
          <button
            type="button"
            onClick={handleShare}
            aria-label="Copy shareable link to clipboard"
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium
              transition-all duration-200
              ${copied
                ? "border-accent-primary/40 text-accent-primary bg-accent-primary/10"
                : "border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200 bg-surface-800"
              }
            `}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </>
            )}
          </button>
        )}
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Settings — scrollable */}
        <div className="w-[300px] shrink-0 border-r border-surface-800 overflow-y-auto gso-scroll p-5">
          <h2 className="text-[13px] font-semibold text-[#f5f5f5] mb-4">Graphics Settings</h2>
          <SettingsPanel />
        </div>

        {/* Metrics — center */}
        <div className="flex-1 overflow-y-auto gso-scroll p-5 border-r border-surface-800" role="main">
          <h2 className="text-[13px] font-semibold text-[#f5f5f5] mb-4">Performance Metrics</h2>
          <MetricsPanel animate={animateEntrance} />
        </div>

        {/* Optimizer — right */}
        <div className="w-[260px] shrink-0 overflow-y-auto gso-scroll p-5">
          <h2 className="text-[13px] font-semibold text-[#f5f5f5] mb-4">Optimizer</h2>
          <OptimizerPanel />
        </div>
      </div>
    </div>
  );
}
