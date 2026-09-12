// Dumb presentational chip row for the "Running into blocks?" section. Tapping a chip is
// equivalent to typing its label into the agent input bar with the current step scoped.
export type BlockerChipsProps = {
  chips: string[];
  onSelect: (label: string) => void;
  disabled?: boolean;
};

export default function BlockerChips({ chips, onSelect, disabled }: BlockerChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-black/50">Running into blocks?</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip}
            disabled={disabled}
            onClick={() => onSelect(chip)}
            className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
