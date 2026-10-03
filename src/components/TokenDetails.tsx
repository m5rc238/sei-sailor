import type { Token, TokenNote } from '../types/tokens';

type Props = {
  token: Token | null;
  dependents: string[];
  notes: TokenNote[];
  onSelect: (name: string) => void;
};

const LAYER_MEANING: Record<Token['layer'], string> = {
  primitive: 'A raw value with no opinion about where it is used.',
  semantic: 'A named role. Components consume this layer, never a primitive.',
  component: 'A single component decision, owned by exactly one token.',
};

export default function TokenDetails({ token, dependents, notes, onSelect }: Props) {
  if (!token) {
    return (
      <aside className="panel">
        <div className="panel__empty">
          <h2>Design tokens, as a graph</h2>
          <p>
            Every node is a custom property from <code>tokens.css</code>. Every edge is a
            real <code>var()</code> reference, running from what a token depends on to
            what depends on it.
          </p>
          <ul className="panel__hints">
            <li>Select a token to light up what it depends on and what depends on it.</li>
            <li>Arrows run <strong>primitive → semantic → component</strong>.</li>
            <li>Values that differ from the source are shown as written, never rewritten.</li>
          </ul>
        </div>
        <Notes notes={notes} />
      </aside>
    );
  }

  const isResolved = token.resolvedValue !== token.value;

  return (
    <aside className="panel">
      <header className="panel__head">
        <code className="panel__token">{token.name}</code>
        <span className={`chip chip--${token.layer}`}>{token.layer}</span>
      </header>

      <dl className="panel__rows">
        <div className="panel__row">
          <dt>Layer</dt>
          <dd>
            <span className="panel__capital">{token.layer}</span>
            {token.category && <span className="panel__sub"> · {token.category}</span>}
            <p className="panel__note">{LAYER_MEANING[token.layer]}</p>
          </dd>
        </div>

        <div className="panel__row">
          <dt>Value</dt>
          <dd>
            <code className="panel__value">{token.value}</code>
            {isResolved && (
              <p className="panel__note">
                Computes to <code className="panel__value">{token.resolvedValue}</code>
              </p>
            )}
          </dd>
        </div>

        <div className="panel__row">
          <dt>References</dt>
          <dd>
            {token.references.length === 0 ? (
              <p className="panel__note">
                {token.layer === 'primitive'
                  ? 'Nothing — this is a raw value. It is the bottom of the graph.'
                  : 'Nothing — this token is authored as a literal.'}
              </p>
            ) : (
              <TokenList names={token.references} onSelect={onSelect} />
            )}
          </dd>
        </div>

        <div className="panel__row">
          <dt>Used by</dt>
          <dd>
            {dependents.length === 0 ? (
              <p className="panel__note">Nothing references this token yet.</p>
            ) : (
              <TokenList names={dependents} onSelect={onSelect} />
            )}
          </dd>
        </div>
      </dl>

      <p className="panel__source">tokens.css:{token.line}</p>
      <Notes notes={notes} />
    </aside>
  );
}

function TokenList({ names, onSelect }: { names: string[]; onSelect: (name: string) => void }) {
  return (
    <ul className="panel__list">
      {names.map((name) => (
        <li key={name}>
          <button type="button" className="link" onClick={() => onSelect(name)}>
            {name}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * tokens.css explains why --button-radius, --input-radius and --card-radius are
 * deliberately absent, and that note is a property of the file. It is lifted
 * out of the stylesheet and shown here rather than resolved into edges the CSS
 * does not contain.
 */
function Notes({ notes }: { notes: TokenNote[] }) {
  if (notes.length === 0) return null;

  return (
    <div className="panel__notes">
      {notes.map((note) => (
        <details key={note.title}>
          <summary>{note.title}</summary>
          <p>{note.body}</p>
        </details>
      ))}
    </div>
  );
}