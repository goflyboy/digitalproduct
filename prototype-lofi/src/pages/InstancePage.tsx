// ============================================================
// 数字产品系统 - 实例化与发布页面
// 角色：产品数据工程师
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Tag, Steps, Table, Badge, message, Modal, Checkbox } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  RocketOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { EdgeDetailPanel } from '../components/graph/EdgeDetailPanel';
import { useGraphStore, useSelectedNode, useSelectedEdge } from '../store/graphStore';
import type { GraphNode, GraphEdge } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

export const InstancePage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const { nodes, edges, selectedNodeId, selectedEdgeId, selectNode, selectEdge, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();
  const selectedEdge = useSelectedEdge();

  // 实例化阶段：显示完整图
  const instanceNodes = nodes;
  const instanceEdges = edges;

  // 实例化边
  const instantiatesEdges = instanceEdges.filter(e => e.relationType === 'INSTANTIATES');

  // 产品实例列表
  const productInstances = nodes.filter(n => n.structType === 'PRODUCT_INSTANCE');

  const instanceColumns: ColumnsType<GraphNode> = [
    {
      title: '产品实例',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <ShopOutlined style={{ color: '#52c41a' }} />
          <Text style={{ color: '#e0e0e0' }}>{name}</Text>
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
      title: '定位',
      dataIndex: 'positioning',
      key: 'positioning',
      render: (positioning) => {
        const colorMap: Record<string, string> = {
          '低端企业级': 'default',
          '中端企业级': 'processing',
          '高端企业级': 'gold',
        };
        return <Tag color={colorMap[positioning] || 'default'}>{positioning}</Tag>;
      },
    },
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      render: (market) => <Text type="secondary">{market}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={status === 'PUBLISHED' ? 'success' : 'warning'} 
          text={status === 'PUBLISHED' ? '已发布' : '草稿'} 
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" type="link">编辑</Button>
          <Button size="small" type="link" danger>禁用</Button>
        </Space>
      ),
    },
  ];

  const handlePublish = () => {
    if (!confirmChecked) {
      message.warning('请确认所有信息无误');
      return;
    }
    message.success('产品实例发布成功！');
    setPublishModalVisible(false);
    setConfirmChecked(false);
  };

  const steps = [
    { title: '创建实例', description: '创建产品实例' },
    { title: '配置部件', description: '启用/禁用部件' },
    { title: '规格覆盖', description: '配置规格覆盖' },
    { title: '发布', description: '发布到生产环境' },
  ];

  return (
    <div className={styles.modelingPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <ShopOutlined style={{ fontSize: 24, color: '#52c41a', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#e0e0e0' }}>
              实例化与发布
            </Title>
            <Text type="secondary">创建销售产品并发布到生产环境</Text>
          </div>
        </div>
        <Space>
          <Button icon={<SwapOutlined />}>
            配置部件
          </Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => setPublishModalVisible(true)}>
            发布产品
          </Button>
        </Space>
      </div>

      {/* 角色指示器 */}
      <Card className={styles.roleCard} style={{ background: 'linear-gradient(135deg, #52c41a20 0%, #fa8c1610 100%)', border: '1px solid #52c41a40' }}>
        <div className={styles.roleContent}>
          <div className={styles.roleIcon} style={{ background: 'rgba(82, 196, 26, 0.2)', color: '#52c41a' }}>
            <ShopOutlined />
          </div>
          <div className={styles.roleInfo}>
            <Text strong style={{ color: '#e0e0e0' }}>当前角色：产品数据工程师</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              基于产品类创建 ProductInstance，配置 Part 候选集裁剪，设置规格覆盖
            </Text>
          </div>
        </div>
      </Card>

      {/* 步骤指示器 */}
      <Card className={styles.canvasCard}>
        <Steps 
          current={currentStep} 
          size="small"
          items={steps.map(step => ({
            title: step.title,
            description: step.description,
          }))}
          onChange={(idx) => setCurrentStep(idx)}
        />
      </Card>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode || selectedEdge ? 14 : 24}>
          <Card className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.phaseTag}>
                <ShopOutlined />
                <span>产品实例</span>
              </div>
              <div className={styles.phaseTag} style={{ marginLeft: 8, background: 'rgba(82, 196, 26, 0.1)', borderColor: 'rgba(82, 196, 26, 0.3)', color: '#52c41a' }}>
                <span>INSTANTIATES 边</span>
              </div>
            </div>
            <GraphCanvas
              nodes={instanceNodes}
              edges={instanceEdges}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onNodeSelect={selectNode}
              onEdgeSelect={selectEdge}
              onNodeDrag={updateNodePosition}
              height={380}
            />
          </Card>
        </Col>

        {/* 详情面板 */}
        {(selectedNode || selectedEdge) && (
          <Col xs={24} xl={10}>
            <Card className={styles.detailCard}>
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
          </Col>
        )}
      </Row>

      {/* 产品实例列表 */}
      <Card 
        title={<span style={{ color: '#e0e0e0' }}>产品实例列表</span>}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />}>
            新建实例
          </Button>
        }
        className={styles.templateListCard}
      >
        <Table
          dataSource={productInstances}
          columns={instanceColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>

      {/* 发布确认弹窗 */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#52c41a' }} />
            <span>发布产品实例</span>
          </Space>
        }
        open={publishModalVisible}
        onCancel={() => setPublishModalVisible(false)}
        onOk={handlePublish}
        okText="确认发布"
        cancelText="取消"
        width={560}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ color: '#e0e0e0', marginBottom: 12 }}>即将发布的产品实例</Title>
          {productInstances.filter(p => p.status === 'PUBLISHED').map(instance => (
            <div 
              key={instance.id}
              style={{
                padding: 12,
                background: 'rgba(82, 196, 26, 0.1)',
                border: '1px solid rgba(82, 196, 26, 0.3)',
                borderRadius: 6,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: '#e0e0e0' }}>{instance.name}</Text>
              <Text type="secondary">({instance.code})</Text>
            </div>
          ))}
        </div>

        <div 
          style={{
            padding: 16,
            background: 'rgba(250, 173, 20, 0.1)',
            border: '1px solid rgba(250, 173, 20, 0.3)',
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            发布后，产品实例将进入发布态图数据库，供下游 Agent（配置 Agent、网络设计 Agent）消费。
          </Text>
        </div>

        <Checkbox 
          checked={confirmChecked} 
          onChange={(e) => setConfirmChecked(e.target.checked)}
        >
          <Text style={{ color: '#e0e0e0' }}>
            我已确认所有产品实例信息无误
          </Text>
        </Checkbox>
      </Modal>
    </div>
  );
};

export default InstancePage;
