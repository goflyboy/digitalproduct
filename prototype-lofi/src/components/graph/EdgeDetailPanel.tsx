// ============================================================
// 数字产品系统 - 边详情面板
// ============================================================

import React from 'react';
import { Card, Tag, Descriptions, Badge, Divider, Table, Switch, Typography, Space } from 'antd';
import type { GraphEdge, PartCandidate } from '../../types';
import { EDGE_TYPE_CONFIG } from '../../types';

const { Text } = Typography;

interface EdgeDetailPanelProps {
  edge: GraphEdge;
  onClose?: () => void;
  onUpdate?: (edge: GraphEdge) => void;
}

export const EdgeDetailPanel: React.FC<EdgeDetailPanelProps> = ({
  edge,
  onClose,
  onUpdate,
}) => {
  const config = EDGE_TYPE_CONFIG[edge.relationType];

  const enabledParts = edge.enabledParts || [];
  const disabledParts = edge.disabledParts || [];

  const partColumns = [
    {
      title: '部件',
      dataIndex: 'partName',
      key: 'partName',
      render: (text: string, record: PartCandidate) => (
        <Space>
          <Text style={{ color: '#e0e0e0' }}>{text}</Text>
          {!record.enabled && (
            <Tag color="default">已禁用</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '默认选中',
      dataIndex: 'defaultSelected',
      key: 'defaultSelected',
      render: (val: boolean | undefined) => (
        val ? <Badge status="success" text="是" /> : <Badge status="default" text="否" />
      ),
    },
    {
      title: '数量范围',
      key: 'qty',
      render: (_: unknown, record: PartCandidate) => (
        <Text style={{ color: '#8888aa' }}>
          {record.minQty || 0} - {record.maxQty || '-'}
        </Text>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text: string | undefined, record: PartCandidate) => (
        <Text style={{ color: record.enabled ? '#52c41a' : '#f5222d', fontSize: 12 }}>
          {text || record.excludedReason || '-'}
        </Text>
      ),
    },
  ];

  return (
    <div className="edgeDetail">
      {/* 头部 */}
      <div className="edgeDetailHeader">
        <h3 className="edgeDetailTitle">{edge.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={config.color}>{config.label}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{edge.code}</Text>
        </div>
      </div>

      {/* 内容 */}
      <div className="edgeDetailContent">
        {/* 基本属性 */}
        <div className="nodeDetailSection">
          <div className="nodeDetailSectionTitle">关系属性</div>
          <Descriptions 
            size="small" 
            column={1}
            colon={false}
            labelStyle={{ color: '#8888aa', minWidth: 80 }}
            contentStyle={{ color: '#e0e0e0' }}
          >
            <Descriptions.Item label="最小数量">{edge.minCardinality ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="最大数量">{edge.maxCardinality ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="默认选中">
              {edge.defaultSelected ? '是' : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="选择策略">
              <Tag color={edge.selectionPolicy === 'REQUIRED' ? 'red' : 'default'}>
                {edge.selectionPolicy === 'REQUIRED' ? '必选' : '可选'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 启用部件（实例化特有） */}
        {enabledParts.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0', borderColor: '#3a3a5c' }} />
            <div className="nodeDetailSection">
              <div className="nodeDetailSectionTitle">
                启用的部件 ({enabledParts.length})
              </div>
              <Table
                size="small"
                dataSource={enabledParts}
                columns={partColumns}
                rowKey="partCode"
                pagination={false}
                style={{ background: 'transparent' }}
              />
            </div>
          </>
        )}

        {/* 禁用部件（实例化特有） */}
        {disabledParts.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0', borderColor: '#3a3a5c' }} />
            <div className="nodeDetailSection">
              <div className="nodeDetailSectionTitle">
                <Text type="danger">禁用的部件 ({disabledParts.length})</Text>
              </div>
              <Table
                size="small"
                dataSource={disabledParts}
                columns={partColumns}
                rowKey="partCode"
                pagination={false}
                style={{ background: 'transparent' }}
              />
            </div>
          </>
        )}

        {/* 规格覆盖（实例化特有） */}
        {edge.specOverrides && Object.keys(edge.specOverrides).length > 0 && (
          <>
            <Divider style={{ margin: '12px 0', borderColor: '#3a3a5c' }} />
            <div className="nodeDetailSection">
              <div className="nodeDetailSectionTitle">规格覆盖</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(edge.specOverrides).map(([key, override]) => (
                  <div 
                    key={key}
                    style={{ 
                      background: 'rgba(245, 34, 45, 0.1)',
                      border: '1px solid rgba(245, 34, 45, 0.3)',
                      borderRadius: 4,
                      padding: 8,
                    }}
                  >
                    <Text strong style={{ color: '#f5222d' }}>{key}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text style={{ color: '#e0e0e0' }}>
                        覆盖值: <Text code>{override.overrideValue}</Text>
                      </Text>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <Text style={{ color: '#8888aa', fontSize: 12 }}>
                        原因: {override.reason}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EdgeDetailPanel;
