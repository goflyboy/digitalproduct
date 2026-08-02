// ============================================================
// 数字产品系统 - 节点详情面板
// ============================================================

import React from 'react';
import { Card, Tag, Descriptions, Badge, Divider, Table, Space, Button, Typography } from 'antd';
import {
  GatewayOutlined,
  ShopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { GraphNode } from '../../types';
import { NODE_TYPE_CONFIG } from '../../types';

const { Text } = Typography;

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose?: () => void;
  onEdit?: (node: GraphNode) => void;
  onDelete?: (node: GraphNode) => void;
  onViewRelations?: (node: GraphNode) => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  onClose,
  onEdit,
  onDelete,
  onViewRelations,
}) => {
  const config = NODE_TYPE_CONFIG[node.structType];

  // 状态映射
  const statusMap = {
    DRAFT: { color: 'warning', text: '草稿' },
    PUBLISHED: { color: 'success', text: '已发布' },
    ACTIVE: { color: 'success', text: '活跃' },
    DEPRECATED: { color: 'default', text: '已废弃' },
  };

  const status = statusMap[node.status] || statusMap.DRAFT;

  return (
    <div className="nodeDetail">
      {/* 头部 */}
      <div className="nodeDetailHeader">
        <div 
          className="nodeDetailIcon" 
          style={{ background: `${config.color}20`, color: config.color }}
        >
          {node.structType === 'PRODUCT_CLASS' && <GatewayOutlined />}
          {node.structType === 'PRODUCT_INSTANCE' && <ShopOutlined />}
          {node.structType === 'PART_CLASS' && <AppstoreOutlined />}
          {node.structType === 'PART' && <FileTextOutlined />}
        </div>
        <div className="nodeDetailTitle">
          <h3 className="nodeDetailName">{node.name}</h3>
          <span className="nodeDetailCode">{node.code}</span>
        </div>
        <Badge 
          status={status.color as 'success' | 'warning' | 'default'} 
          text={status.text} 
        />
      </div>

      {/* 内容 */}
      <div className="nodeDetailContent">
        {/* 基本信息 */}
        <div className="nodeDetailSection">
          <div className="nodeDetailSectionTitle">基本信息</div>
          <Descriptions 
            size="small" 
            column={1}
            colon={false}
            labelStyle={{ color: '#8888aa', minWidth: 80 }}
            contentStyle={{ color: '#e0e0e0' }}
          >
            <Descriptions.Item label="类型">{config.label}</Descriptions.Item>
            <Descriptions.Item label="版本">{node.version || 'v1.0.0'}</Descriptions.Item>
            {node.description && (
              <Descriptions.Item label="描述">{node.description}</Descriptions.Item>
            )}
          </Descriptions>
        </div>

        {/* 产品实例特有属性 */}
        {node.structType === 'PRODUCT_INSTANCE' && (
          <>
            <Divider style={{ margin: '12px 0', borderColor: '#3a3a5c' }} />
            <div className="nodeDetailSection">
              <div className="nodeDetailSectionTitle">实例属性</div>
              <Descriptions 
                size="small" 
                column={1}
                colon={false}
                labelStyle={{ color: '#8888aa', minWidth: 80 }}
                contentStyle={{ color: '#e0e0e0' }}
              >
                <Descriptions.Item label="市场定位">{node.positioning || '-'}</Descriptions.Item>
                <Descriptions.Item label="目标市场">{node.market || '-'}</Descriptions.Item>
              </Descriptions>
            </div>

            {/* 扩展属性 */}
            {node.extensions && (
              <>
                <Divider style={{ margin: '12px 0', borderColor: '#3a3a5c' }} />
                <div className="nodeDetailSection">
                  <div className="nodeDetailSectionTitle">多维属性</div>
                  
                  {node.extensions.marketing && (
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>营销维度</Text>
                      <div style={{ marginTop: 4 }}>
                        {node.extensions.marketing.sellingPoints?.map((sp, i) => (
                          <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{sp}</Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {node.extensions.delivery && (
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>交付维度</Text>
                      <Descriptions 
                        size="small" 
                        column={1}
                        colon={false}
                        labelStyle={{ color: '#8888aa', minWidth: 60 }}
                        contentStyle={{ color: '#e0e0e0', fontSize: 12 }}
                      >
                        <Descriptions.Item label="交付工期">
                          {node.extensions.delivery.leadTimeDays} 天
                        </Descriptions.Item>
                        <Descriptions.Item label="包装等级">
                          {node.extensions.delivery.packagingClass}
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  )}

                  {node.extensions.finance && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>财务维度</Text>
                      <Descriptions 
                        size="small" 
                        column={1}
                        colon={false}
                        labelStyle={{ color: '#8888aa', minWidth: 60 }}
                        contentStyle={{ color: '#e0e0e0', fontSize: 12 }}
                      >
                        <Descriptions.Item label="利润率目标">
                          {((node.extensions.finance.marginTarget || 0) * 100).toFixed(0)}%
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* 操作按钮 */}
        <Divider style={{ margin: '16px 0', borderColor: '#3a3a5c' }} />
        <Space wrap>
          <Button 
            size="small" 
            icon={<SwapOutlined />} 
            onClick={() => onViewRelations?.(node)}
          >
            查看关联
          </Button>
          <Button 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => onEdit?.(node)}
          >
            编辑
          </Button>
          <Button 
            size="small" 
            danger
            icon={<DeleteOutlined />} 
            onClick={() => onDelete?.(node)}
          >
            删除
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default NodeDetailPanel;
