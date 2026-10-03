import dagre from '@dagrejs/dagre';
import type { XYPosition } from '@xyflow/react';
import type { TokenFlowEdge, TokenFlowNode } from './buildGraph';
import type { TokenLayer } from '../types/tokens';

export const NODE_WIDTH = 236;
export const NODE_HEIGHT = 68;
const COLUMN_GAP = 120;
const ROW_GAP = 10;

const COLUMNS: TokenLayer[] = ['primitive', 'semantic', 'component'];

/**
 * Dagre ranks the graph from the real edges, then each layer is packed into its
 * own column in the order dagre chose.
 *
 * The column pass matters: dagre puts an unreferenced token such as
 * `--button-height-md: 40px` in rank 0, which would park a component token in
 * the primitive column. Ranking by layer keeps the reading order true without
 * adding an edge that isn't in the CSS to achieve it.
 */
export function layoutGraph(
  nodes: TokenFlowNode[],
  edges: TokenFlowEdge[],
): Map<string, XYPosition> {
  const order = orderWithinColumns(nodes, edges);
  const positions = new Map<string, XYPosition>();
  const tallest = Math.max(...[...order.values()].map((members) => members.length), 1);

  order.forEach((members, column) => {
    // Shorter columns sit centred against the tallest one, so the eye reads the
    // three layers as one system rather than three walls of uneven height.
    const offset = ((tallest - members.length) * (NODE_HEIGHT + ROW_GAP)) / 2;
    members.forEach((id, row) => {
      positions.set(id, {
        x: column * (NODE_WIDTH + COLUMN_GAP),
        y: offset + row * (NODE_HEIGHT + ROW_GAP),
      });
    });
  });

  return positions;
}

/** Token ids grouped by layer column, ordered by dagre's y to reduce crossings. */
function orderWithinColumns(
  nodes: TokenFlowNode[],
  edges: TokenFlowEdge[],
): Map<number, string[]> {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 96, marginx: 0, marginy: 0 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    if (edge.source !== edge.target) graph.setEdge(edge.source, edge.target);
  }

  const ranked = new Map<string, number>();
  try {
    dagre.layout(graph);
    for (const node of nodes) {
      const position = graph.node(node.id);
      ranked.set(node.id, position ? position.y : Number.MAX_SAFE_INTEGER);
    }
  } catch {
    // A var() cycle is a CSS authoring error, not a layout error. Fall back to
    // declaration order rather than losing the graph.
    nodes.forEach((node, index) => ranked.set(node.id, index));
  }

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = Math.max(0, COLUMNS.indexOf(node.data.token.layer));
    const members = columns.get(column) ?? [];
    members.push(node.id);
    columns.set(column, members);
  }

  for (const [column, members] of columns) {
    members.sort((a, b) => (ranked.get(a) ?? 0) - (ranked.get(b) ?? 0));
    columns.set(column, members);
  }

  return columns;
}