# Design Token Map

An interactive graph of the design system's token dependencies.

`tokens.css` is the single source of truth. The app parses it and renders every
custom property as a node and every `var()` reference as an edge, so you can see
how a primitive feeds a semantic role and which component tokens sit on top of
it.

```
--blue-500  ──▶  --color-action  ──▶  --button-padding-x-md
PRIMITIVE        SEMANTIC             COMPONENT
```

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173). Edit `tokens.css` and save:
Vite reloads the page and the map re-parses the file, so the graph always
reflects what is in the stylesheet. There is no token list hardcoded in the app.

## What you can do

- **Click a node** to highlight its direct dependencies and everything that
  depends on it; unrelated nodes recede and the details panel shows the token's
  layer, value, computed value, references, and consumers.
- **Search** by name (`action` finds `--color-action`, `--color-action-hover`,
  `--color-action-active`, `--color-action-text`) and jump straight to a node.
- **Filter** to a single layer: All / Primitives / Semantic / Component.
- **Explore** with zoom, fit, reset, drag-to-pan, and a minimap.

## How it works

1. **Parse** (`src/parser/tokensParser.ts`). A single-pass scanner walks the CSS
   and emits comments and custom-property declarations. It is a scanner rather
   than a regex sweep because `tokens.css` contains a declaration split across
   lines (`--font-family`) and comments that *look* like declarations. Comments
   are never treated as declarations, so prose cannot contribute a token or an
   edge.

2. **Infer layers** from the file's own section banners (`— primitives`,
   `— semantic layer`, `Component tokens`) rather than from token names. Category
   labels (`colour`, `action`, `button`, …) come from the `/* --- … --- */`
   markers.

3. **Build the graph** (`src/graph/buildGraph.ts`). Each `var()` first argument
   becomes an edge, drawn from the referenced token to the token that references
   it, so arrows always run primitive → semantic → component.

4. **Lay out** (`src/graph/layoutGraph.ts`). Dagre ranks the real edges, then
   each layer is packed into its own column in Dagre's order. No edges are
   invented to make the layout look tidy.

## One thing this file is deliberate about

`--button-radius`, `--input-radius` and `--card-radius` do **not** exist. Writing
`--button-radius: var(--radius-md)` at the root would resolve once and break
later overrides, so each component declares the dependency where it is used:

```css
border-radius: var(--button-radius, var(--radius-md));
```

Those aliases appear only inside the explanatory comment in `tokens.css`, so the
parser produces no node and no edge for them — as it should. The note itself is
surfaced in the details panel rather than "simplified" away. A fallback such as
`var(--a, var(--b))` is likewise not treated as a dependency on `--b`.

## Project structure

```
src/
  components/
    TokenGraph.tsx     React Flow canvas, controls, minimap, focus centring
    TokenNode.tsx      a single token node
    TokenDetails.tsx   side panel, including notes lifted from the CSS
    TokenSearch.tsx    name search with jump-to-node
    LayerFilter.tsx    All / Primitives / Semantic / Component
  parser/
    tokensParser.ts    CSS scanner, layer/category inference, var() resolution
  graph/
    buildGraph.ts      nodes, edges, dependents, focus + filter helpers
    layoutGraph.ts     Dagre ranking and per-layer columns
  types/
    tokens.ts          Token, TokenLayer, ParseResult
  App.tsx              parse once, wire selection/search/filter state
  main.tsx
  index.css            styling for the tool itself
tokens.css             the source of truth (not generated)
```

## Stack

React 19, TypeScript, Vite, [`@xyflow/react`](https://reactflow.dev) for the
graph, and [`@dagrejs/dagre`](https://github.com/dagrejs/dagre) for layout.
Styling is plain CSS. The CSS parser is hand-written; no parser dependency.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check only |

## Scope

This is a viewer. It does not edit tokens, and it has no backend, database,
authentication, accounts, analytics, or export. Changing the design system means
changing `tokens.css`; the map follows.
