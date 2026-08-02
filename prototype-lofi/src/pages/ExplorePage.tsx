// ============================================================
// 数字产品系统 - 图探索页面
// ============================================================

import React, { useState } from 'react';
import { Card, Input, Select, Space, Typography, Table, Tag, Row, Col, Button } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { EdgeDetailPanel } from '../components/graph/EdgeDetailPanel';
import { useGraphStore, useSelectedNode, useSelectedEdge } from '../store/graphStore';
import { graphNodes, graphEdges } from '../data/mockData';
import { NODE_TYPE_CONFIG } from '../types';
import type { GraphNode, GraphEdge, StructType } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

export const ExplorePage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<StructType | 'ALL'>('ALL');
  const { nodes, edges, selectedNodeId, selectedEdgeId, selectNode, selectEdge, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();
  const selectedEdge = useSelectedEdge();

  // 过滤节点
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = !searchText || 
      node.name.toLowerCase().includes(searchText.toLowerCase()) ||
      node.code.toLowerCase().includes(searchText.toLowerCase());
    const matchesType = filterType === 'ALL' || node.structType === filterType;
    return matchesSearch && matchesType;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => 
    filteredNodeIds.has(e.sourceId) && filteredNodeIds.has(e.targetId)
  );

  const nodeColumns: ColumnsType<GraphNode> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <span style={{ color: NODE_TYPE_CONFIG[record.structType]?.color }}>
            {record.name}
          </span>
        </Space>
      ),
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code style={{ fontSize: 11 }}>{code}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'structType',
      key: 'structType',
      render: (type) => (
        <Tag color={NODE_TYPE_CONFIG[type]?.color}>
          {NODE_TYPE_CONFIG[type]?.label}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => selectNode(record.id)}
        >
          定位
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.explorePage}>
      {/* 页面标题 */}
      <div className={styles.exploreHeader}>
        <div className={styles.headerLeft}>
          <Title level={3} style={{ margin: 0, color: '#e0e0e0' }}>
            图探索
          </Title>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            浏览和探索完整的产品图结构
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <div className={styles.exploreContent}>
        {/* 图画布 */}
        <Card className={styles.exploreCanvas}>
          <GraphCanvas
            nodes={filteredNodes}
            edges={filteredEdges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onNodeSelect={selectNode}
            onEdgeSelect={selectEdge}
            onNodeDrag={updateNodePosition}
            height="100%"
          />
        </Card>

        {/* 侧边栏 */}
        <div className={styles.exploreSidebar}>
          {/* 搜索和过滤 */}
          <Card className={styles.searchCard}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Input
                placeholder="搜索节点名称或编码..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: '100%' }}
                suffixIcon={<FilterOutlined />}
              >
                <Select.Option value="ALL">全部类型</Select.Option>
                <Select.Option value="PRODUCT_CLASS">
                  <Space>
                    <span style={{ color: NODE_TYPE_CONFIG.PRODUCT_CLASS.color }}>●</span>
                    产品类
                  </Space>
                </Select.Option>
                <Select.Option value="PRODUCT_INSTANCE">
                  <Space>
                    <span style={{ color: NODE_TYPE_CONFIG.PRODUCT_INSTANCE.color }}>●</span>
                    产品实例
                  </Space>
                </Select.Option>
                <Select.Option value="PART_CLASS">
                  <Space>
                    <span style={{ color: NODE_TYPE_CONFIG.PART_CLASS.color }}>●</span>
                    部件分类
                  </Space>
                </Select.Option>
                <Select.Option value="PART">
                  <Space>
                    <span style={{ color: NODE_TYPE_CONFIG.PART.color }}>●</span>
                    部件
                  </Space>
                </Select.Option>
              </Select>
              <div style={{ color: '#8888aa', fontSize: 12 }}>
                共找到 <strong style={{ color: '#e0e0e0' }}>{filteredNodes.length}</strong> 个节点
              </div>
            </Space>
          </Card>

          {/* 详情面板 */}
          {(selectedNode || selectedEdge) && (
            <Card className={styles.relationCard} title="节点详情">
              {selectedNode && (
                <NodeDetailPanel 
                  node={selectedNode}
                  onClose={() => selectNode(null)}
                />
              )}
              {selectedEdge && !selectedNode && (
                <EdgeDetailPanel 
                  edge={selectedEdge}
                  onClose={() => selectEdge(null)}
                />
              )}
            </Card>
          )}

          {/* 节点列表 */}
          <Card className={styles.relationCard} title="节点列表">
            <Table
              dataSource={filteredNodes.slice(0, 10)}
              columns={nodeColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
