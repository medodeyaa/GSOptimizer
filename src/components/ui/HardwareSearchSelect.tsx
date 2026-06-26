import { useState, useRef, useEffect, useMemo } from "react";
import type { SelectOption } from "./DropdownSelect";

interface HardwareSearchSelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Icon variant shown in the input */
  icon?: "cpu" | "gpu" | "game";
}

// Cap the number of rendered rows so very large catalogs (20k+ games) stay
// responsive. Options are passed pre-sorted by relevance, so the cap surfaces
// the most relevant entries; narrowing the search reveals the rest.
const RENDER_CAP = 150;

// ── Small SVG icons ───────────────────────────────────────────────────────────

function CpuIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="9" width="6" height="6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  );
}

function GpuIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="2" y="7" width="20" height="12" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7V5M10 7V5M14 7V5M18 7V5M7 19v2M17 19v2" />
      <circle cx="8" cy="13" r="1.5" strokeWidth={1.8} />
      <circle cx="13" cy="13" r="1.5" strokeWidth={1.8} />
    </svg>
  );
}

function GameIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M6 12h4m-2-2v4M15 11h.01M18 13h.01M7.5 7h9a4.5 4.5 0 0 1 4.46 3.9l.6 4.2A2.5 2.5 0 0 1 19.1 18c-.9 0-1.73-.48-2.18-1.26l-.4-.74a2 2 0 0 0-1.74-1H9.22a2 2 0 0 0-1.74 1l-.4.74A2.5 2.5 0 0 1 4.9 18a2.5 2.5 0 0 1-2.46-2.9l.6-4.2A4.5 4.5 0 0 1 7.5 7Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HardwareSearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled = false,
  icon = "gpu",
}: HardwareSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Resolve the selected option label
  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value]
  );

  // Deduplicate by label (case-insensitive), skip blank labels
  const deduped = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    return options.filter((o) => {
      const key = o.label.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [options]);

  // Filter by search query
  const filtered = useMemo<SelectOption[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deduped;
    return deduped.filter((o) => o.label.toLowerCase().includes(q));
  }, [deduped, query]);

  // Cap how many rows we actually render — large catalogs (20k+ games) would
  // otherwise mount tens of thousands of DOM nodes on open.
  const capped = useMemo(() => filtered.slice(0, RENDER_CAP), [filtered]);

  // Group capped results
  const groups = useMemo<[string, SelectOption[]][]>(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of capped) {
      const key = o.group ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()];
  }, [capped]);

  // Flat list of rendered options for keyboard nav
  const flatFiltered = capped;

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setActiveIdx(-1);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); setQuery(""); return; }
    if (!open) { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { setOpen(true); e.preventDefault(); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flatFiltered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) {
      const opt = flatFiltered[activeIdx];
      if (opt) { onChange(opt.value); setOpen(false); setQuery(""); setActiveIdx(-1); }
    }
  }

  function selectOption(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setActiveIdx(-1);
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  }

  const Icon = icon === "cpu" ? CpuIcon : icon === "game" ? GameIcon : GpuIcon;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`
          w-full flex items-center gap-2.5
          bg-surface-700 border rounded-lg
          px-3 py-2.5 text-left
          transition-all duration-150
          focus:outline-none
          disabled:opacity-40 disabled:cursor-not-allowed
          ${open
            ? "border-accent-primary/60 ring-1 ring-accent-primary/20"
            : "border-surface-600 hover:border-surface-500"
          }
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Hardware icon */}
        <span className={`shrink-0 ${value ? "text-accent-primary" : "text-surface-400"}`}>
          <Icon />
        </span>

        {/* Label / placeholder */}
        <span className={`flex-1 text-[13px] truncate ${value ? "text-[#f5f5f5]" : "text-surface-400"}`}>
          {value ? selectedLabel : placeholder}
        </span>

        {/* Clear / chevron */}
        <span className="shrink-0 text-surface-400 hover:text-surface-200 transition-colors">
          {value ? (
            <span onClick={clearSelection}><XIcon /></span>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="
          absolute z-50 top-full mt-1.5 w-full
          bg-surface-800 border border-surface-600
          rounded-xl shadow-2xl shadow-black/40
          overflow-hidden
          animate-in fade-in slide-in-from-top-1 duration-100
        ">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-surface-700">
            <span className="text-surface-400 shrink-0"><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
              placeholder="Type to search…"
              className="
                flex-1 bg-transparent text-[13px] text-[#f5f5f5]
                placeholder:text-surface-500
                focus:outline-none
              "
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-surface-400 hover:text-surface-200 transition-colors"
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Results */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto gso-scroll py-1"
          >
            {groups.length === 0 ? (
              <li className="px-4 py-3 text-[12px] text-surface-500 text-center">
                No results for &ldquo;{query}&rdquo;
              </li>
            ) : (
              (() => {
                let globalIdx = 0;
                return groups.map(([group, opts]) => (
                  <li key={group}>
                    {/* Group header */}
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-500 select-none">
                      {group}
                    </div>
                    <ul>
                      {opts.map((opt) => {
                        const idx = globalIdx++;
                        const isActive = idx === activeIdx;
                        const isSelected = opt.value === value;
                        return (
                          <li
                            key={opt.value}
                            data-idx={idx}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => selectOption(opt)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`
                              flex items-center gap-2 px-3 py-2 cursor-pointer
                              text-[13px] transition-colors duration-75
                              ${isActive ? "bg-surface-700" : ""}
                              ${isSelected ? "text-accent-primary" : "text-surface-200"}
                            `}
                          >
                            {/* Check mark for selected */}
                            <span className={`shrink-0 w-3.5 h-3.5 ${isSelected ? "opacity-100" : "opacity-0"}`}>
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ));
              })()
            )}
          </ul>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-surface-700 flex items-center gap-3 text-[10px] text-surface-600">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>Esc close</span>
            <span className="ml-auto">
              {filtered.length > RENDER_CAP
                ? `${RENDER_CAP} of ${filtered.length}`
                : `${filtered.length} results`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
