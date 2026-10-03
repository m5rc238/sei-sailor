import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type XYPosition,
} from '@xyflow/react';
import TokenNode from './TokenNode';
import type { TokenFlowEdge, TokenFlowNode } from '../graph/buildGraph';
import { NODE_HEIGHT, NODE_WIDTH } from '../graph/layoutGraph';

type Props = {
  nodes: TokenFlowNode[];
  edges: TokenFlowEdge[];
  positions: Map<string, XYPosition>;
  /** Token to pan to, or null. */
  centerOn: string | null;
  /** Bumped by "reset layout" to re-run layout and re-fit. */
  layoutResetKey: number;
  onSelect: (name: string | null) => void;
  onResetLayout: () => void;
};

const nodeTypes = { token: TokenNode };

const isTokenNode = (node: Node): node is TokenFlowNode => node.type === 'token';

export default function TokenGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvas({
  nodes,
  edges,
  positions,
  centerOn,
  layoutResetKey,
  onSelect,
  onResetLayout,
}: Props) {
  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow();

  const laidOut = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
      })),
    [nodes, positions],
  );

  const fitAll = useCallback(() => {
    void fitView({ padding: 0.06, duration: 400, maxZoom: 1 });
  }, [fitView]);

  const centreOnToken = useCallback(
    (name: string) => {
      const position = positions.get(name);
      if (!position) return;
      void setCenter(position.x + NODE_WIDTH / 2, position.y + NODE_HEIGHT / 2, {
        zoom: 1,
        duration: 450,
      });
    },
    [positions, setCenter],
  );

  useEffect(() => {
    fitAll();
  }, [fitAll, layoutResetKey]);

  useEffect(() => {
    if (centerOn) centreOnToken(centerOn);
  }, [centerOn, centreOnToken]);

  return (
    <div className="graph">
      <ReactFlow
        nodes={laidOut}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.15}
        maxZoom={1.6}
        className="graph__canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (!isTokenNode(node)) return '#3a424d';
            if (node.data.status === 'dim') return '#2c323b';
            return `var(--layer-${node.data.token.layer})`;
          }}
          nodeStrokeWidth={0}
          maskColor="rgba(13, 15, 19, 0.74)"
        />
      </ReactFlow>

      <div className="graph__controls">
        <button
          type="button"
          onClick={() => void zoomIn({ duration: 200 })}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => void zoomOut({ duration: 200 })}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button type="button" onClick={fitAll} title="Fit graph to viewport" aria-label="Fit graph">
          Fit
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          title="Reset layout and view"
          aria-label="Reset layout"
        >
          Reset
        </button>
      </div>
    </div>
  );
}