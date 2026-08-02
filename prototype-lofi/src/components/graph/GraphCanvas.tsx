// ============================================================
// 数字产品系统 - 图可视化组件
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import { Divider } from 'antd';
import {
  GatewayOutlined,
  ShopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { GraphNode, GraphEdge, StructType } from '../../types';
import { NODE_TYPE_CONFIG, EDGE_TYPE_CONFIG } from '../../types';
import styles from './GraphCanvas.module.css';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
  showLabels?: boolean;
  showEdges?: boolean;
  height?: string | number;
  readonly?: boolean;
}

const STRUCT_ICONS: Record<StructType, React.ReactNode> = {
  PRODUCT_CLASS: <GatewayOutlined />,
  PRODUCT_INSTANCE: <ShopOutlined />,
  PART_CLASS: <AppstoreOutlined />,
  PART: <FileTextOutlined />,
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onNodeSelect,
  onEdgeSelect,
  onNodeDrag,
  showLabels = true,
  showEdges = true,
  height = 'calc(100vh - 200px)',
  readonly = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const getEdgePath = (source: GraphNode, target: GraphNode): string => {
    const sx = source.x! + NODE_WIDTH / 2;
    const sy = source.y! + NODE_HEIGHT / 2;
    const tx = target.x! + NODE_WIDTH / 2;
    const ty = target.y! + NODE_HEIGHT / 2;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const curvature = len > 200 ? 30 : 15;
    const cpx = mx + (dy / len) * curvature;
    const cpy = my - (dx / len) * curvature;
    return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
  };

  const getEdgeMidPoint = (source: GraphNode, target: GraphNode): { x: number; y: number } => {
    const sx = source.x! + NODE_WIDTH / 2;
    const sy = source.y! + NODE_HEIGHT / 2;
    const tx = target.x! + NODE_WIDTH / 2;
    const ty = target.y! + NODE_HEIGHT / 2;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const curvature = len > 200 ? 30 : 15;
    const cpx = mx + (dy / len) * curvature;
    const cpy = my - (dx / len) * curvature;
    return { x: cpx, y: cpy };
  };

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (readonly) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    setDragging(nodeId);
    setDragOffset({ x: x - node.x!, y: y - node.y! });
  }, [nodes, readonly]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left - dragOffset.x;
    const y = e.clientY - svgRect.top - dragOffset.y;
    onNodeDrag?.(dragging, x, y);
  }, [dragging, dragOffset, onNodeDrag]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleCanvasClick = useCallback(() => {
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
  }, [onNodeSelect, onEdgeSelect]);

  const handleEdgeClick = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    onEdgeSelect?.(edgeId);
  }, [onEdgeSelect]);

  const renderNode = (node: GraphNode) => {
    const config = NODE_TYPE_CONFIG[node.structType];
    const isSelected = selectedNodeId === node.id;
    const isDragging = dragging === node.id;

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        style={{ cursor: readonly ? 'default' : 'move' }}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        onClick={(e) => {
          e.stopPropagation();
          onNodeSelect?.(node.id);
        }}
      >
        {/* 节点背景：浅色背景 + 类型色边框 */}
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={6}
          fill={isSelected ? `${config.color}12` : '#ffffff'}
          stroke={isSelected ? config.color : '#dde5f4'}
          strokeWidth={isSelected ? 2 : 1.5}
          className={isDragging ? styles.nodeDragging : ''}
        />
        {/* 左侧类型色条 */}
        <rect
          width={4}
          height={NODE_HEIGHT}
          rx={2}
          fill={config.color}
        />
        {/* 节点图标 */}
        <foreignObject x={12} y={10} width={40} height={40}>
          <div className={styles.nodeIcon} style={{ color: config.color }}>
            {STRUCT_ICONS[node.structType]}
          </div>
        </foreignObject>
        {/* 节点信息 */}
        {showLabels && (
          <>
            <text
              x={60}
              y={26}
              fill="#1a1f36"
              fontSize={13}
              fontWeight={500}
              className={styles.nodeName}
            >
              {node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name}
            </text>
            <text
              x={60}
              y={44}
              fill="#6b7594"
              fontSize={11}
            >
              {node.code.length > 14 ? node.code.slice(0, 14) + '...' : node.code}
            </text>
          </>
        )}
        {/* 状态圆点 */}
        <circle
          cx={NODE_WIDTH - 16}
          cy={16}
          r={6}
          fill={
            node.status === 'PUBLISHED' || node.status === 'ACTIVE'
              ? '#27ae60'
              : node.status === 'DRAFT'
                ? '#f0b429'
                : '#a0aec0'
          }
        />
        {/* 选中高亮 */}
        {isSelected && (
          <rect
            width={NODE_WIDTH + 4}
            height={NODE_HEIGHT + 4}
            x={-2}
            y={-2}
            rx={8}
            fill="none"
            stroke={config.color}
            strokeWidth={2}
            strokeDasharray="4,2"
            className={styles.nodeSelected}
          />
        )}
      </g>
    );
  };

  const renderEdge = (edge: GraphEdge) => {
    const source = nodes.find(n => n.id === edge.sourceId);
    const target = nodes.find(n => n.id === edge.targetId);
    if (!source || !target) return null;

    const config = EDGE_TYPE_CONFIG[edge.relationType];
    const isSelected = selectedEdgeId === edge.id;
    const mid = getEdgeMidPoint(source, target);

    return (
      <g key={edge.id} onClick={(e) => handleEdgeClick(e, edge.id)}>
        <path
          d={getEdgePath(source, target)}
          fill="none"
          stroke={isSelected ? '#2b6de1' : config.color}
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeDasharray={config.style === 'dashed' ? '6,3' : 'none'}
          opacity={0.7}
          style={{ cursor: 'pointer' }}
          markerEnd={`url(#arrow-${config.color.replace('#', '')})`}
        />
        {showLabels && (
          <g transform={`translate(${mid.x - 30}, ${mid.y - 20})`}>
            <rect
              width={60}
              height={20}
              rx={4}
              fill="#ffffff"
              stroke={isSelected ? '#2b6de1' : '#dde5f4'}
              strokeWidth={1}
            />
            <text
              x={30}
              y={14}
              fill="#6b7594"
              fontSize={10}
              textAnchor="middle"
            >
              {config.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className={styles.canvasContainer} style={{ height }}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        width="100%"
        height="100%"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          {Object.values(EDGE_TYPE_CONFIG).map((config, i) => (
            <marker
              key={i}
              id={`arrow-${config.color.replace('#', '')}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={config.color} />
            </marker>
          ))}
        </defs>
        {showEdges && edges.map(renderEdge)}
        {nodes.map(renderNode)}
      </svg>

      {/* 图例 */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>节点类型</div>
        {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => (
          <div key={type} className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: config.color }} />
            <span>{config.label}</span>
          </div>
        ))}
        <Divider style={{ margin: '8px 0', borderColor: '#e8eefb' }} />
        <div className={styles.legendTitle}>关系类型</div>
        {Object.entries(EDGE_TYPE_CONFIG).slice(0, 4).map(([type, config]) => (
          <div key={type} className={styles.legendItem}>
            <div
              className={styles.legendLine}
              style={{
                background: config.color,
                borderTop: config.style === 'dashed' ? '2px dashed' : '2px solid'
              }}
            />
            <span>{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraphCanvas;
