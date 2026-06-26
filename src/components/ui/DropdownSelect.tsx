export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface DropdownSelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DropdownSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
}: DropdownSelectProps) {
  // Group options by their `group` field if present
  const groups = options.reduce<Record<string, SelectOption[]>>((acc, opt) => {
    const key = opt.group ?? "__ungrouped__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {});

  const hasGroups = Object.keys(groups).length > 1 || !groups["__ungrouped__"];

  return (
    <div className="relative">
      <select
        className="
          w-full appearance-none
          bg-surface-700 border border-surface-600
          text-[13px] text-[#f5f5f5]
          px-3 py-2.5 pr-8
          rounded-lg
          cursor-pointer
          focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20
          transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
        "
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {hasGroups
          ? Object.entries(groups).map(([group, opts]) =>
              group === "__ungrouped__" ? (
                opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              ) : (
                <optgroup key={group} label={group}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              )
            )
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>

      {/* Chevron icon */}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
