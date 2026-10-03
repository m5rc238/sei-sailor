export type TokenLayer = 'primitive' | 'semantic' | 'component';

export type Token = {
  /** Custom property name, including the leading `--`. */
  name: string;
  /** Value as authored, whitespace-normalised but otherwise untouched. */
  value: string;
  layer: TokenLayer;
  category?: string;
  /** Names of tokens referenced via `var()` in `value`, in source order. */
  references: string[];
  /** `value` with every `var()` chain resolved, when all references are known. */
  resolvedValue: string;
  /** Which of `layer`, `category` or a name heuristic decided the layer. */
  layerSource: 'section' | 'inferred';
  line: number;
};

export type ParseResult = {
  tokens: Token[];
  /** References pointing at names that are not declared in this stylesheet. */
  unresolvedReferences: string[];
  /** Layer assignment counts, for a quick sanity check against the file. */
  layerCounts: Record<TokenLayer, number>;
  /** Prose lifted out of tokens.css that the graph cannot express as edges. */
  notes: TokenNote[];
};

export type TokenNote = {
  title: string;
  body: string;
};

export type TokenGraphData = {
  token: Token;
  /** Number of tokens this one references (upstream). */
  referenceCount: number;
  /** Number of tokens that reference this one (downstream). */
  dependentCount: number;
};