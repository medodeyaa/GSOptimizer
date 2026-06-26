type BarVariant = "primary" | "warn" | "danger" | "info";

const FILL_COLORS: Record<BarVariant, string> = {
  primary: "bg-accent-primary",
  warn:    "bg-accent-warn",
  danger:  "bg-accent-danger",
  info:    "bg-accent-info",
};

function variantFromValue(value: number): BarVariant {
  if (value >= 0.95) return "danger";
  if (value >= 0.80) return "warn";
  return "primary";
}

interface ProgressBarProps {
  /** 0.0 – 1.0 */
  value: number;
  variant?: BarVariant | "auto";
  className?: string;
  height?: "sm" | "md";
}

export function ProgressBar({
  value,
  variant = "auto",
  className = "",
  height = "md",
}: ProgressBarProps) {
  const resolved: BarVariant = variant === "auto" ? variantFromValue(value) : variant;
  const clamped = Math.min(Math.max(value, 0), 1);
  const heightClass = height === "sm" ? "h-1" : "h-1.5";

  return (
    <div className={`w-full bg-surface-700 rounded-full overflow-hidden ${heightClass} ${className}`}>
      <div
        className={`${heightClass} rounded-full transition-all duration-300 ${FILL_COLORS[resolved]}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

/** Stacked bar — each segment has a fraction (0–1) of the total and a raw CSS color. */
export interface StackedSegment {
  id: string;
  fraction: number;
  color: string;
  label: string;
}

interface StackedProgressBarProps {
  segments: StackedSegment[];
  overBudget?: boolean;
  className?: string;
}

export function StackedProgressBar({ segments, overBudget = false, className = "" }: StackedProgressBarProps) {
  return (
    <div
      className={`w-full h-2 bg-surface-700 rounded-full overflow-hidden flex ${className} ${overBudget ? "ring-1 ring-accent-danger" : ""}`}
    >
      {segments.map((seg) => (
        <div
          key={seg.id}
          style={{ width: `${Math.min(seg.fraction, 1) * 100}%`, backgroundColor: seg.color }}
          title={seg.label}
          className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
        />
      ))}
    </div>
  );
}
