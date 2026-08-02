// ============================================================
// 数字产品系统 - 模板建模页面
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Tag, Divider, Drawer, Form, Input, Select, message } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  GatewayOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  NodeIndexOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { useGraphStore, useSelectedNode } from '../store/graphStore';
import { templateDefinitions } from '../data/mockData';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

// Part Class 只能挂在 Product Class 下；Part 只能挂在 Part Class 下
const CHILD_TYPE_RULES: Record<string, string[]> = {
  PRODUCT_CLASS: ['PART_CLASS'],
  PART_CLASS: ['PART'],
  PART: [],
};

export const TemplateModelingPage: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'node' | 'edge'>('node');
  const [form] = Form.useForm();
  const { nodes, edges, selectedNodeId, selectNode, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();

  // 模板阶段：Product Class + Part Class + Part
  const templateNodes = nodes.filter(n =>
    n.structType === 'PRODUCT_CLASS' || n.structType === 'PART_CLASS' || n.structType === 'PART'
  );
  const templateEdges = edges.filter(e =>
    templateNodes.some(n => n.id === e.sourceId) &&
    templateNodes.some(n => n.id === e.targetId)
  );

  // 根据选中节点，决定允许添加的子类型
  const allowedChildTypes = selectedNode
    ? (CHILD_TYPE_RULES[selectedNode.structType] || [])
    : ['PRODUCT_CLASS', 'PART_CLASS', 'PART'];

  const handleAddNode = (type: 'node' | 'edge') => {
    setDrawerType(type);
    setDrawerVisible(true);
    if (type === 'node') form.setFieldsValue({ type: allowedChildTypes[0] || 'PART_CLASS' });
    if (type === 'edge') form.resetFields();
  };

  return (
    <div className={styles.modelingPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <AppstoreOutlined style={{ fontSize: 24, color: '#2b6de1', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#1a1f36' }}>
              模板建模
            </Title>
            <Text type="secondary">定义 Part Class，建立 Product Class 与 Part Class 之间的结构关系</Text>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAddNode('node')}
          >
            新建模板
          </Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode ? 16 : 24}>
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
                <NodeIndexOutlined />
                <span>Part</span>
              </div>

              {/* 上下文工具栏：选中节点时出现 */}
              {selectedNode && (
                <div className={styles.contextToolbar}>
                  <div className={styles.contextDivider} />
                  <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                    选中：{selectedNode.name}
                  </Text>
                  {allowedChildTypes.length > 0 && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddNode('node')}
                    >
                      添加子模板
                    </Button>
                  )}
                  <Button
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => handleAddNode('edge')}
                  >
                    添加关系
                  </Button>
                </div>
              )}
            </div>

            <GraphCanvas
              nodes={templateNodes}
              edges={templateEdges}
              selectedNodeId={selectedNodeId}
              onNodeSelect={selectNode}
              onNodeDrag={updateNodePosition}
              height={400}
            />
          </Card>
        </Col>

        {/* 详情面板 */}
        {selectedNode && (
          <Col xs={24} xl={8}>
            <Card className={styles.detailCard}>
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => selectNode(null)}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* 已定义模板列表 */}
      <Card title={<span style={{ color: '#1a1f36' }}>已定义模板</span>} className={styles.templateListCard}>
        <div className={styles.templateGrid}>
          {templateDefinitions.map(template => (
            <div key={template.id} className={styles.templateItem}>
              <div className={styles.templateIcon}>
                {template.type === 'MODULE_STRUCT' && <GatewayOutlined />}
                {template.type === 'MODULE_ATTRIBUTE' && <AppstoreOutlined />}
              </div>
              <div className={styles.templateInfo}>
                <div className={styles.templateName}>{template.name}</div>
                <div className={styles.templateCode}>{template.code}</div>
              </div>
              <Tag color={template.status === 'PUBLISHED' ? 'success' : 'default'}>
                {template.status === 'PUBLISHED' ? '已发布' : '草稿'}
              </Tag>
            </div>
          ))}
        </div>
      </Card>

      {/* 新建模板 / 添加关系抽屉 */}
      <Drawer
        title={drawerType === 'node' ? '新建模板' : '添加关系'}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={480}
        styles={{ body: { background: '#f8fafd' } }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'PART_CLASS' }}
        >
          {drawerType === 'node' ? (
            // ========== 新建模板 ==========
            <>
              <Form.Item
                name="type"
                label={<span style={{ color: '#6b7594' }}>模板类型</span>}
              >
                <Select>
                  {allowedChildTypes.includes('PRODUCT_CLASS') && (
                    <Select.Option value="PRODUCT_CLASS">
                      <Space>
                        <GatewayOutlined style={{ color: '#2b6de1' }} />
                        Product Class（产品类）
                      </Space>
                    </Select.Option>
                  )}
                  {allowedChildTypes.includes('PART_CLASS') && (
                    <Select.Option value="PART_CLASS">
                      <Space>
                        <AppstoreOutlined style={{ color: '#27ae60' }} />
                        Part Class（部件分类）
                      </Space>
                    </Select.Option>
                  )}
                  {allowedChildTypes.includes('PART') && (
                    <Select.Option value="PART">
                      <Space>
                        <NodeIndexOutlined style={{ color: '#9b59b6' }} />
                        Part（部件）
                      </Space>
                    </Select.Option>
                  )}
                </Select>
              </Form.Item>

              {selectedNode && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(43, 109, 225, 0.06)',
                  border: '1px solid rgba(43, 109, 225, 0.15)',
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 12,
                  color: '#6b7594',
                }}>
                  将作为 <strong style={{ color: '#1a1f36' }}>{selectedNode.name}</strong> 的子节点
                </div>
              )}

              <Form.Item
                name="name"
                label={<span style={{ color: '#6b7594' }}>模板名称</span>}
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="如：基础计算单元、存储模块、网络接口" />
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
                  <Select.Option value="REQUIRED">
                    <Space>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2b6de1' }} />
                      必选（Required）
                    </Space>
                  </Select.Option>
                  <Select.Option value="OPTIONAL">
                    <Space>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#a0aec0', border: '1px solid #c8d0e8' }} />
                      可选（Optional）
                    </Space>
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="cardinality"
                label={<span style={{ color: '#6b7594' }}>数量约束</span>}
              >
                <Input.Group compact>
                  <Input type="number" placeholder="最小数量" style={{ width: '50%' }} />
                  <Input type="number" placeholder="最大数量" style={{ width: '50%' }} />
                </Input.Group>
              </Form.Item>

              <Form.Item
                name="description"
                label={<span style={{ color: '#6b7594' }}>描述</span>}
              >
                <Input.TextArea rows={3} placeholder="描述该模板的用途和结构" />
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
                  {templateNodes
                    .filter(n => n.id !== selectedNodeId)
                    .map(n => (
                      <Select.Option key={n.id} value={n.id}>
                        <Space>
                          {n.structType === 'PRODUCT_CLASS' && <GatewayOutlined style={{ color: '#2b6de1' }} />}
                          {n.structType === 'PART_CLASS' && <AppstoreOutlined style={{ color: '#27ae60' }} />}
                          {n.structType === 'PART' && <NodeIndexOutlined style={{ color: '#9b59b6' }} />}
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
                  <Select.Option value="CONTAINS">
                    <Space>
                      <ArrowRightOutlined />
                      包含（Contains）
                    </Space>
                  </Select.Option>
                  <Select.Option value="EXTENDS">
                    <Space>
                      <ArrowRightOutlined />
                      扩展（Extends）
                    </Space>
                  </Select.Option>
                  <Select.Option value="REFERENCES">
                    <Space>
                      <ArrowRightOutlined />
                      引用（References）
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
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => {
                form.validateFields().then(() => {
                  message.success(drawerType === 'node' ? '模板已创建' : '关系已添加');
                  setDrawerVisible(false);
                  form.resetFields();
                });
              }}
            >
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

export default TemplateModelingPage;
