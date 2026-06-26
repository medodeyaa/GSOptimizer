import { useState } from "react";
import type { VRAMResult, GameDefinition, SettingCategory } from "../../data/types";

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<SettingCategory, string> = {
  texture:      "#6ee7b7",
  shadow:       "#60a5fa",
  lighting:     "#fbbf24",
  antialiasing: "#c084fc",
  effects:      "#fb923c",
  geometry:     "#34d399",
  postprocess:  "#94a3b8",
};

const CATEGORY_LABEL: Record<SettingCategory, string> = {
  texture:      "Textures",
  shadow:       "Shadows",
  lighting:     "Lighting",
  antialiasing: "AA",
  effects:      "Effects",
  geometry:     "Geometry",
  postprocess:  "Post",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface VRAMBreakdownBarProps {
  vram: VRAMResult;
  game: GameDefinition;
}

interface Segment {
  id:       string;
  label:    string;
  mb:       number;
  color:    string;
  category: SettingCategory;
}

export function VRAMBreakdownBar({ vram, game }: VRAMBreakdownBarProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // budget_mb = full GPU VRAM. Safety threshold = 90% of that.
  const total    = vram.budget_mb;
  const safeAt   = 0.90; // 90% of total

  // Build segments: base + per-setting (only settings with > 0 VRAM delta)
  const perSettingSegments: Segment[] = Object.entries(vram.per_setting)
    .filter(([, mb]) => mb > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([id, mb]) => {
      const setting = game.settings[id];
      return {
        id,
        label:    setting?.label ?? id,
        mb,
        color:    CATEGORY_COLOR[setting?.category as SettingCategory] ?? "#888",
        category: (setting?.category as SettingCategory) ?? "effects",
      };
    });

  const hoveredSeg = hovered
    ? perSettingSegments.find((s) => s.id === hovered) ?? null
    : null;

  const usedCategories = [...new Set(perSettingSegments.map((s) => s.category))];

  const pct = (mb: number) => `${Math.max(0, (mb / total) * 100).toFixed(2)}%`;

  return (
    <div>
      {/* Stacked bar */}
      <div className="relative h-5 flex rounded overflow-hidden bg-surface-700">

        {/* Engine base */}
        <div
          title={`Engine base: ${Math.round(vram.base_mb)} MB`}
          style={{ width: pct(vram.base_mb) }}
          className="bg-surface-500 shrink-0"
          onMouseEnter={() => setHovered("__base__")}
          onMouseLeave={() => setHovered(null)}
        />

        {/* Per-setting segments */}
        {perSettingSegments.map((seg) => (
          <div
            key={seg.id}
            title={`${seg.label}: ${Math.round(seg.mb)} MB`}
            style={{ width: pct(seg.mb), backgroundColor: seg.color, opacity: 0.75 }}
            className="shrink-0 hover:opacity-100 cursor-default transition-opacity duration-100"
            onMouseEnter={() => setHovered(seg.id)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* 90% safe-limit marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/25 pointer-events-none"
          style={{ left: `${safeAt * 100}%` }}
        />

        {/* Over-budget red border */}
        {vram.over_budget && (
          <div className="absolute inset-0 rounded border border-accent-danger/60 pointer-events-none" />
        )}
      </div>

      {/* Axis labels */}
      <div className="flex justify-between mt-1 text-[10px] text-surface-500">
        <span>0</span>
        <span>90% limit</span>
        <span>{(total / 1024).toFixed(0)} GB</span>
      </div>

      {/* Hover tooltip line */}
      <div className="h-4 mt-1">
        {hovered === "__base__" && (
          <p className="text-[11px] text-surface-400">
            Engine base: <span className="text-[#f5f5f5]">{Math.round(vram.base_mb)} MB</span>
          </p>
        )}
        {hoveredSeg && (
          <p className="text-[11px] text-surface-400">
            {hoveredSeg.label}:{" "}
            <span className="text-[#f5f5f5]">{Math.round(hoveredSeg.mb)} MB</span>
          </p>
        )}
      </div>

      {/* Category legend */}
      {usedCategories.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          <span className="flex items-center gap-1 text-[10px] text-surface-500">
            <span className="w-2 h-2 rounded-sm bg-surface-500 inline-block" />
            Engine
          </span>
          {usedCategories.map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-[10px] text-surface-500">
              <span
                className="w-2 h-2 rounded-sm inline-block"
                style={{ backgroundColor: CATEGORY_COLOR[cat] }}
              />
              {CATEGORY_LABEL[cat]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
