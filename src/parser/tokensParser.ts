import type { ParseResult, Token, TokenLayer, TokenNote } from '../types/tokens';

type CommentEvent = { kind: 'comment'; text: string; line: number };
type DeclEvent = { kind: 'decl'; property: string; value: string; line: number };
type CssEvent = CommentEvent | DeclEvent;

const CUSTOM_PROPERTY = /^--[A-Za-z0-9_-]+$/;
const FILL_LINE = /^[=\-~_*#\s]+$/;

const LAYER_ORDER: TokenLayer[] = ['primitive', 'semantic', 'component'];

/**
 * Walks the stylesheet once and reports comments and custom-property
 * declarations. This is a scanner rather than a regex sweep over the whole file
 * because tokens.css contains both a declaration split across two lines
 * (--font-family) and comments that *look* like declarations
 * (`--button-radius: var(--radius-md)` inside the radius-alias note). Comments
 * are emitted as events and never as declarations, so prose can never
 * contribute a token or an edge.
 */
function scanCss(css: string): CssEvent[] {
  const events: CssEvent[] = [];
  let buffer = '';
  let declLine = 0;
  let braceDepth = 0;
  let line = 1;
  let i = 0;

  const pushChar = (char: string) => {
    buffer += char;
    if (char === '\n') line += 1;
  };

  const flush = () => {
    const text = buffer.trim();
    buffer = '';
    if (!text || braceDepth === 0) {
      declLine = 0;
      return;
    }
    const colon = text.indexOf(':');
    if (colon === -1) {
      declLine = 0;
      return;
    }
    const property = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).replace(/\s+/g, ' ').trim();
    if (CUSTOM_PROPERTY.test(property)) {
      events.push({ kind: 'decl', property, value, line: declLine });
    }
    declLine = 0;
  };

  while (i < css.length) {
    const char = css[i];

    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end;
      const text = css.slice(i + 2, stop);
      for (let k = 0; k < text.length; k += 1) if (text[k] === '\n') line += 1;
      events.push({ kind: 'comment', text, line });
      i = end === -1 ? css.length : end + 2;
      continue;
    }

    if (char === '"' || char === "'") {
      let k = i + 1;
      while (k < css.length && css[k] !== char) {
        if (css[k] === '\\') k += 1;
        k += 1;
      }
      pushChar(css.slice(i, k + 1));
      i = k + 1;
      continue;
    }

    if (char === '{') {
      braceDepth += 1;
      buffer = '';
      declLine = 0;
      i += 1;
      continue;
    }

    if (char === '}') {
      flush();
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }

    if (char === ';') {
      flush();
      i += 1;
      continue;
    }

    if (declLine === 0 && !/\s/.test(char)) declLine = line;
    pushChar(char);
    i += 1;
  }

  flush();
  return events;
}

/**
 * Reads the title out of a CSS comment. tokens.css uses two shapes:
 *
 *   - `--- colour ---` on one line  → category marker
 *   - a `=` / `-` ruled banner whose title sits on its own line → layer marker
 *
 * Titles are matched on the title line only. The banners mention the other
 * layers in their prose ("Nothing in a component may reference this layer"),
 * so scanning the whole comment body would misclassify every token in the
 * section.
 */
function readCommentMarker(text: string): {
  layer: TokenLayer | null;
  category: string | null;
  title: string;
  body: string;
} {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\*+/g, ' ').trim())
    .filter((line) => line.length > 0);

  const titleIndex = lines.findIndex((line) => !FILL_LINE.test(line));
  if (titleIndex === -1) return { layer: null, category: null, title: '', body: '' };

  const title = lines[titleIndex].replace(/^-+/, '').replace(/-+$/, '').trim();
  const body = lines
    .slice(titleIndex + 1)
    .filter((line) => !FILL_LINE.test(line))
    .join(' ')
    .trim();

  // A dash-delimited one-liner is always a category marker. Banners are bare
  // titles, which is what keeps a category like
  // `--- focus: one role, used by every focusable component ---` from being
  // read as a layer change.
  const isDashMarker = /^-+|-+$/.test(lines[titleIndex]);

  if (isDashMarker) {
    const category = title.split(':')[0].trim();
    return { layer: null, category: category || null, title, body };
  }

  const layer =
    /primitive/i.test(title) ? 'primitive' : /semantic/i.test(title) ? 'semantic' : /component/i.test(title) ? 'component' : null;

  return { layer, category: null, title, body };
}

/**
 * Every `var()` in the value contributes its *first* argument. A fallback such
 * as `var(--button-radius, var(--radius-md))` therefore does not become an edge
 * from --radius-md: that relationship only exists where the var() is written,
 * not where the fallback is declared.
 */
function readReferences(value: string): string[] {
  const refs: string[] = [];
  let depth = 0;
  let i = 0;

  while (i < value.length) {
    const char = value[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;

    if (depth === 0 && value.startsWith('var(', i)) {
      const end = findClosingParen(value, i + 4);
      const inner = end === -1 ? value.slice(i + 4) : value.slice(i + 4, end);
      const name = inner.split(',')[0].trim();
      if (CUSTOM_PROPERTY.test(name)) refs.push(name);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    i += 1;
  }

  return refs.filter((name, index) => refs.indexOf(name) === index);
}

function findClosingParen(value: string, openIndex: number): number {
  let depth = 1;
  for (let i = openIndex; i < value.length; i += 1) {
    if (value[i] === '(') depth += 1;
    else if (value[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Resolves `value` through the var() chain so the panel can answer "which
 * primitive controls this role?" without the reader chasing edges. Stops at
 * anything unknown or cyclic and reports the value as unresolved.
 */
function resolveVars(
  value: string,
  tokens: Map<string, Token>,
  seen: Set<string>,
): { text: string; complete: boolean } {
  let out = '';
  let complete = true;
  let i = 0;

  while (i < value.length) {
    const start = value.indexOf('var(', i);
    if (start === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);

    const end = findClosingParen(value, start + 4);
    const inner = end === -1 ? value.slice(start + 4) : value.slice(start + 4, end);
    const [head, ...rest] = splitTopLevel(inner);
    const name = head.trim();

    if (tokens.has(name) && !seen.has(name)) {
      seen.add(name);
      const nested = resolveVars(tokens.get(name)!.value, tokens, seen);
      out += nested.text;
      complete = complete && nested.complete;
    } else if (rest.length > 0) {
      const fallback = resolveVars(rest.join(','), tokens, seen);
      out += fallback.text;
      complete = complete && fallback.complete;
    } else {
      out += `var(${inner})`;
      complete = false;
    }

    if (end === -1) break;
    i = end + 1;
  }

  return { text: out.replace(/\s+/g, ' ').trim(), complete };
}

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of inner) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Used only when a stylesheet has no layer banners at all. */
function inferLayer(name: string, hasReferences: boolean): TokenLayer {
  if (/^--(button|input|card|form|stack|nav|menu|modal|table|badge|chip|tooltip|toast|field)/.test(name)) {
    return 'component';
  }
  if (/^--(color|colour|focus|role|surface|text|on)/.test(name)) return 'semantic';
  if (hasReferences) return 'semantic';
  return 'primitive';
}

export function parseTokens(css: string): ParseResult {
  const tokens = new Map<string, Token>();
  const notes: TokenNote[] = [];

  let layer: TokenLayer | null = null;
  let category: string | null = null;

  for (const event of scanCss(css)) {
    if (event.kind === 'comment') {
      const marker = readCommentMarker(event.text);
      if (marker.layer) {
        layer = marker.layer;
        category = null;
      }
      if (marker.category) category = marker.category;
      if (/radius alias/i.test(marker.title) && marker.body) {
        notes.push({ title: marker.title, body: marker.body });
      }
      continue;
    }

    const references = readReferences(event.value);
    const token: Token = {
      name: event.property,
      value: event.value,
      layer: layer ?? inferLayer(event.property, references.length > 0),
      category: category ?? undefined,
      references,
      resolvedValue: event.value,
      layerSource: layer ? 'section' : 'inferred',
      line: event.line,
    };
    tokens.set(token.name, token);
  }

  for (const token of tokens.values()) {
    const { text, complete } = resolveVars(token.value, tokens, new Set([token.name]));
    token.resolvedValue = complete ? text : token.value;
  }

  const unresolvedReferences = [
    ...new Set(
      [...tokens.values()].flatMap((token) =>
        token.references.filter((reference) => !tokens.has(reference)),
      ),
    ),
  ];

  const layerCounts = LAYER_ORDER.reduce(
    (counts, name) => {
      counts[name] = [...tokens.values()].filter((token) => token.layer === name).length;
      return counts;
    },
    {} as Record<TokenLayer, number>,
  );

  return {
    tokens: [...tokens.values()],
    unresolvedReferences,
    layerCounts,
    notes,
  };
}