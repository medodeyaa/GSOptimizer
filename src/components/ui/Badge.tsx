type BadgeVariant = "primary" | "warn" | "danger" | "info" | "muted";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-accent-primary/10 text-accent-primary border-accent-primary/20",
  warn:    "bg-accent-warn/10    text-accent-warn    border-accent-warn/20",
  danger:  "bg-accent-danger/10  text-accent-danger  border-accent-danger/20",
  info:    "bg-accent-info/10    text-accent-info    border-accent-info/20",
  muted:   "bg-surface-700       text-surface-400    border-surface-600",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "muted", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Maps a 0–100 hardware score to a semantic tier badge. */
export function HardwareTierBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge variant="primary">Flagship</Badge>;
  if (score >= 60) return <Badge variant="info">High-End</Badge>;
  if (score >= 45) return <Badge variant="muted">Mid-Range</Badge>;
  if (score >= 30) return <Badge variant="warn">Entry</Badge>;
  return <Badge variant="danger">Budget</Badge>;
}

/** Maps a bottleneck type to its badge. */
export function BottleneckBadge({ type }: { type: "CPU" | "GPU" | "VRAM" | "BALANCED" }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    GPU:      { variant: "warn",    label: "GPU Bottleneck" },
    CPU:      { variant: "info",    label: "CPU Bottleneck" },
    VRAM:     { variant: "danger",  label: "VRAM Exceeded"  },
    BALANCED: { variant: "primary", label: "Balanced"       },
  };
  const { variant, label } = map[type];
  return <Badge variant={variant}>{label}</Badge>;
}
