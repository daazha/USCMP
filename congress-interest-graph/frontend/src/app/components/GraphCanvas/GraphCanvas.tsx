import { useEffect, useRef } from 'react';
import { Graph } from '@antv/g6';
import type { GraphResponse, GraphNode, GraphEdge } from '../../api/types';

interface Props {
  graph: GraphResponse;
  onDoubleClickNode: (nodeId: string) => void;
  onEdgeClick: (claimId: string) => void;
  height?: string | number;
}

const EDGE_COLORS: Record<string, string> = {
  RECEIVED_CONTRIBUTION: '#52c41a',
  HOLDS_STOCK: '#73d13d',
  RECEIVED_LOBBYING_SUPPORT: '#95de64',
  ALUMNI_OF: '#1890ff',
  RELATED_TO: '#40a9ff',
  FORMER_EMPLOYER: '#69c0ff',
  FUTURE_EMPLOYER: '#91d5ff',
  SPONSORED_BILL: '#f5222d',
  COSPONSORED_BILL: '#ff4d4f',
  VOTED_FOR: '#ff7875',
  VOTED_AGAINST: '#ffa39e',
  SERVED_ON_COMMITTEE: '#ff4d4f',
  MADE_STATEMENT: '#ff7875',
  PARTICIPATED_IN: '#faad14',
  ASSOCIATED_WITH_EVENT: '#ffc53d',
  HAS_CLAIM: '#595959',
  EVIDENCED_BY: '#595959',
};

const NODE_COLORS: Record<string, string> = {
  Person: '#1890ff',
  Organization: '#722ed1',
  PoliticalEntity: '#eb2f96',
  Event: '#fa8c16',
  Claim: '#8c8c8c',
  SourceDocument: '#595959',
};

const NODE_SHAPES: Record<string, string> = {
  Person: 'circle',
  Organization: 'rect',
  PoliticalEntity: 'diamond',
  Event: 'hexagon',
  Claim: 'circle',
  SourceDocument: 'rect',
};

export default function GraphCanvas({ graph, onDoubleClickNode, onEdgeClick, height = 600 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const g6Ref = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;

    if (graph.nodes.length > 500) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g6Data: any = {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        data: {
          label: getNodeLabel(n),
          nodeType: n.label,
          color: NODE_COLORS[n.label] || '#8c8c8c',
          size: getNodeSize(n),
          ...n.properties,
        },
        style: {
          fill: NODE_COLORS[n.label] || '#8c8c8c',
          size: getNodeSize(n),
        },
      })),
      edges: graph.edges.map((e) => {
        const isLowConfidence = e.confidence_score !== undefined && e.confidence_score < 0.5;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          data: e,
          style: {
            stroke: EDGE_COLORS[e.type] || '#6b7280',
            lineWidth: isLowConfidence ? 1 : 2,
            lineDash: isLowConfidence ? [4, 4] : undefined,
            opacity: isLowConfidence ? 0.4 : 0.8,
          },
        };
      }),
    };

    const g6 = new Graph({
      container,
      width,
      height: typeof height === 'number' ? height : 600,
      autoFit: 'view',
      layout: {
        type: 'radial' as const,
        unitRadius: 100,
        preventOverlap: true,
        linkDistance: 120,
      },
      node: {
        style: {
          labelText: (d: Record<string, unknown>) => {
            const data = (d.data || d) as Record<string, unknown>;
            return (data.label || d.id) as string;
          },
          labelFontSize: 10,
          labelFill: '#e5e7eb',
          labelPlacement: 'bottom',
        },
      },
      edge: {
        style: {
          endArrow: true,
        },
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    });

    g6.setData(g6Data);
    g6.render();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g6.on('node:click', (evt: any) => {
      const nodeId = evt?.target?.id as string;
      if (nodeId) onDoubleClickNode(nodeId);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g6.on('edge:click', (evt: any) => {
      const edgeData = evt?.target?.data;
      const claimId = edgeData?.claim_id as string;
      if (claimId) onEdgeClick(claimId);
    });

    g6Ref.current = g6;

    return () => {
      g6.destroy();
      g6Ref.current = null;
    };
  }, [graph]);

  if (graph.nodes.length > 500) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#faad14', fontSize: 16, flexDirection: 'column', gap: 8,
      }}>
        <div>图谱节点过多 ({graph.nodes.length} &gt; 500)</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>请缩小查询范围后重试</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', background: '#0a0e17' }}
    />
  );
}

function getNodeLabel(node: GraphNode): string {
  const props = node.properties;
  return (props.display_name || props.canonical_name || props.name || props.title || node.id) as string;
}

function getNodeSize(node: GraphNode): number {
  const sizes: Record<string, number> = {
    Person: 40, Organization: 36, PoliticalEntity: 32,
    Event: 28, Claim: 12, SourceDocument: 14,
  };
  return sizes[node.label] || 24;
}
