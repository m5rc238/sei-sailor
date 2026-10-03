import type { LayerFilter as LayerFilterValue } from '../graph/buildGraph';
import type { TokenLayer } from '../types/tokens';

type Props = {
  value: LayerFilterValue;
  counts: Record<TokenLayer, number>;
  onChange: (value: LayerFilterValue) => void;
};

const OPTIONS: { value: LayerFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'primitive', label: 'Primitives' },
  { value: 'semantic', label: 'Semantic' },
  { value: 'component', label: 'Component' },
];

export default function LayerFilter({ value, counts, onChange }: Props) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="filters" role="group" aria-label="Filter by layer">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filters__button${value === option.value ? ' is-active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.value !== 'all' && (
            <span className={`filters__dot filters__dot--${option.value}`} aria-hidden="true" />
          )}
          {option.label}
          <span className="filters__count">
            {option.value === 'all' ? total : counts[option.value]}
          </span>
        </button>
      ))}
    </div>
  );
}