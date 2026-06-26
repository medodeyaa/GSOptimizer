import type { BottleneckResult } from "../../data/types";

// Display range for the ratio axis (clamped to this range for visual position)
const MIN_RATIO = 0.25;
const MAX_RATIO = 2.25;
const RANGE     = MAX_RATIO - MIN_RATIO;

// Zone boundaries as fractions 0–1 of the bar width
const CPU_BOUNDARY_PCT = ((0.75 - MIN_RATIO) / RANGE) * 100; // ≈ 25%
const GPU_BOUNDARY_PCT = ((1.35 - MIN_RATIO) / RANGE) * 100; // ≈ 55%
const RATIO_1_PCT      = ((1.00 - MIN_RATIO) / RANGE) * 100; // ≈ 37.5% (perfect balance)

function markerPct(ratio: number): number {
  return Math.max(0, Math.min(100, ((ratio - MIN_RATIO) / RANGE) * 100));
}

function markerColor(type: string): string {
  if (type === "CPU")      return "var(--color-accent-info,    #60a5fa)";
  if (type === "GPU")      return "var(--color-accent-warn,    #fbbf24)";
  if (type === "BALANCED") return "var(--color-accent-primary, #6ee7b7)";
  return "#888";
}

interface BottleneckBarProps {
  bottleneck: BottleneckResult;
}

export function BottleneckBar({ bottleneck }: BottleneckBarProps) {
  if (bottleneck.type === "VRAM") return null;

  const pct   = markerPct(bottleneck.ratio);
  const color = markerColor(bottleneck.type);

  return (
    <div>
      {/* Ratio label + triangle marker — positioned via CSS left % */}
      <div className="relative h-5 mb-0.5">
        <div
          className="absolute flex flex-col items-center"
          style={{
            left:       `${pct}%`,
            transform:  "translateX(-50%)",
            transition: "left 0.4s ease-out",
          }}
        >
          {/* Ratio value */}
          <span
            className="text-[10px] font-mono font-semibold leading-none mb-0.5"
            style={{ color, transition: "color 0.35s ease-out" }}
          >
            {bottleneck.ratio.toFixed(2)}×
          </span>
          {/* Triangle pointing down into the bar */}
          <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden="true">
            <polygon points="4,5 0,0 8,0" fill={color} />
          </svg>
        </div>
      </div>

      {/* Zone bar */}
      <div className="relative flex h-2 rounded-full overflow-hidden">
        {/* CPU-bound zone */}
        <div
          style={{ width: `${CPU_BOUNDARY_PCT}%` }}
          className="bg-accent-info/25 shrink-0"
        />
        {/* Balanced zone */}
        <div
          style={{ width: `${GPU_BOUNDARY_PCT - CPU_BOUNDARY_PCT}%` }}
          className="bg-accent-primary/25 shrink-0"
        />
        {/* GPU-bound zone */}
        <div className="flex-1 bg-accent-warn/25" />

        {/* Zone boundary lines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-surface-600"
          style={{ left: `${CPU_BOUNDARY_PCT}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-surface-600"
          style={{ left: `${GPU_BOUNDARY_PCT}%` }}
        />

        {/* ratio=1 reference tick (dashed) */}
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-surface-500/40"
          style={{ left: `${RATIO_1_PCT}%` }}
        />
      </div>

      {/* Zone labels — plain HTML, fixed CSS font size */}
      <div className="flex mt-1 text-[10px] text-surface-500 select-none">
        <div style={{ width: `${CPU_BOUNDARY_PCT}%` }} className="text-center shrink-0">
          CPU
        </div>
        <div style={{ width: `${GPU_BOUNDARY_PCT - CPU_BOUNDARY_PCT}%` }} className="text-center shrink-0">
          Balanced
        </div>
        <div className="flex-1 text-center">GPU</div>
      </div>
    </div>
  );
}
