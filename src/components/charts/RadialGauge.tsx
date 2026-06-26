// SVG semi-arc gauge for a single 0–1 value.
// Uses strokeDashoffset animation — no D3 needed.

const R  = 58;
const CX = 60;
const CY = 78;

// 220° arc starting at 163° (bottom-left), ending at 17° (bottom-right), sweeping CCW through top.
// sin(163°) ≈ 0.292 → endpoint y = 78 + 58*0.292 ≈ 95, leaving 5 px cap clearance in 100-tall viewBox.
const START_DEG  = 163;
const SWEEP_DEG  = 220;
const END_DEG    = START_DEG + SWEEP_DEG; // 383° — trig handles mod automatically

const ARC_LEN = (SWEEP_DEG / 360) * 2 * Math.PI * R; // ≈ 222.6

function pt(deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [+(CX + R * Math.cos(rad)).toFixed(2), +(CY + R * Math.sin(rad)).toFixed(2)];
}

const [sx, sy] = pt(START_DEG);
const [ex, ey] = pt(END_DEG);

// large-arc=1 (220° > 180°), sweep=1 (CW / increasing-θ from lower-left goes UP through 12 o'clock)
const TRACK_D = `M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`;

function arcColor(v: number): string {
  if (v >= 0.85) return "var(--color-accent-danger, #f87171)";
  if (v >= 0.65) return "var(--color-accent-warn, #fbbf24)";
  return "var(--color-accent-primary, #6ee7b7)";
}

interface RadialGaugeProps {
  value: number;   // 0–1
  label: string;
  size?: string;   // Tailwind width class, e.g. "w-28"
}

export function RadialGauge({ value, label, size = "w-28" }: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const offset  = ARC_LEN * (1 - clamped);
  const color   = arcColor(clamped);
  const pct     = Math.round(clamped * 100);

  return (
    <div className={`${size} flex flex-col items-center`}>
      <svg
        viewBox="0 0 120 100"
        className="w-full overflow-visible"
        aria-label={`${label}: ${pct}%`}
      >
        {/* Track */}
        <path
          d={TRACK_D}
          fill="none"
          stroke="var(--color-surface-700, #1e1e1e)"
          strokeWidth={10}
          strokeLinecap="round"
        />

        {/* Fill — animated via strokeDashoffset */}
        <path
          d={TRACK_D}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.4s ease-out, stroke 0.35s ease-out",
          }}
        />

        {/* Percentage */}
        <text
          x={CX}
          y={63}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f5f5f5"
          fontSize={22}
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
          letterSpacing="-0.5"
        >
          {pct}
          <tspan fontSize={12} fontWeight="400" fill="#888">%</tspan>
        </text>

        {/* Label */}
        <text
          x={CX}
          y={78}
          textAnchor="middle"
          fill="#888888"
          fontSize={8.5}
          fontWeight="500"
          letterSpacing="0.08em"
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
