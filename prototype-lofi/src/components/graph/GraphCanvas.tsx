// ============================================================
// 数字产品系统 - 图可视化组件
// 支持节点拖拽、边连接、节点选中
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Badge, Tag, Tooltip, Popover, Descriptions, Space, Button, Divider } from 'antd';
import {
  GatewayOutlined,
  ShopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  SwapOutlined,
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

  // 计算边的路径
  const getEdgePath = (source: GraphNode, target: GraphNode): string => {
    const sx = source.x! + NODE_WIDTH / 2;
    const sy = source.y! + NODE_HEIGHT / 2;
    const tx = target.x! + NODE_WIDTH / 2;
    const ty = target.y! + NODE_HEIGHT / 2;

    // 计算中点和控制点
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // 曲率
    const curvature = len > 200 ? 30 : 15;
    const cpx = mx + (dy / len) * curvature;
    const cpy = my - (dx / len) * curvature;

    return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
  };

  // 计算边的终点（带箭头偏移）
  const getEdgeEndPoint = (source: GraphNode, target: GraphNode): { x: number; y: number } => {
    const tx = target.x! + NODE_WIDTH / 2;
    const ty = target.y! + NODE_HEIGHT / 2;
    return { x: tx, y: ty };
  };

  // 获取边的中点（用于显示标签）
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

  // 节点拖拽开始
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

  // 节点拖拽中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left - dragOffset.x;
    const y = e.clientY - svgRect.top - dragOffset.y;

    onNodeDrag?.(dragging, x, y);
  }, [dragging, dragOffset, onNodeDrag]);

  // 节点拖拽结束
  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // 点击空白区域
  const handleCanvasClick = useCallback(() => {
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
  }, [onNodeSelect, onEdgeSelect]);

  // 点击边
  const handleEdgeClick = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    onEdgeSelect?.(edgeId);
  }, [onEdgeSelect]);

  // 渲染节点
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
        {/* 节点背景 */}
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={6}
          fill={isSelected ? config.color : '#1a1a2e'}
          fillOpacity={isSelected ? 0.3 : 1}
          stroke={isSelected ? config.color : '#3a3a5c'}
          strokeWidth={isSelected ? 2 : 1}
          className={isDragging ? styles.nodeDragging : ''}
        />

        {/* 节点图标 */}
        <foreignObject x={8} y={10} width={40} height={40}>
          <div className={styles.nodeIcon} style={{ color: config.color }}>
            {STRUCT_ICONS[node.structType]}
          </div>
        </foreignObject>

        {/* 节点信息 */}
        {showLabels && (
          <>
            <text
              x={56}
              y={26}
              fill="#e0e0e0"
              fontSize={13}
              fontWeight={500}
              className={styles.nodeName}
            >
              {node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name}
            </text>
            <text
              x={56}
              y={44}
              fill="#8888aa"
              fontSize={11}
            >
              {node.code.length > 14 ? node.code.slice(0, 14) + '...' : node.code}
            </text>
          </>
        )}

        {/* 状态标识 */}
        <circle
          cx={NODE_WIDTH - 16}
          cy={16}
          r={6}
          fill={
            node.status === 'PUBLISHED' || node.status === 'ACTIVE' 
              ? '#52c41a' 
              : node.status === 'DRAFT' 
                ? '#faad14' 
                : '#8c8c8c'
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

  // 渲染边
  const renderEdge = (edge: GraphEdge) => {
    const source = nodes.find(n => n.id === edge.sourceId);
    const target = nodes.find(n => n.id === edge.targetId);
    if (!source || !target) return null;

    const config = EDGE_TYPE_CONFIG[edge.relationType];
    const isSelected = selectedEdgeId === edge.id;
    const mid = getEdgeMidPoint(source, target);
    const end = getEdgeEndPoint(source, target);

    return (
      <g key={edge.id} onClick={(e) => handleEdgeClick(e, edge.id)}>
        {/* 边路径 */}
        <path
          d={getEdgePath(source, target)}
          fill="none"
          stroke={isSelected ? '#1890ff' : config.color}
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeDasharray={config.style === 'dashed' ? '6,3' : 'none'}
          opacity={0.7}
          style={{ cursor: 'pointer' }}
          markerEnd={`url(#arrow-${config.color.replace('#', '')})`}
        />

        {/* 边标签 */}
        {showLabels && (
          <g transform={`translate(${mid.x - 30}, ${mid.y - 20})`}>
            <rect
              width={60}
              height={20}
              rx={4}
              fill="#1a1a2e"
              fillOpacity={0.9}
              stroke={isSelected ? '#1890ff' : '#3a3a5c'}
              strokeWidth={1}
            />
            <text
              x={30}
              y={14}
              fill="#aaaacc"
              fontSize={10}
              textAnchor="middle"
            >
              {config.label}
            </text>
          </g>
        )}

        {/* 实例化边显示enabled/disabled */}
        {edge.relationType === 'INSTANTIATES' && showLabels && (
          <g transform={`translate(${mid.x - 20}, ${mid.y + 5})`}>
            <rect
              width={40}
              height={16}
              rx={3}
              fill="#52c41a"
              fillOpacity={0.8}
            />
            <text
              x={20}
              y={12}
              fill="#fff"
              fontSize={9}
              textAnchor="middle"
            >
              实例化
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
        {/* 定义箭头 */}
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

        {/* 渲染边 */}
        {showEdges && edges.map(renderEdge)}

        {/* 渲染节点 */}
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
        <Divider style={{ margin: '8px 0', borderColor: '#3a3a5c' }} />
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
