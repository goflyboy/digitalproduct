// ============================================================
// 数字产品系统 - 产品模型页面
// 角色：产品数据架构师
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Tag, Divider, Drawer, Form, Input, Select, Table, message } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  GatewayOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { EdgeDetailPanel } from '../components/graph/EdgeDetailPanel';
import { useGraphStore, useSelectedNode, useSelectedEdge } from '../store/graphStore';
import { moduleAttributes } from '../data/mockData';
import type { GraphNode, GraphEdge, ModuleAttribute } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

export const ProductModelPage: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const { nodes, edges, selectedNodeId, selectedEdgeId, selectNode, selectEdge, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();
  const selectedEdge = useSelectedEdge();

  // 产品模型阶段：显示产品类、部件分类、部件
  const modelNodes = nodes.filter(n => 
    n.structType === 'PRODUCT_CLASS' || 
    n.structType === 'PART_CLASS' ||
    n.structType === 'PART'
  );
  const modelEdges = edges.filter(e => 
    modelNodes.some(n => n.id === e.sourceId) && 
    modelNodes.some(n => n.id === e.targetId)
  );

  const attributeColumns: ColumnsType<ModuleAttribute> = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code style={{ fontSize: 11 }}>{code}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text style={{ color: '#e0e0e0' }}>{name}</Text>,
    },
    {
      title: '维度',
      dataIndex: 'attrType',
      key: 'attrType',
      render: (type) => {
        const colorMap: Record<string, string> = {
          SPEC: 'blue',
          PARAM: 'cyan',
          MARKETING: 'magenta',
          DELIVERY: 'orange',
          FINANCE: 'gold',
          OPERATION: 'purple',
        };
        return <Tag color={colorMap[type]}>{type}</Tag>;
      },
    },
    {
      title: '数据类型',
      key: 'schema',
      render: (_, record) => (
        <Text type="secondary">
          {record.schema.type}
          {record.schema.unit && ` (${record.schema.unit})`}
        </Text>
      ),
    },
  ];

  return (
    <div className={styles.modelingPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <GatewayOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#e0e0e0' }}>
              产品模型
            </Title>
            <Text type="secondary">构建部件分类和属性关联</Text>
          </div>
        </div>
        <Space>
          <Button icon={<LinkOutlined />}>
            关联属性
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
            添加部件分类
          </Button>
        </Space>
      </div>

      {/* 角色指示器 */}
      <Card className={styles.roleCard} style={{ background: 'linear-gradient(135deg, #1890ff20 0%, #52c41a10 100%)', border: '1px solid #1890ff40' }}>
        <div className={styles.roleContent}>
          <div className={styles.roleIcon} style={{ background: 'rgba(24, 144, 255, 0.2)', color: '#1890ff' }}>
            <GatewayOutlined />
          </div>
          <div className={styles.roleInfo}>
            <Text strong style={{ color: '#e0e0e0' }}>当前角色：产品数据架构师</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              定义部件分类和 ModuleAttribute 之间的 HAS 关系，构建产品结构
            </Text>
          </div>
        </div>
      </Card>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode || selectedEdge ? 14 : 24}>
          <Card className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.phaseTag}>
                <GatewayOutlined />
                <span>产品类</span>
              </div>
              <div className={styles.phaseTag} style={{ marginLeft: 8, background: 'rgba(250, 140, 22, 0.1)', borderColor: 'rgba(250, 140, 22, 0.3)', color: '#fa8c16' }}>
                <AppstoreOutlined />
                <span>部件分类</span>
              </div>
              <div className={styles.phaseTag} style={{ marginLeft: 8, background: 'rgba(114, 46, 209, 0.1)', borderColor: 'rgba(114, 46, 209, 0.3)', color: '#722ed1' }}>
                <FileTextOutlined />
                <span>部件</span>
              </div>
            </div>
            <GraphCanvas
              nodes={modelNodes}
              edges={modelEdges}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onNodeSelect={selectNode}
              onEdgeSelect={selectEdge}
              onNodeDrag={updateNodePosition}
              height={420}
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

      {/* 属性定义列表 */}
      <Card title={<span style={{ color: '#e0e0e0' }}>已定义的属性</span>} className={styles.templateListCard}>
        <Table
          dataSource={moduleAttributes}
          columns={attributeColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 6 }}
        />
      </Card>

      {/* 添加部件分类抽屉 */}
      <Drawer
        title="添加部件分类"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={480}
        styles={{ body: { background: '#1a1a2e' } }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={<span style={{ color: '#8888aa' }}>部件分类名称</span>}
            rules={[{ required: true, message: '请输入部件分类名称' }]}
          >
            <Input placeholder="如：路由器CPU、路由器端口" />
          </Form.Item>

          <Form.Item
            name="code"
            label={<span style={{ color: '#8888aa' }}>部件分类编码</span>}
            rules={[{ required: true, message: '请输入部件分类编码' }]}
          >
            <Input placeholder="如：router_cpu" />
          </Form.Item>

          <Form.Item
            name="parent"
            label={<span style={{ color: '#8888aa' }}>所属产品类</span>}
            rules={[{ required: true, message: '请选择所属产品类' }]}
          >
            <Select placeholder="选择产品类">
              <Select.Option value="ROUTER_PLATFORM">路由器产品平台 (ROUTER_PLATFORM)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="policy"
            label={<span style={{ color: '#8888aa' }}>选择策略</span>}
          >
            <Select>
              <Select.Option value="REQUIRED">必选（REQUIRED）</Select.Option>
              <Select.Option value="OPTIONAL">可选（OPTIONAL）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="cardinality"
            label={<span style={{ color: '#8888aa' }}>数量约束</span>}
          >
            <Input.Group compact>
              <Input type="number" placeholder="最小" style={{ width: '50%' }} />
              <Input type="number" placeholder="最大" style={{ width: '50%' }} />
            </Input.Group>
          </Form.Item>

          <Divider />

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => {
              form.validateFields().then(() => {
                message.success('部件分类已添加');
                setDrawerVisible(false);
                form.resetFields();
              });
            }}>
              保存
            </Button>
            <Button onClick={() => setDrawerVisible(false)}>
              取消
            </Button>
          </Space>
        </Form>
      </Drawer>
    </div>
  );
};

export default ProductModelPage;
