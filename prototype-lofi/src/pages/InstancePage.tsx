// ============================================================
// 数字产品系统 - 产品实例化页面
// ============================================================

import React, { useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Tag, Steps, Table, Badge, Modal, Checkbox, Form, Input, Select, Divider, message } from 'antd';
import {
  PlusOutlined,
  RocketOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  SwapOutlined,
  SaveOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { useGraphStore, useSelectedNode } from '../store/graphStore';
import type { GraphNode } from '../types';
import styles from './ModelingPage.module.css';

const { Title, Text } = Typography;

export const InstancePage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [addInstanceModalVisible, setAddInstanceModalVisible] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [form] = Form.useForm();
  const { nodes, edges, selectedNodeId, selectNode, updateNodePosition } = useGraphStore();
  const selectedNode = useSelectedNode();

  // 实例化阶段：完整图
  const instanceNodes = nodes;
  const instanceEdges = edges;

  // Product Class 列表（可实例化的模型）
  const productClasses = nodes.filter(n => n.structType === 'PRODUCT_CLASS');

  // 已实例化的产品实例
  const productInstances = nodes.filter(n => n.structType === 'PRODUCT_INSTANCE');

  const instanceColumns: ColumnsType<GraphNode> = [
    {
      title: '产品实例',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <ShopOutlined style={{ color: '#27ae60' }} />
          <Text style={{ color: '#1a1f36' }}>{name}</Text>
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
          <Button size="small" type="link" onClick={() => { setCropModalVisible(true); selectNode(record.id); }}>
            配置裁剪
          </Button>
          <Button size="small" type="link" danger>禁用</Button>
        </Space>
      ),
    },
  ];

  // Part 裁剪列表（模拟数据）
  const partCandidates = [
    { code: 'cpu_core_01', name: '标准 CPU 核心', enabled: true, reason: '默认启用' },
    { code: 'cpu_core_02', name: '增强 CPU 核心', enabled: false, reason: '仅高端型号可选' },
    { code: 'mem_8g', name: '8GB 内存', enabled: true, reason: '默认启用' },
    { code: 'mem_16g', name: '16GB 内存', enabled: false, reason: '需单独授权' },
    { code: 'wifi_module', name: 'Wi-Fi 模块', enabled: true, reason: '默认启用' },
    { code: 'bt_module', name: '蓝牙模块', enabled: false, reason: '非标配' },
  ];

  const steps = [
    { title: '选择模型', description: '选择要实例化的产品类' },
    { title: '添加实例', description: '创建产品实例' },
    { title: '配置裁剪', description: '启用/禁用部件' },
    { title: '发布', description: '发布到生产环境' },
  ];

  const handlePublish = () => {
    if (!confirmChecked) {
      message.warning('请确认所有信息无误');
      return;
    }
    message.success('产品实例发布成功！');
    setPublishModalVisible(false);
    setConfirmChecked(false);
    setCurrentStep(3);
  };

  return (
    <div className={styles.modelingPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <ShopOutlined style={{ fontSize: 24, color: '#27ae60', marginRight: 12 }} />
          <div>
            <Title level={3} style={{ margin: 0, color: '#1a1f36' }}>
              产品实例化
            </Title>
            <Text type="secondary">基于产品模型创建 Product Instance，配置部件候选集并发布到生产环境</Text>
          </div>
        </div>
        <Space>
          <Button
            icon={<SwapOutlined />}
            onClick={() => { setCropModalVisible(true); }}
          >
            配置裁剪
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setAddInstanceModalVisible(true);
            }}
          >
            添加产品实例
          </Button>
        </Space>
      </div>

      {/* 步骤指示器 */}
      <Card className={styles.canvasCard}>
        <Steps
          current={currentStep}
          size="small"
          items={steps.map((step, idx) => ({
            title: step.title,
            description: step.description,
            onClick: () => setCurrentStep(idx),
          }))}
        />
      </Card>

      {/* 主内容区 */}
      <Row gutter={[16, 16]}>
        {/* 图画布 */}
        <Col xs={24} xl={selectedNode ? 16 : 24}>
          <Card className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.phaseTag}>
                <ShopOutlined />
                <span>Product Instance</span>
              </div>
              <div className={styles.phaseTag} style={{
                background: 'rgba(39, 174, 96, 0.08)',
                borderColor: 'rgba(39, 174, 96, 0.2)',
                color: '#27ae60',
              }}>
                <NodeIndexOutlined />
                <span>INSTANTIATES 关系</span>
              </div>
            </div>
            <GraphCanvas
              nodes={instanceNodes}
              edges={instanceEdges}
              selectedNodeId={selectedNodeId}
              onNodeSelect={selectNode}
              onNodeDrag={updateNodePosition}
              height={360}
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

      {/* 产品实例列表 */}
      <Card
        title={<span style={{ color: '#1a1f36' }}>产品实例列表</span>}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
            form.resetFields();
            setAddInstanceModalVisible(true);
          }}>
            添加产品实例
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

      {/* ========== Step 1+2: 添加产品实例弹窗 ========== */}
      <Modal
        title={
          <Space>
            <ShopOutlined style={{ color: '#27ae60' }} />
            <span>添加产品实例</span>
          </Space>
        }
        open={addInstanceModalVisible}
        onCancel={() => setAddInstanceModalVisible(false)}
        onOk={() => {
          form.validateFields().then(() => {
            setAddInstanceModalVisible(false);
            message.success('产品实例已创建');
            setCurrentStep(2);
          });
        }}
        okText="下一步：配置裁剪"
        cancelText="取消"
        width={560}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            选择要实例化的产品模型，系统将基于该模型创建 Product Instance
          </Text>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item
            name="modelId"
            label={<span style={{ color: '#6b7594' }}>选择产品模型</span>}
            rules={[{ required: true, message: '请选择产品模型' }]}
          >
            <Select placeholder="选择产品模型（Product Class）">
              {productClasses.map(pc => (
                <Select.Option key={pc.id} value={pc.id}>
                  <Space>
                    <ShopOutlined style={{ color: '#27ae60' }} />
                    {pc.name} ({pc.code})
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label={<span style={{ color: '#6b7594' }}>实例名称</span>}
            rules={[{ required: true, message: '请输入实例名称' }]}
          >
            <Input placeholder="如：路由器 AR1200-S50" />
          </Form.Item>

          <Form.Item
            name="code"
            label={<span style={{ color: '#6b7594' }}>实例编码</span>}
            rules={[{ required: true, message: '请输入实例编码' }]}
          >
            <Input placeholder="如：router_ar1200_s50" />
          </Form.Item>

          <Form.Item
            name="positioning"
            label={<span style={{ color: '#6b7594' }}>产品定位</span>}
          >
            <Select placeholder="选择产品定位">
              <Select.Option value="低端企业级">
                <Space>
                  <Tag color="default">低端</Tag>
                  低端企业级
                </Space>
              </Select.Option>
              <Select.Option value="中端企业级">
                <Space>
                  <Tag color="processing">中端</Tag>
                  中端企业级
                </Space>
              </Select.Option>
              <Select.Option value="高端企业级">
                <Space>
                  <Tag color="gold">高端</Tag>
                  高端企业级
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="market"
            label={<span style={{ color: '#6b7594' }}>目标市场</span>}
          >
            <Input placeholder="如：中国区、亚太区" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ========== Step 3: 配置裁剪弹窗 ========== */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#f08c16' }} />
            <span>配置部件裁剪</span>
          </Space>
        }
        open={cropModalVisible}
        onCancel={() => setCropModalVisible(false)}
        onOk={() => {
          setCropModalVisible(false);
          message.success('裁剪配置已保存');
          setCurrentStep(3);
        }}
        okText="下一步：发布"
        cancelText="取消"
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            在此配置该产品实例的部件候选集：启用/禁用可选部件，设置数量约束
          </Text>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f0f4fb', borderBottom: '1px solid #dde5f4' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7594', fontWeight: 500 }}>部件编码</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7594', fontWeight: 500 }}>部件名称</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7594', fontWeight: 500 }}>启用</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7594', fontWeight: 500 }}>说明</th>
            </tr>
          </thead>
          <tbody>
            {partCandidates.map((part, idx) => (
              <tr key={part.code} style={{ borderBottom: '1px solid #eef1f8' }}>
                <td style={{ padding: '10px 12px' }}>
                  <Text code style={{ fontSize: 11 }}>{part.code}</Text>
                </td>
                <td style={{ padding: '10px 12px', color: '#1a1f36' }}>{part.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <Checkbox defaultChecked={part.enabled} />
                </td>
                <td style={{ padding: '10px 12px', color: '#6b7594', fontSize: 12 }}>{part.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{
          padding: 12,
          background: 'rgba(43, 109, 225, 0.06)',
          border: '1px solid rgba(43, 109, 225, 0.15)',
          borderRadius: 6,
          fontSize: 12,
          color: '#6b7594',
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            裁剪配置将决定该产品实例在下游配置 Agent 中的可选部件范围。未启用的部件将不会出现在配置选项中。
          </Text>
        </div>
      </Modal>

      {/* ========== Step 4: 发布确认弹窗 ========== */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#27ae60' }} />
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
          <Title level={5} style={{ color: '#1a1f36', marginBottom: 12 }}>即将发布的产品实例</Title>
          {productInstances.filter(p => p.status === 'PUBLISHED').map(instance => (
            <div
              key={instance.id}
              style={{
                padding: 12,
                background: 'rgba(39, 174, 96, 0.06)',
                border: '1px solid rgba(39, 174, 96, 0.2)',
                borderRadius: 6,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircleOutlined style={{ color: '#27ae60' }} />
              <Text style={{ color: '#1a1f36' }}>{instance.name}</Text>
              <Text type="secondary">({instance.code})</Text>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 16,
            background: 'rgba(250, 173, 20, 0.06)',
            border: '1px solid rgba(250, 173, 20, 0.2)',
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
          <Text style={{ color: '#1a1f36' }}>
            我已确认所有产品实例信息无误
          </Text>
        </Checkbox>
      </Modal>

      {/* 全局发布按钮（步骤完成后可点击） */}
      {currentStep >= 2 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 100,
        }}>
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            onClick={() => setPublishModalVisible(true)}
            style={{ boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)' }}
          >
            发布产品
          </Button>
        </div>
      )}
    </div>
  );
};

export default InstancePage;
