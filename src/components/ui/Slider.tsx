interface SliderProps {
  value: number;
  max: number;
  labels?: string[];
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Tiers above this index are VRAM-locked. Labels dim; onChange blocks upward moves. */
  maxAllowed?: number;
}

export function Slider({ value, max, labels, onChange, disabled = false, maxAllowed }: SliderProps) {
  const hasLock = maxAllowed !== undefined && maxAllowed < max;

  return (
    <div className={`w-full ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <input
        type="range"
        className="gso-slider"
        min={0}
        max={max}
        step={1}
        value={value}
        aria-valuemin={0}
        aria-valuemax={maxAllowed !== undefined ? maxAllowed : max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (maxAllowed !== undefined && v > maxAllowed) return;
          onChange(v);
        }}
        disabled={disabled}
      />
      {labels && labels.length > 0 && (
        <div className="flex justify-between mt-1.5">
          {labels.map((label, i) => {
            const locked = hasLock && i > maxAllowed!;
            const active = i === value && !locked;
            return (
              <span
                key={label}
                title={locked ? "VRAM budget limit" : undefined}
                className={`text-[10px] transition-colors duration-150 select-none ${
                  locked
                    ? "text-surface-700"
                    : active
                    ? "text-accent-primary font-semibold"
                    : "text-surface-400"
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
