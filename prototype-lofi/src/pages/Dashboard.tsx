// ============================================================
// 数字产品系统 - 产品总览
// ============================================================

import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Badge, Progress, Space, Typography } from 'antd';
import {
  GatewayOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ShopOutlined,
  ArrowRightOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { graphNodes, graphStats } from '../data/mockData';
import type { GraphNode } from '../types';
import styles from './Dashboard.module.css';

const { Title, Text } = Typography;

const structTypeMap: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PRODUCT_CLASS: { icon: <GatewayOutlined />, label: 'Product Class', color: '#2b6de1' },
  PRODUCT_INSTANCE: { icon: <ShopOutlined />, label: 'Product Instance', color: '#27ae60' },
  PART_CLASS: { icon: <AppstoreOutlined />, label: 'Part Class', color: '#27ae60' },
  PART: { icon: <FileTextOutlined />, label: 'Part', color: '#9b59b6' },
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const recentNodes = [...graphNodes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);

  const nodeColumns: ColumnsType<GraphNode> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <span style={{ color: structTypeMap[record.structType]?.color }}>
            {structTypeMap[record.structType]?.icon}
          </span>
          <Text style={{ color: '#1a1f36' }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text type="secondary">{code}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'structType',
      key: 'structType',
      render: (type) => (
        <Tag color={structTypeMap[type]?.color}>
          {structTypeMap[type]?.label}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'PUBLISHED' || status === 'ACTIVE' ? 'success' : 'warning'}
          text={status === 'PUBLISHED' || status === 'ACTIVE' ? '已发布' : '草稿'}
        />
      ),
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#1a1f36' }}>
            产品总览
          </Title>
          <Text type="secondary">
            数字产品模型 — 路由器产品平台
          </Text>
        </div>
        <Space>
          <Tag color="blue">v1.0.0</Tag>
          <Tag>已发布</Tag>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#6b7594' }}>节点总数</span>}
              value={graphStats.totalNodes}
              prefix={<GatewayOutlined style={{ color: '#2b6de1' }} />}
              valueStyle={{ color: '#1a1f36' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#6b7594' }}>关系边总数</span>}
              value={graphStats.totalEdges}
              prefix={<ArrowRightOutlined style={{ color: '#27ae60' }} />}
              valueStyle={{ color: '#1a1f36' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#6b7594' }}>已发布节点</span>}
              value={graphStats.publishedNodes}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#27ae60' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#6b7594' }}>草稿节点</span>}
              value={graphStats.draftNodes}
              prefix={<Badge status="warning" />}
              valueStyle={{ color: '#f0b429' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 节点类型分布 + 关系分布 */}
      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ color: '#1a1f36' }}>节点类型分布</span>}
            className={styles.card}
          >
            <Row gutter={[16, 16]}>
              {[
                { type: 'PRODUCT_CLASS', count: graphStats.productClass, total: graphStats.totalNodes },
                { type: 'PRODUCT_INSTANCE', count: graphStats.productInstance, total: graphStats.totalNodes },
                { type: 'PART_CLASS', count: graphStats.partClass, total: graphStats.totalNodes },
                { type: 'PART', count: graphStats.part, total: graphStats.totalNodes },
              ].map((item) => (
                <Col xs={12} sm={6} key={item.type}>
                  <div className={styles.nodeTypeItem}>
                    <div
                      className={styles.nodeTypeIcon}
                      style={{ color: structTypeMap[item.type]?.color }}
                    >
                      {structTypeMap[item.type]?.icon}
                    </div>
                    <div className={styles.nodeTypeInfo}>
                      <div className={styles.nodeTypeCount}>{item.count}</div>
                      <div className={styles.nodeTypeLabel}>
                        {structTypeMap[item.type]?.label}
                      </div>
                    </div>
                    <Progress
                      percent={Math.round((item.count / item.total) * 100)}
                      showInfo={false}
                      strokeColor={structTypeMap[item.type]?.color}
                      trailColor="#eef1f8"
                      size="small"
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ color: '#1a1f36' }}>关系类型分布</span>}
            className={styles.card}
          >
            <div className={styles.edgeStats}>
              <div className={styles.edgeStatItem}>
                <div className={styles.edgeStatLabel}>
                  <Tag>包含关系</Tag>
                </div>
                <div className={styles.edgeStatValue}>{graphStats.containsEdges}</div>
              </div>
              <div className={styles.edgeStatItem}>
                <div className={styles.edgeStatLabel}>
                  <Tag color="success">实例化关系</Tag>
                </div>
                <div className={styles.edgeStatValue}>{graphStats.instantiatesEdges}</div>
              </div>
            </div>
            <div className={styles.edgeRatio}>
              <RiseOutlined style={{ color: '#27ae60', marginRight: 4 }} />
              <Text type="secondary">3 个产品实例已实例化</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 节点列表 */}
      <Card
        title={<span style={{ color: '#1a1f36' }}>节点列表</span>}
        extra={
          <a onClick={() => navigate('/explore')} style={{ color: '#2b6de1' }}>
            查看全部 →
          </a>
        }
        className={styles.card}
      >
        <Table
          dataSource={recentNodes}
          columns={nodeColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>

      {/* 快速入口：四大阶段 */}
      <Row gutter={[16, 16]} className={styles.quickActions}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={styles.quickActionCard}
            onClick={() => navigate('/template')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(43, 109, 225, 0.08)', color: '#2b6de1' }}>
              <GatewayOutlined />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>模板建模</div>
              <div className={styles.quickActionDesc}>
                定义 Part Class，建立结构关系
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={styles.quickActionCard}
            onClick={() => navigate('/model')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(39, 174, 96, 0.08)', color: '#27ae60' }}>
              <AppstoreOutlined />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>产品建模</div>
              <div className={styles.quickActionDesc}>
                关联规格属性，建立 HAS 关系
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={styles.quickActionCard}
            onClick={() => navigate('/instance')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(250, 140, 22, 0.08)', color: '#f08c16' }}>
              <ShopOutlined />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>产品实例化</div>
              <div className={styles.quickActionDesc}>
                创建 Product Instance 并发布
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={styles.quickActionCard}
            onClick={() => navigate('/explore')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(155, 89, 182, 0.08)', color: '#9b59b6' }}>
              <FileTextOutlined />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>数据探索</div>
              <div className={styles.quickActionDesc}>
                浏览和检索完整产品数据
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
