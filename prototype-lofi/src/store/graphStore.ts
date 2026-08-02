// ============================================================
// 数字产品系统 - 状态管理
// ============================================================

import { create } from 'zustand';
import type { GraphNode, GraphEdge, ModelingPhase, UserRole } from '../types';
import { graphNodes, graphEdges, currentUser } from '../data/mockData';

interface GraphStore {
  // 图数据
  nodes: GraphNode[];
  edges: GraphEdge[];

  // 选中状态
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // 当前阶段
  currentPhase: ModelingPhase;

  // 当前用户
  currentUser: typeof currentUser;

  // 操作
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setPhase: (phase: ModelingPhase) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
}

// 根据阶段过滤节点
const getFilteredNodes = (phase: ModelingPhase, nodes: GraphNode[]): GraphNode[] => {
  switch (phase) {
    case 'TEMPLATE':
      // 模板阶段：只显示模板元数据
      return nodes.filter(n => 
        n.structType === 'PRODUCT_CLASS' || 
        n.structType === 'PART_CLASS'
      );
    case 'MODEL':
      // 模型阶段：显示产品类和部件分类
      return nodes.filter(n => 
        n.structType === 'PRODUCT_CLASS' || 
        n.structType === 'PART_CLASS' ||
        n.structType === 'PART'
      );
    case 'INSTANCE':
      // 实例化阶段：显示完整图
      return nodes;
    default:
      return nodes;
  }
};

// 根据阶段过滤边
const getFilteredEdges = (phase: ModelingPhase, edges: GraphEdge[], nodes: GraphNode[]): GraphEdge[] => {
  const filteredNodeIds = new Set(getFilteredNodes(phase, nodes).map(n => n.id));
  
  return edges.filter(e => 
    filteredNodeIds.has(e.sourceId) && filteredNodeIds.has(e.targetId)
  );
};

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: graphNodes,
  edges: graphEdges,
  selectedNodeId: null,
  selectedEdgeId: null,
  currentPhase: 'INSTANCE',
  currentUser: currentUser,

  selectNode: (nodeId) => set({ 
    selectedNodeId: nodeId,
    selectedEdgeId: null 
  }),

  selectEdge: (edgeId) => set({ 
    selectedEdgeId: edgeId,
    selectedNodeId: null 
  }),

  setPhase: (phase) => set({ 
    currentPhase: phase,
    selectedNodeId: null,
    selectedEdgeId: null,
  }),

  updateNodePosition: (nodeId, x, y) => set((state) => ({
    nodes: state.nodes.map(n => 
      n.id === nodeId ? { ...n, x, y } : n
    ),
  })),
}));

// 选择器：获取当前阶段过滤后的数据
export const useFilteredGraph = () => {
  const { nodes, edges, currentPhase } = useGraphStore();
  const filteredNodes = getFilteredNodes(currentPhase, nodes);
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => 
    filteredNodeIds.has(e.sourceId) && filteredNodeIds.has(e.targetId)
  );
  return { nodes: filteredNodes, edges: filteredEdges };
};

// 选择器：获取选中的节点
export const useSelectedNode = () => {
  const { nodes, selectedNodeId } = useGraphStore();
  return nodes.find(n => n.id === selectedNodeId) || null;
};

// 选择器：获取选中的边
export const useSelectedEdge = () => {
  const { edges, selectedEdgeId } = useGraphStore();
  return edges.find(e => e.id === selectedEdgeId) || null;
};
