// ============================================================
// 数字产品系统 - 首页（图概览仪表板）
// ============================================================

import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Badge, Progress, Space, Typography } from 'antd';
import {
  GatewayOutlined,
  ShopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  ArrowRightOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { graphNodes, graphEdges, graphStats } from '../data/mockData';
import type { GraphNode } from '../types';
import styles from './Dashboard.module.css';

const { Title, Text } = Typography;

// 节点类型映射
const structTypeMap: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PRODUCT_CLASS: { icon: <GatewayOutlined />, label: '产品类', color: '#1890ff' },
  PRODUCT_INSTANCE: { icon: <ShopOutlined />, label: '产品实例', color: '#52c41a' },
  PART_CLASS: { icon: <AppstoreOutlined />, label: '部件分类', color: '#fa8c16' },
  PART: { icon: <FileTextOutlined />, label: '部件', color: '#722ed1' },
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // 最近更新的节点
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
          <Text style={{ color: '#e0e0e0' }}>{name}</Text>
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
          <Title level={3} style={{ margin: 0, color: '#e0e0e0' }}>
            图概览
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
              title={<span style={{ color: '#8888aa' }}>图节点总数</span>}
              value={graphStats.totalNodes}
              prefix={<NodeIndexOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#e0e0e0' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#8888aa' }}>关系边总数</span>}
              value={graphStats.totalEdges}
              prefix={<ArrowRightOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#e0e0e0' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#8888aa' }}>已发布节点</span>}
              value={graphStats.publishedNodes}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<span style={{ color: '#8888aa' }}>草稿节点</span>}
              value={graphStats.draftNodes}
              prefix={<Badge status="warning" />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 节点类型分布 */}
      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span style={{ color: '#e0e0e0' }}>节点类型分布</span>}
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
                      style={{ background: `${structTypeMap[item.type]?.color}20` }}
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
                      trailColor="#2a2a4c"
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
            title={<span style={{ color: '#e0e0e0' }}>关系类型分布</span>}
            className={styles.card}
          >
            <div className={styles.edgeStats}>
              <div className={styles.edgeStatItem}>
                <div className={styles.edgeStatLabel}>
                  <Tag color="default">包含关系</Tag>
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
              <RiseOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              <Text type="secondary">3 个产品实例已实例化</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近更新的节点 */}
      <Card 
        title={<span style={{ color: '#e0e0e0' }}>节点列表</span>}
        extra={
          <a onClick={() => navigate('/explore')} style={{ color: '#1890ff' }}>
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
          className={styles.table}
        />
      </Card>

      {/* 快速入口 */}
      <Row gutter={[16, 16]} className={styles.quickActions}>
        <Col xs={24} sm={8}>
          <Card 
            className={styles.quickActionCard}
            onClick={() => navigate('/template')}
            hoverable
          >
            <div className={styles.quickActionIcon}>
              <GatewayOutlined />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>模板建模</div>
              <div className={styles.quickActionDesc}>
                定义产品结构模板和属性模板
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            className={styles.quickActionCard}
            onClick={() => navigate('/model')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(250, 140, 22, 0.2)' }}>
              <AppstoreOutlined style={{ color: '#fa8c16' }} />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>产品模型</div>
              <div className={styles.quickActionDesc}>
                构建部件分类和属性关联
              </div>
            </div>
            <ArrowRightOutlined className={styles.quickActionArrow} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            className={styles.quickActionCard}
            onClick={() => navigate('/instance')}
            hoverable
          >
            <div className={styles.quickActionIcon} style={{ background: 'rgba(82, 196, 26, 0.2)' }}>
              <ShopOutlined style={{ color: '#52c41a' }} />
            </div>
            <div className={styles.quickActionContent}>
              <div className={styles.quickActionTitle}>实例化发布</div>
              <div className={styles.quickActionDesc}>
                创建销售产品并发布
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
