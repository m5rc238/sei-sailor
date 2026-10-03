import { useMemo, useState } from 'react';
import type { Token } from '../types/tokens';

type Props = {
  tokens: Token[];
  onPick: (name: string) => void;
};

const MAX_RESULTS = 10;

export default function TokenSearch({ tokens, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^-+/, '');
    if (!needle) return [];
    return tokens
      .filter((token) => token.name.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [query, tokens]);

  const pick = (name: string) => {
    onPick(name);
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        className="search__input"
        type="search"
        value={query}
        placeholder="Search tokens…  e.g. action"
        aria-label="Search tokens"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.currentTarget.blur();
          }
          if (event.key === 'Enter' && results.length > 0) pick(results[0].name);
        }}
      />

      {open && query.trim() !== '' && (
        <ul className="search__results">
          {results.length === 0 && <li className="search__empty">No token matches “{query}”.</li>}
          {results.map((token) => (
            <li key={token.name}>
              <button type="button" className="search__result" onMouseDown={() => pick(token.name)}>
                <code>{token.name}</code>
                <span className={`search__result-layer search__result-layer--${token.layer}`}>
                  {token.layer}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}