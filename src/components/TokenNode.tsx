import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TokenFlowNode } from '../graph/buildGraph';

const LAYER_LABEL = {
  primitive: 'Primitive',
  semantic: 'Semantic',
  component: 'Component',
} as const;

function TokenNodeView({ data }: NodeProps<TokenFlowNode>) {
  const { token, referenceCount, dependentCount, status } = data;

  return (
    <div className={`token-node token-node--${token.layer} is-${status}`}>
      <Handle type="target" position={Position.Left} className="token-handle" />
      <div className="token-node__head">
        <span className="token-node__name" title={token.name}>
          {token.name}
        </span>
        <span className="token-node__layer">{LAYER_LABEL[token.layer]}</span>
      </div>
      <div className="token-node__value" title={token.value}>
        {token.value}
      </div>
      <div className="token-node__foot">
        <span title="References — tokens this one depends on">
          ↑{referenceCount}
        </span>
        <span title="Used by — tokens that depend on this one">↓{dependentCount}</span>
        {token.category && (
          <span className="token-node__category" title={`Category: ${token.category}`}>
            {token.category}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="token-handle" />
    </div>
  );
}

export default memo(TokenNodeView);