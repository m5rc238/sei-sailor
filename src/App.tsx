import { useMemo, useState } from 'react';
import tokensCss from '../tokens.css?raw';
import { parseTokens } from './parser/tokensParser';
import { buildGraph, filterByLayer, withFocus, type LayerFilter as LayerFilterValue } from './graph/buildGraph';
import { layoutGraph } from './graph/layoutGraph';
import TokenGraph from './components/TokenGraph';
import TokenDetails from './components/TokenDetails';
import TokenSearch from './components/TokenSearch';
import LayerFilter from './components/LayerFilter';

export default function App() {
  // tokens.css is the single source of truth: it is imported as text and
  // re-parsed on reload, so editing the file and saving updates the graph.
  const parsed = useMemo(() => parseTokens(tokensCss), []);

  const graph = useMemo(() => buildGraph(parsed.tokens), [parsed.tokens]);
  const positions = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<LayerFilterValue>('all');
  const [centerOn, setCenterOn] = useState<string | null>(null);
  const [layoutResetKey, setLayoutResetKey] = useState(0);

  const focused = useMemo(() => withFocus(graph, selected), [graph, selected]);
  const visible = useMemo(() => filterByLayer(focused, filter), [focused, filter]);

  const selectedToken =
    parsed.tokens.find((token) => token.name === selected) ?? null;

  const select = (name: string | null, { centre = false } = {}) => {
    setSelected(name);
    if (centre && name) setCenterOn(name);
  };

  const resetLayout = () => {
    setSelected(null);
    setCenterOn(null);
    setLayoutResetKey((key) => key + 1);
  };

  return (
    <div className="app">
      <header className="app__bar">
        <h1 className="app__title">
          Design Token Map
          <span className="app__source">tokens.css</span>
        </h1>

        <TokenSearch
          tokens={parsed.tokens}
          onPick={(name) => select(name, { centre: true })}
        />

        <LayerFilter value={filter} counts={parsed.layerCounts} onChange={setFilter} />
      </header>

      <main className="app__main">
        <TokenGraph
          nodes={visible.nodes}
          edges={visible.edges}
          positions={positions}
          centerOn={centerOn}
          layoutResetKey={layoutResetKey}
          onSelect={select}
          onResetLayout={resetLayout}
        />
        <TokenDetails
          token={selectedToken}
          dependents={selected ? (graph.dependents.get(selected) ?? []) : []}
          notes={parsed.notes}
          onSelect={(name) => select(name, { centre: true })}
        />
      </main>
    </div>
  );
}