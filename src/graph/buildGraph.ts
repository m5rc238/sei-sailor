import type { Edge, Node } from '@xyflow/react';
import type { Token, TokenGraphData, TokenLayer } from '../types/tokens';

export type NodeStatus = 'plain' | 'selected' | 'reference' | 'dependent' | 'dim';
export type EdgeStatus = 'plain' | 'highlight' | 'dim';

export type TokenNodeData = TokenGraphData & { status: NodeStatus };
export type TokenFlowNode = Node<TokenNodeData, 'token'>;
export type TokenFlowEdge = Edge<{ status: EdgeStatus }>;

export type TokenGraph = {
  nodes: TokenFlowNode[];
  edges: TokenFlowEdge[];
  /** name -> names of tokens that reference it (its downstream consumers). */
  dependents: Map<string, string[]>;
};

export type LayerFilter = TokenLayer | 'all';

/**
 * One edge per `var()` reference, drawn from the referenced token to the token
 * that references it, so arrows run primitive → semantic → component.
 */
export function buildGraph(tokens: Token[]): TokenGraph {
  const dependents = new Map<string, string[]>();
  const nodes: TokenFlowNode[] = [];
  const edges: TokenFlowEdge[] = [];
  const known = new Set(tokens.map((token) => token.name));

  for (const token of tokens) {
    nodes.push({
      id: token.name,
      type: 'token',
      // Replaced by layoutGraph before render.
      position: { x: 0, y: 0 },
      data: {
        token,
        referenceCount: token.references.length,
        dependentCount: 0,
        status: 'plain',
      },
    });

    for (const reference of token.references) {
      if (!known.has(reference) || reference === token.name) continue;
      edges.push({
        id: `${reference} -> ${token.name}`,
        source: reference,
        target: token.name,
        data: { status: 'plain' },
      });
      dependents.set(reference, [...(dependents.get(reference) ?? []), token.name]);
    }
  }

  for (const node of nodes) {
    node.data.dependentCount = dependents.get(node.id)?.length ?? 0;
  }

  return { nodes, edges, dependents };
}

/**
 * Direct dependencies and direct consumers of the selection stay lit; everything
 * else recedes. Nothing here walks transitively — the point is to show one hop
 * of the graph at a time so the reader can keep following edges deliberately.
 */
export function withFocus(graph: TokenGraph, selected: string | null): TokenGraph {
  if (!selected || !graph.nodes.some((node) => node.id === selected)) {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, data: { ...node.data, status: 'plain' } })),
      edges: graph.edges.map((edge) => ({ ...edge, data: { status: 'plain' } })),
    };
  }

  const upstream = new Set(
    graph.nodes.find((node) => node.id === selected)?.data.token.references ?? [],
  );
  const downstream = new Set(graph.dependents.get(selected) ?? []);

  const statusFor = (id: string): NodeStatus => {
    if (id === selected) return 'selected';
    if (upstream.has(id)) return 'reference';
    if (downstream.has(id)) return 'dependent';
    return 'dim';
  };

  const touchesSelection = (edge: TokenFlowEdge) =>
    edge.source === selected || edge.target === selected;

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      data: { ...node.data, status: statusFor(node.id) },
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      data: { status: touchesSelection(edge) ? 'highlight' : 'dim' },
    })),
  };
}

/** Filtering hides nodes; it never rewrites the graph or invents edges. */
export function filterByLayer(
  graph: TokenGraph,
  filter: LayerFilter,
): Pick<TokenGraph, 'nodes' | 'edges'> {
  if (filter === 'all') return { nodes: graph.nodes, edges: graph.edges };

  const nodes = graph.nodes.filter((node) => node.data.token.layer === filter);
  const visible = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => visible.has(edge.source) && visible.has(edge.target),
  );

  return { nodes, edges };
}