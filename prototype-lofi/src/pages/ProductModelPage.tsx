// ============================================================
// 数字产品系统 - 产品建模页面
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Tag, Divider, Drawer, Form, Input, Select, Table, message, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  GatewayOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  LinkOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { EdgeDetailPanel } from '../components/graph/EdgeDetailPanel';
import { useGraphStore, useSelectedNode, useSelectedEdge } from '../store/graphStore';
import { moduleAttributes } from '../data/mockData';
import type { GraphNode, ModuleAttribute } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

// 级联约束：选中节点后，可添加的子类型
const CHILD_TYPE_RULES: Record<string, string[]> = {
  PRODUCT_CLASS: ['PART_CLASS', 'PART'],
  PART_CLASS: ['PART'],
  PART: [],
};

const TYPE_LABEL: Record<string, string> = {
  PRODUCT_CLASS: 'Product Class',
  PART_CLASS: 'Part Class',
  PART: 'Part',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  PRODUCT_CLASS: <GatewayOutlined style={{ color: '#2b6de1' }} />,
  PART_CLASS: <AppstoreOutlined style={{ color: '#27ae60' }} />,
  PART: <FileTextOutlined style={{ color: '#9b59b6' }} />,
};

export const ProductModelPage: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'node' | 'edge'>('node');
  const [form] = Form.useForm();
  const { nodes, edges, selectedNodeId, selectedEdgeId, selectNode, selectEdge, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();
  const selectedEdge = useSelectedEdge();

  // 产品模型阶段：Product Class + Part Class + Part
  const modelNodes = nodes.filter(n =>
    n.structType === 'PRODUCT_CLASS' ||
    n.structType === 'PART_CLASS' ||
    n.structType === 'PART'
  );
  const modelEdges = edges.filter(e =>
    modelNodes.some(n => n.id === e.sourceId) &&
    modelNodes.some(n => n.id === e.targetId)
  );

  // 根据选中节点决定可选的模板类型
  const allowedTypes = selectedNode
    ? (CHILD_TYPE_RULES[selectedNode.structType] || [])
    : ['PRODUCT_CLASS', 'PART_CLASS', 'PART'];

  // 下拉菜单项
  const addObjectMenuItems: MenuProps['items'] = [
    ...allowedTypes.map(type => ({
      key: type,
      label: (
        <Space>
          {TYPE_ICON[type]}
          添加 {TYPE_LABEL[type]}
        </Space>
      ),
      onClick: () => {
        setDrawerMode('node');
        form.setFieldsValue({ type });
        setDrawerVisible(true);
      },
    })),
    { type: 'divider' as const },
    {
      key: 'addEdge',
      label: (
        <Space>
          <LinkOutlined />
          添加关系
        </Space>
      ),
      onClick: () => {
        setDrawerMode('edge');
        form.resetFields();
        setDrawerVisible(true);
      },
    },
  ];

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
      render: (name) => <Text style={{ color: '#1a1f36' }}>{name}</Text>,
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
          <GatewayOutlined style={{ fontSize: 24, color: '#2b6de1', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#1a1f36' }}>
              产品建模
            </Title>
            <Text type="secondary">基于模板构建产品结构，关联规格属性，建立对象之间的 HAS 关系</Text>
          </div>
        </div>
        <Space>
          {/* 上下文工具栏：选中节点时出现 */}
          {selectedNode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                选中：{selectedNode.name}
              </Text>
              <Dropdown menu={{ items: addObjectMenuItems }} trigger={['click']}>
                <Button type="primary" icon={<PlusOutlined />}>
                  添加对象
                </Button>
              </Dropdown>
            </div>
          )}
          {!selectedNode && (
            <Dropdown menu={{ items: addObjectMenuItems }} trigger={['click']}>
              <Button type="primary" icon={<PlusOutlined />}>
                添加对象
              </Button>
            </Dropdown>
          )}
        </Space>
      </div>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode || selectedEdge ? 14 : 24}>
          <Card className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.phaseTag}>
                <GatewayOutlined />
                <span>Product Class</span>
              </div>
              <div className={styles.phaseTag} style={{
                background: 'rgba(39, 174, 96, 0.08)',
                borderColor: 'rgba(39, 174, 96, 0.2)',
                color: '#27ae60',
              }}>
                <AppstoreOutlined />
                <span>Part Class</span>
              </div>
              <div className={styles.phaseTag} style={{
                background: 'rgba(155, 89, 182, 0.08)',
                borderColor: 'rgba(155, 89, 182, 0.2)',
                color: '#9b59b6',
              }}>
                <FileTextOutlined />
                <span>Part</span>
              </div>

              {/* 选中节点后，提示约束信息 */}
              {selectedNode && allowedTypes.length > 0 && (
                <div className={styles.contextToolbar}>
                  <div className={styles.contextDivider} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    可添加：{allowedTypes.map(t => TYPE_LABEL[t]).join(' / ')}
                  </Text>
                </div>
              )}
              {selectedNode && allowedTypes.length === 0 && (
                <div className={styles.contextToolbar}>
                  <div className={styles.contextDivider} />
                  <Text type="secondary" style={{ fontSize: 12, color: '#6b7594' }}>
                    无可添加子类型
                  </Text>
                </div>
              )}
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
      <Card title={<span style={{ color: '#1a1f36' }}>已定义的属性</span>} className={styles.templateListCard}>
        <Table
          dataSource={moduleAttributes}
          columns={attributeColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 6 }}
        />
      </Card>

      {/* 添加对象抽屉 */}
      <Drawer
        title={drawerMode === 'node' ? '添加对象' : '添加关系'}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={480}
        styles={{ body: { background: '#f8fafd' } }}
      >
        <Form form={form} layout="vertical">
          {drawerMode === 'node' ? (
            // ========== 添加对象 ==========
            <>
              {/* 提示选中节点 */}
              {selectedNode && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(43, 109, 225, 0.06)',
                  border: '1px solid rgba(43, 109, 225, 0.15)',
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#6b7594',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  {TYPE_ICON[selectedNode.structType]}
                  上级：<strong style={{ color: '#1a1f36' }}>{selectedNode.name}</strong>
                  <Text type="secondary">（将建立 HAS 关系）</Text>
                </div>
              )}

              <Form.Item
                name="type"
                label={<span style={{ color: '#6b7594' }}>对象类型</span>}
              >
                <Select disabled>
                  {allowedTypes.map(type => (
                    <Select.Option key={type} value={type}>
                      <Space>
                        {TYPE_ICON[type]}
                        {TYPE_LABEL[type]}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="name"
                label={<span style={{ color: '#6b7594' }}>对象名称</span>}
                rules={[{ required: true, message: '请输入对象名称' }]}
              >
                <Input placeholder="如：基础计算单元、存储模块" />
              </Form.Item>

              <Form.Item
                name="code"
                label={<span style={{ color: '#6b7594' }}>编码</span>}
                rules={[{ required: true, message: '请输入编码' }]}
              >
                <Input placeholder="如：base_compute_module" />
              </Form.Item>

              <Form.Item
                name="policy"
                label={<span style={{ color: '#6b7594' }}>选择策略</span>}
              >
                <Select placeholder="选择策略">
                  <Select.Option value="REQUIRED">必选（Required）</Select.Option>
                  <Select.Option value="OPTIONAL">可选（Optional）</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="cardinality"
                label={<span style={{ color: '#6b7594' }}>数量约束</span>}
              >
                <Input.Group compact>
                  <Input type="number" placeholder="最小" style={{ width: '50%' }} />
                  <Input type="number" placeholder="最大" style={{ width: '50%' }} />
                </Input.Group>
              </Form.Item>

              <Form.Item
                name="description"
                label={<span style={{ color: '#6b7594' }}>描述</span>}
              >
                <Input.TextArea rows={3} placeholder="描述该对象的用途和结构" />
              </Form.Item>
            </>
          ) : (
            // ========== 添加关系 ==========
            <>
              {selectedNode && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(43, 109, 225, 0.06)',
                  border: '1px solid rgba(43, 109, 225, 0.15)',
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#6b7594',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <GatewayOutlined style={{ color: '#2b6de1' }} />
                  源节点：<strong style={{ color: '#1a1f36' }}>{selectedNode.name}</strong>
                </div>
              )}

              <Form.Item
                name="targetId"
                label={<span style={{ color: '#6b7594' }}>目标节点</span>}
                rules={[{ required: true, message: '请选择目标节点' }]}
              >
                <Select placeholder="选择目标节点">
                  {modelNodes
                    .filter(n => n.id !== selectedNodeId)
                    .map(n => (
                      <Select.Option key={n.id} value={n.id}>
                        <Space>
                          {TYPE_ICON[n.structType]}
                          {n.name} ({n.code})
                        </Space>
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="relationType"
                label={<span style={{ color: '#6b7594' }}>关系类型</span>}
              >
                <Select>
                  <Select.Option value="HAS">
                    <Space>
                      <LinkOutlined />
                      具备（HAS）
                    </Space>
                  </Select.Option>
                  <Select.Option value="EXTENDS">
                    <Space>
                      <NodeIndexOutlined />
                      扩展（Extends）
                    </Space>
                  </Select.Option>
                  <Select.Option value="OVERRIDES">
                    <Space>
                      <NodeIndexOutlined />
                      覆盖（Overrides）
                    </Space>
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="cardinality"
                label={<span style={{ color: '#6b7594' }}>数量约束</span>}
              >
                <Input.Group compact>
                  <Input type="number" placeholder="最小" style={{ width: '50%' }} />
                  <Input type="number" placeholder="最大" style={{ width: '50%' }} />
                </Input.Group>
              </Form.Item>

              <Form.Item
                name="description"
                label={<span style={{ color: '#6b7594' }}>描述</span>}
              >
                <Input.TextArea rows={3} placeholder="描述该关系的用途" />
              </Form.Item>
            </>
          )}

          <Divider />

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => {
              form.validateFields().then(() => {
                message.success(drawerMode === 'node' ? '对象已添加' : '关系已添加');
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
