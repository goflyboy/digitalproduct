// ============================================================
// 数字产品系统 - 模板建模页面
// 角色：IT 数据架构师
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Descriptions, Tag, Divider, Drawer, Form, Input, Select, message } from 'antd';
import {
  PlusOutlined,
  ExperimentOutlined,
  SaveOutlined,
  GatewayOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { useGraphStore, useFilteredGraph, useSelectedNode } from '../store/graphStore';
import { templateDefinitions } from '../data/mockData';
import type { GraphNode } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

export const TemplateModelingPage: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const { nodes, edges, selectedNodeId, selectNode, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();

  // 模板阶段的过滤节点（只显示产品类和部件分类模板）
  const templateNodes = nodes.filter(n => 
    n.structType === 'PRODUCT_CLASS' || n.structType === 'PART_CLASS'
  );
  const templateEdges = edges.filter(e => 
    templateNodes.some(n => n.id === e.sourceId) && 
    templateNodes.some(n => n.id === e.targetId)
  );

  const handleAddTemplate = () => {
    setDrawerVisible(true);
  };

  const handleSaveTemplate = () => {
    form.validateFields().then(values => {
      message.success('模板定义已保存');
      setDrawerVisible(false);
      form.resetFields();
    });
  };

  return (
    <div className={styles.modelingPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <ExperimentOutlined style={{ fontSize: 24, color: '#722ed1', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#e0e0e0' }}>
              模板建模
            </Title>
            <Text type="secondary">定义产品结构模板和属性模板</Text>
          </div>
        </div>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddTemplate}
          >
            新建模板
          </Button>
        </Space>
      </div>

      {/* 角色指示器 */}
      <Card className={styles.roleCard}>
        <div className={styles.roleContent}>
          <div className={styles.roleIcon}>
            <ExperimentOutlined />
          </div>
          <div className={styles.roleInfo}>
            <Text strong style={{ color: '#e0e0e0' }}>当前角色：IT 数据架构师</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              定义产品元数据模板，包括 Module Structure 模板和 Module Attribute 模板
            </Text>
          </div>
        </div>
      </Card>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode ? 16 : 24}>
          <Card className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.phaseTag}>
                <GatewayOutlined />
                <span>产品类模板</span>
              </div>
              <div className={styles.phaseTag} style={{ marginLeft: 8 }}>
                <AppstoreOutlined />
                <span>部件分类模板</span>
              </div>
            </div>
            <GraphCanvas
              nodes={templateNodes}
              edges={templateEdges}
              selectedNodeId={selectedNodeId}
              onNodeSelect={selectNode}
              onNodeDrag={updateNodePosition}
              height={480}
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

      {/* 模板列表 */}
      <Card title={<span style={{ color: '#e0e0e0' }}>已定义模板</span>} className={styles.templateListCard}>
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

      {/* 新建模板抽屉 */}
      <Drawer
        title="新建模板定义"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={480}
        styles={{ body: { background: '#1a1a2e' } }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'MODULE_STRUCT', structType: 'PART_CLASS' }}
        >
          <Form.Item
            name="type"
            label={<span style={{ color: '#8888aa' }}>模板类型</span>}
          >
            <Select>
              <Select.Option value="MODULE_STRUCT">
                <Space>
                  <GatewayOutlined />
                  Module Structure 模板
                </Space>
              </Select.Option>
              <Select.Option value="MODULE_ATTRIBUTE">
                <Space>
                  <AppstoreOutlined />
                  Module Attribute 模板
                </Space>
              </Select.Option>
              <Select.Option value="RELATION">
                <Space>
                  <ArrowRightOutlined />
                  关系模板
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label={<span style={{ color: '#8888aa' }}>模板名称</span>}
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="如：产品类模板、规格属性模板" />
          </Form.Item>

          <Form.Item
            name="code"
            label={<span style={{ color: '#8888aa' }}>模板编码</span>}
            rules={[{ required: true, message: '请输入模板编码' }]}
          >
            <Input placeholder="如：ProductClass_Template" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
          >
            {({ getFieldValue }) => (
              <Form.Item
                name="structType"
                label={<span style={{ color: '#8888aa' }}>结构类型</span>}
                hidden={getFieldValue('type') !== 'MODULE_STRUCT'}
              >
                <Select>
                  <Select.Option value="PRODUCT_CLASS">Product Class（产品类）</Select.Option>
                  <Select.Option value="PART_CLASS">Part Class（部件分类）</Select.Option>
                  <Select.Option value="PART">Part（部件）</Select.Option>
                  <Select.Option value="PRODUCT_INSTANCE">Product Instance（产品实例）</Select.Option>
                </Select>
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ color: '#8888aa' }}>描述</span>}
          >
            <Input.TextArea rows={3} placeholder="模板描述信息" />
          </Form.Item>

          <Divider />

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTemplate}>
              保存模板
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
