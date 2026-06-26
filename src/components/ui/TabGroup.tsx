interface Tab<T> {
  value: T;
  label: string;
}

interface TabGroupProps<T extends string | number> {
  tabs: Tab<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function TabGroup<T extends string | number>({ tabs, value, onChange }: TabGroupProps<T>) {
  return (
    <div className="flex bg-surface-900 border border-surface-700 rounded-lg p-0.5 gap-0.5">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`
              flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150
              ${active
                ? "bg-surface-700 text-[#f5f5f5]"
                : "text-surface-400 hover:text-surface-200"
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
