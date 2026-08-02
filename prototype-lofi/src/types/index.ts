// ============================================================
// 数字产品系统 - 类型定义
// ============================================================

// 节点结构类型
export type StructType = 
  | 'PRODUCT_CLASS'    // 产品类
  | 'PRODUCT_INSTANCE' // 产品实例
  | 'PART_CLASS'       // 部件分类
  | 'PART';            // 部件

// 属性维度类型
export type AttrType = 
  | 'SPEC'        // 规格维度
  | 'PARAM'       // 参数维度
  | 'MARKETING'   // 营销维度
  | 'DELIVERY'    // 交付维度
  | 'FINANCE'      // 财务维度
  | 'OPERATION';   // 运维维度

// 关系类型
export type RelationType = 
  | 'CONTAINS'      // 包含
  | 'EXTENDS'       // 扩展
  | 'REFERENCES'    // 引用
  | 'INSTANTIATES'; // 实例化

// 关系属性类型
export type StructRelationType =
  | 'HAS'          // 具备
  | 'EXTENDS'      // 扩展
  | 'OVERRIDES';   // 覆盖

// 数据状态
export type DataStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'ACTIVE';

// 维护模式
export type MaintenanceMode = 'MANUAL' | 'UPSTREAM';

// 选择策略
export type SelectionPolicy = 'REQUIRED' | 'OPTIONAL';

// 继承策略
export type InheritancePolicy = 'OWN' | 'INHERITED' | 'OVERRIDDEN';

// ============================================================
// 节点数据
// ============================================================
export interface GraphNode {
  id: string;
  code: string;
  name: string;
  structType: StructType;
  status: DataStatus;
  version?: string;
  description?: string;
  // 产品实例特有
  positioning?: string;  // 定位：低端/中端/高端
  market?: string;        // 市场
  // 扩展属性
  extensions?: {
    marketing?: {
      sellingPoints?: string[];
      brochureId?: string;
    };
    delivery?: {
      leadTimeDays?: number;
      packagingClass?: string;
    };
    finance?: {
      marginTarget?: number;
    };
  };
  // UI 渲染用
  x?: number;
  y?: number;
}

// ============================================================
// 边数据
// ============================================================
export interface GraphEdge {
  id: string;
  code: string;
  name: string;
  relationType: RelationType | StructRelationType;
  sourceId: string;
  targetId: string;
  minCardinality?: number;
  maxCardinality?: number;
  defaultSelected?: boolean;
  selectionPolicy?: SelectionPolicy;
  // 实例化特有
  enabledParts?: PartCandidate[];
  disabledParts?: PartCandidate[];
  specOverrides?: Record<string, { overrideValue: string; reason: string }>;
}

// ============================================================
// 部件候选
// ============================================================
export interface PartCandidate {
  partCode: string;
  partName: string;
  enabled?: boolean;
  defaultSelected?: boolean;
  minQty?: number;
  maxQty?: number;
  reason?: string;
  excludedReason?: string;
}

// ============================================================
// 属性数据
// ============================================================
export interface ModuleAttribute {
  id: string;
  code: string;
  name: string;
  attrType: AttrType;
  status: DataStatus;
  schema: {
    type: 'INTEGER' | 'DECIMAL' | 'STRING' | 'ENUM' | 'STRING_ARRAY';
    unit?: string;
    values?: string[];
    assignType?: 'INPUT' | 'SELECT';
  };
  ownerId?: string;
  ownerType?: 'PART' | 'PART_CLASS' | 'PRODUCT_CLASS';
  values?: {
    value: string | number;
  };
}

// ============================================================
// 模板数据
// ============================================================
export interface TemplateDefinition {
  id: string;
  code: string;
  name: string;
  type: 'MODULE_STRUCT' | 'MODULE_ATTRIBUTE' | 'RELATION';
  structType?: StructType;
  attrType?: AttrType;
  description?: string;
  version: string;
  status: DataStatus;
}

// ============================================================
// 用户角色
// ============================================================
export type UserRole = 
  | 'IT_ARCHITECT'      // IT 数据架构师
  | 'PRODUCT_ARCHITECT'  // 产品数据架构师
  | 'PRODUCT_ENGINEER';  // 产品数据工程师

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

// ============================================================
// 阶段定义
// ============================================================
export type ModelingPhase = 
  | 'TEMPLATE'   // 模板建模
  | 'MODEL'      // 产品模型
  | 'INSTANCE';  // 实例化发布

// ============================================================
// 图数据
// ============================================================
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  attributes?: ModuleAttribute[];
}

// ============================================================
// 节点类型配置（用于图渲染）
// ============================================================
export const NODE_TYPE_CONFIG: Record<StructType, {
  label: string;
  color: string;
  icon: string;
  shape: 'rect' | 'ellipse' | 'diamond';
}> = {
  PRODUCT_CLASS: {
    label: '产品类',
    color: '#1890ff',
    icon: 'Gateway',
    shape: 'ellipse',
  },
  PRODUCT_INSTANCE: {
    label: '产品实例',
    color: '#52c41a',
    icon: 'Shop',
    shape: 'rect',
  },
  PART_CLASS: {
    label: '部件分类',
    color: '#fa8c16',
    icon: 'Appstore',
    shape: 'rect',
  },
  PART: {
    label: '部件',
    color: '#722ed1',
    icon: 'File',
    shape: 'rect',
  },
};

// ============================================================
// 关系类型配置（用于图渲染）
// ============================================================
export const EDGE_TYPE_CONFIG: Record<RelationType | StructRelationType, {
  label: string;
  color: string;
  style: 'solid' | 'dashed';
}> = {
  CONTAINS: {
    label: '包含',
    color: '#8c8c8c',
    style: 'solid',
  },
  EXTENDS: {
    label: '扩展',
    color: '#faad14',
    style: 'dashed',
  },
  REFERENCES: {
    label: '引用',
    color: '#13c2c2',
    style: 'dashed',
  },
  INSTANTIATES: {
    label: '实例化',
    color: '#52c41a',
    style: 'solid',
  },
  HAS: {
    label: '具备',
    color: '#8c8c8c',
    style: 'solid',
  },
  OVERRIDES: {
    label: '覆盖',
    color: '#f5222d',
    style: 'dashed',
  },
};
