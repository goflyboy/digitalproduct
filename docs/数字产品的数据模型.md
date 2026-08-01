# 数字产品的数据模型

> **文档版本**: v1.1
> **创建时间**: 2026-07-29
> **更新说明**: v1.1 —— 将 MultiSpec/MultiPara 替换为 BusinessObject + ModuleObjectRelation，实现更灵活的多维业务对象扩展机制

---

## 目录

1. [设计背景与核心扩展点](#一设计背景与核心扩展点)
2. [总体数据模型](#二总体数据模型核心实体及关系)
3. [消费场景详解](#三消费场景详解)
4. [详细数据案例](#四详细数据案例)
5. [业务处理流程](#五业务处理流程)
6. [与复杂产品配置模型的关系](#六与复杂产品配置模型的关系)
7. [关键指标汇总](#七关键指标汇总)

---

## 一、设计背景与核心扩展点

### 1.1 复杂产品配置模型的局限性

复杂产品配置模型（见前置文档）假设产品结构是 **ProductClass → PartClass → Part** 的三层树状结构，适用于服务器、工业设备等相对规整的产品。

但在更广泛的数字化产品场景中，这种模型面临挑战：

| 场景 | 结构特征 | 配置模型的局限 |
| --- | --- | --- |
| 网络设计 | 多层网络设备嵌套，防火墙策略跨设备引用 | 树状结构无法表达横向引用 |
| 工程交付 | 项目包含多个子项目，子项目包含多个任务，任务包含资源 | 层级深度不可预期 |
| 复杂配置器 | 模块嵌套模块，配置约束跨越多层 | PartClass 无法递归 |
| 数字孪生 | 物理实体 + 数字映射 + 运行数据 | 静态模型无法承载动态数据 |

### 1.2 数字产品的两个核心维度

数字产品是复杂产品配置的泛化，设计时需要同时考虑两个核心维度：

#### 1.2.1 多维性（Dimension）

数字产品的每一层信息都是**多维的**。某一层级的节点不仅包括常规的规格和参数，还涵盖了各种业务维度：

- **规格维度（Spec）**：物理特性或性能指标（继承自复杂产品配置）
- **参数维度（Para）**：用户可配置的输入需求（继承自复杂产品配置）
- **营销维度（Marketing）**：产品资料、销售策略、定价策略
- **交付维度（Delivery）**：交付规格、物流信息、服务条款
- **财务维度（Finance）**：成本结构、利润模型、税务处理
- **运维维度（Operation）**：部署要求、监控指标、运维手册

> **扩展机制**：未来如需支持新的业务维度（如"合规"、"法务"），只需定义新的业务对象类型即可，无需修改核心模型。

#### 1.2.2 多层性（Layering）

从数字产品的角度重新建模：

```
数字产品抽象
├── Module（模块）—— 递归结构，可包含子模块/Part/业务对象
│   ├── ProductClass 视为一种特殊的 Module（顶层产品模块）
│   └── PartClass 视为一种特殊的 Module（叶子部件模块）
├── Part（部件）—— 原子级别的不可分实体
├── BusinessObject（业务对象）—— 多维业务数据的统一抽象
└── ModuleObjectRelation（模块-对象关系）—— 建立业务对象与模块的关系
```

**核心思想**：用统一的 Module 概念替代 ProductClass 和 PartClass 的二元区分。Module 可以：
- 包含子模块（递归嵌套）
- 包含 Part（原子部件）
- 通过关系边关联业务对象
- 业务对象可以是规格、参数、营销资料、交付资料等任意类型

### 1.3 与复杂产品配置模型的关系

```
复杂产品配置模型                    数字产品模型
─────────────────                ─────────────────
ProductClass                     Module (type=PRODUCT)
PartClass                        Module (type=COMPONENT)
Part                             Part
Specification                    BusinessObject (type=SPEC)
Parameter                        BusinessObject (type=PARAM)
SpecValue                        BusinessObjectInstance
（无对应）                        BusinessObject (type=MARKETING/DELIVERY/...)
（无对应）                        ModuleObjectRelation (HAS)
```

---

## 二、总体数据模型（核心实体及关系）

### 2.1 核心实体

#### 2.1.1 Module（模块）

模块是数字产品的核心抽象，替代了原来的 ProductClass 和 PartClass 的二元区分：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| code | String | 业务编码 |
| name | String | 名称 |
| version | String | 版本号（如 1.0.0） |
| status | Enum | DRAFT / PUBLISHED / DEPRECATED |
| module_type | Enum | **PRODUCT**（顶层产品）/ **COMPONENT**（组件）/ **PART**（虚拟部件） |
| parent_module_id | UUID | 父模块引用（null 表示根节点） |
| depth | Integer | 层级深度（根为 0） |
| effective_from | DateTime | 生效时间 |
| effective_to | DateTime | 失效时间 |

> **关键设计**：module_type 区分了 ProductModule 和 ComponentModule，但二者都是 Module，共享相同的结构和行为。

#### 2.1.2 Part（部件）

部件是原子级别的不可分实体，与复杂产品配置模型中的 Part 一致：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| code | String | 业务编码 |
| name | String | 名称 |
| status | Enum | ACTIVE / INACTIVE |
| price | Decimal | 参考价格 |
| module_id | UUID | 所属模块引用 |

#### 2.1.3 BusinessObject（业务对象）

业务对象是多维业务数据的统一抽象，替代了原来的 MultiSpec 和 MultiPara：

> **设计理念**：将"规格"、"参数"、"营销资料"、"交付资料"等不同业务维度统一建模为 BusinessObject。新增业务维度时，只需定义新的 BusinessObjectType，无需修改核心模型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| code | String | 业务编码 |
| name | String | 名称（业务对象名称） |
| object_type | Enum | **SPEC**（规格）/ **PARAM**（参数）/ **MARKETING**（营销资料）/ **DELIVERY**（交付资料）/ **FINANCE**（财务资料）/ **OPERATION**（运维资料） |
| description | String | 描述 |
| schema | JSON | 数据结构定义（字段列表、类型、约束） |
| status | Enum | ACTIVE / INACTIVE |
| owner_module_id | UUID | 主属模块（定义该业务对象的模块） |

#### 2.1.4 BusinessObjectInstance（业务对象实例）

业务对象的具体取值，关联到 Module 或 Part：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| business_object_id | UUID | 关联的业务对象定义 |
| owner_type | Enum | **Module** / **Part** |
| owner_id | UUID | 所属实体 ID |
| values | JSON | 实际取值（键值对） |
| effective_from | DateTime | 生效时间 |
| effective_to | DateTime | 失效时间 |

#### 2.1.5 ModuleObjectRelation（模块-对象关系）

建立业务对象与 Module 之间的关系，是多维扩展的核心机制：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| module_id | UUID | 模块 ID |
| business_object_id | UUID | 关联的业务对象 ID |
| relation_type | Enum | **HAS**（具备）/ **EXTENDS**（扩展）/ **OVERRIDES**（覆盖） |
| dimension | Enum | **SPEC** / **PARAM** / **MARKETING** / **DELIVERY** / **FINANCE** / **OPERATION** |
| cardinality_min | Integer | 最小数量（默认 0） |
| cardinality_max | Integer | 最大数量（默认 1，0 表示无限制） |
| inheritance_policy | Enum | **OWN**（自有）/ **INHERITED**（继承）/ **OVERRIDDEN**（覆盖） |
| override_module_id | UUID | 覆盖的上级模块（用于覆盖继承关系） |

> **关系类型说明**：
> - **HAS**：模块具备某个业务对象，如"产品具备营销资料"
> - **EXTENDS**：模块扩展了某个继承来的业务对象
> - **OVERRIDES**：模块覆盖了从父模块继承的业务对象实例

> **维度字段**：relation_type 配合 dimension 字段，可以区分"具备营销资料"和"具备交付资料"等不同语义。

#### 2.1.6 ModuleLink（模块关系边）

模块之间的嵌套关系通过 ModuleLink 表达：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| parent_module_id | UUID | 父模块 ID |
| child_module_id | UUID | 子模块 ID |
| link_type | Enum | **CONTAINS**（包含）/ **EXTENDS**（扩展）/ **REFERENCES**（引用） |
| min_cardinality | Integer | 最小数量 |
| max_cardinality | Integer | 最大数量 |
| default_selected | Boolean | 是否默认选中 |
| selection_policy | Enum | **REQUIRED** / **OPTIONAL** |

> **REFERENCES 边的作用**：当 link_type=REFERENCES 时，表示跨模块引用。这是图的多跳查询的基础。

#### 2.1.7 ModuleInstance（模块实例）

产品实例化后的可售实体：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID | 全局唯一标识 |
| code | String | 实例编码 |
| name | String | 实例名称 |
| version | String | 版本号 |
| module_id | UUID | 引用的 Module |
| status | Enum | DRAFT / PUBLISHED / DEPRECATED |
| enabled_parts | JSON | 启用的 Part 列表 |
| disabled_parts | JSON | 禁用的 Part 列表 |
| enabled_modules | JSON | 启用的子模块列表 |
| disabled_modules | JSON | 禁用的子模块列表 |
| spec_overrides | JSON | 规格覆盖（兼容旧接口） |
| business_object_overrides | JSON | 业务对象实例覆盖 |

### 2.2 实体关系ER图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               数字产品模型 - 核心实体关系                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  【Module 核心】                                                                             │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐         │
│  │                         Module (type=PRODUCT)                                  │         │
│  │                         顶层产品模块                                           │         │
│  │                         NETWORK_CENTER:1.0.0                                 │         │
│  │                                                                               │         │
│  │  BusinessObjectInstance (多维取值)                                             │         │
│  │  ├── SPEC: FormFactor=2U, Bandwidth=10Gbps                                  │         │
│  │  ├── MARKETING: brochureId=ASSET-NC, sellingPoints=["高可靠","易运维"]      │         │
│  │  ├── DELIVERY: leadTimeDays=30, installationRequired=true                   │         │
│  │  └── FINANCE: costModel=COMPLEX, marginTarget=0.3                          │         │
│  │                                                                               │         │
│  └─────────────────────────────────┬─────────────────────────────────────────────┘         │
│                                    │ ModuleLink (CONTAINS)                                  │
│                                    ▼                                                        │
│  ┌───────────────────────────────────────────────────────────────────────────────┐         │
│  │                         Module (type=COMPONENT)                                │         │
│  │                         组件模块（可递归）                                      │         │
│  │                         ROUTER_MODULE                                         │         │
│  │                                                                               │         │
│  │  BusinessObjectInstance: PortCount=24, SwitchCapacity=48Gbps                    │         │
│  │                                                                               │         │
│  │  ┌─────────────────────────────────────────────────────────────────────┐     │         │
│  │  │                   ModuleLink (CONTAINS)                            │     │         │
│  │  │                   包含子模块或 Part                                │     │         │
│  │  └─────────────────────────────────────────────────────────────────────┘     │         │
│  │                                    │                                          │         │
│  │  ┌─────────────────────────────────┼───────────────────────────────────────┐   │         │
│  │  │                                 ▼                                       │   │         │
│  │  │  【子模块】                      【Part】                                 │   │         │
│  │  │  Module (type=COMPONENT)        Part (atomic)                           │   │         │
│  │  │  FIREWALL_SUBMODULE              router-port-1G                         │   │         │
│  │  │  SWITCH_SUBMODULE                router-port-10G                        │   │         │
│  │  │                                 firewall-license                         │   │         │
│  │  │                                                                             │   │         │
│  │  │  BusinessObjectInstance:         BusinessObjectInstance:                   │   │         │
│  │  │  RuleCapacity=10000              Speed=1Gbps, PortType=SFP+              │   │         │
│  │  │                                                                             │   │         │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐     │   │         │
│  │  │  │         ModuleLink (REFERENCES) ← ← ← ← ← ← ← ← ← ← ← ← ←     │     │   │         │
│  │  │  │         跨模块引用（图的边）                                      │     │   │         │
│  │  │  └─────────────────────────────────────────────────────────────────┘     │   │         │
│  │  │                                  │                                       │   │         │
│  │  └──────────────────────────────────┼───────────────────────────────────────┘   │         │
│  │                                     ▼                                            │         │
│  │                         Module (type=COMPONENT)                                │         │
│  │                         SECURITY_MODULE                                         │         │
│  │                         安全模块（被多个父模块引用）                               │         │
│  └───────────────────────────────────────────────────────────────────────────────┘         │
│                                                                                             │
│  【ModuleInstance 产品实例化】                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐         │
│  │                         ModuleInstance                                         │         │
│  │                         NC-2000 / NC-5000                                      │         │
│  │                         引用 Module + 裁剪 + 覆盖                               │         │
│  └───────────────────────────────────────────────────────────────────────────────┘         │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 关键设计：模块-对象关系（ModuleObjectRelation）

ModuleObjectRelation 是多维扩展的核心机制，其核心价值在于：

1. **关系类型（relation_type）**：区分"具备（HAS）"、"扩展（EXTENDS）"、"覆盖（OVERRIDES）"
2. **维度字段（dimension）**：区分业务对象的类型（SPEC/PARAM/MARKETING/DELIVERY/FINANCE/OPERATION）
3. **继承策略（inheritance_policy）**：处理从父模块继承的业务对象

**示例：产品具备营销资料**

| module_id | business_object_id | relation_type | dimension | 说明 |
| --- | --- | --- | --- | --- |
| NETWORK_PLATFORM | MARKETING_DOC | HAS | MARKETING | 产品具备营销资料 |
| ROUTER_MODULE | MARKETING_DOC | HAS | MARKETING | 路由器模块具备营销资料 |
| SWITCH_MODULE | MARKETING_DOC | HAS | MARKETING | 交换机模块具备营销资料 |

> **扩展说明**：新增业务维度（如"合规"）时，只需定义新的 BusinessObjectType（如 type=COMPLIANCE），然后建立 ModuleObjectRelation 即可，无需修改核心模型。

### 2.4 图的边类型（ModuleLink）

ModuleLink 支持三种边类型，支撑图的遍历能力：

| 边类型 | 语义 | 适用场景 | 示例 |
| --- | --- | --- | --- |
| **CONTAINS** | 包含关系（树状） | 模块嵌套、层级结构 | NETWORK_CENTER contains ROUTER_MODULE |
| **EXTENDS** | 扩展关系 | 模板继承、特化 | ENTERPRISE_NETWORK extends BASE_NETWORK |
| **REFERENCES** | 引用关系（图状） | 策略共享、依赖引用 | FIREWALL_MODULE references SECURITY_POLICY |

> **REFERENCES 边是图的灵魂**：当 ROUTER_MODULE 和 SWITCH_MODULE 都需要应用同一个安全策略时，它们通过 REFERENCES 边引用 SECURITY_MODULE，而不是各自复制一份。这使得安全策略的变更能够自动传播。

---

## 三、消费场景详解

### 3.1 消费场景概述

数字产品模型的数据消费场景可以分为三类：

| 场景类型 | 查询特征 | 技术实现 | 典型用例 |
| --- | --- | --- | --- |
| **树状遍历** | 单跳父子查询 | 递归 CTE 或内存树 | BOM 展开、层级导航 |
| **图的多跳** | 跨层关联查询 | 图数据库遍历 | 策略传播、影响分析 |
| **多维投影** | 特定维度筛选 | 维度过滤 + 聚合 | 营销材料生成、交付规格导出 |

### 3.2 场景一：网络设计配置器（图的多跳消费）

#### 3.2.1 场景描述

企业客户需要设计一个园区网络，需求如下：

- 核心交换机 + 汇聚交换机 + 接入交换机组成三层网络
- 每个交换机需要配置防火墙子模块
- 防火墙需要引用统一的安全策略库
- 安全策略需要引用合规审计模块
- 最终输出网络拓扑图 + BOM + 安全配置清单

#### 3.2.2 数据模型支撑

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            网络设计器 - 多跳引用图                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  【根节点】                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  Module: ENTERPRISE_NETWORK_v1                                              │           │
│  │  顶层：企业网络                                                                          │           │
│  └────────────────────────────────────┬────────────────────────────────────────┘           │
│                                       │ CONTAINS                                                     │
│                                       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  Module: CORE_SWITCH                                                        │           │
│  │  核心交换机                                                                               │           │
│  │  BusinessObjectInstance: PortCount=48, Backplane=1000Gbps                                │           │
│  │                                                                               │           │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │           │
│  │  │  ModuleLink (REFERENCES) → SECURITY_MODULE                            │   │           │
│  │  │  核心交换机引用安全模块                                                     │   │           │
│  │  └─────────────────────────────────────────────────────────────────────┘   │           │
│  └────────────────────────────────────┬────────────────────────────────────────┘           │
│                                       │ CONTAINS                                                     │
│                                       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  Module: FIREWALL_SUBMODULE                                                │           │
│  │  防火墙子模块                                                                             │           │
│  │  BusinessObjectInstance: Throughput=10Gbps, RuleCapacity=10000                           │           │
│  │                                                                               │           │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │           │
│  │  │  ModuleLink (REFERENCES) → SECURITY_POLICY                           │   │           │
│  │  │  防火墙子模块引用安全策略库                                                 │   │           │
│  │  └─────────────────────────────────────────────────────────────────────┘   │           │
│  └────────────────────────────────────┬────────────────────────────────────────┘           │
│                                       │ CONTAINS                                                     │
│                                       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  Module: COMPLIANCE_AUDIT_MODULE                                           │           │
│  │  合规审计模块                                                                              │           │
│  │  BusinessObjectInstance: Standard=ISO27001, AuditFrequency=MONTHLY                      │           │
│  │                                                                               │           │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │           │
│  │  │  ModuleLink (REFERENCES) → BACKUP_POLICY                             │   │           │
│  │  │  合规审计模块引用备份策略                                                 │   │           │
│  │  └─────────────────────────────────────────────────────────────────────┘   │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                       │                                                                 │
│                                       │ (继续引用链...)                                              │
│                                       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  Module: BACKUP_POLICY                                                     │           │
│  │  备份策略模块                                                                              │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 多跳查询示例

**查询需求**：找出 CORE_SWITCH 的所有直接或间接引用的安全相关模块（深度不限）

**GraphQL 查询示例**：

```graphql
query findSecurityChain($moduleCode: String!, $maxDepth: Int!) {
  module(code: $moduleCode) {
    code
    name
    traverseReferences(maxDepth: $maxDepth) {
      edges {
        path          # 路径: CORE_SWITCH -> FIREWALL_SUBMODULE -> SECURITY_POLICY
        targetModule {
          code
          name
          moduleType
          specs(dimension: MARKETING) {
            specCode
            value
          }
        }
      }
    }
  }
}

# 变量
{
  "moduleCode": "CORE_SWITCH",
  "maxDepth": 5
}
```

**返回结果示例**：

```json
{
  "data": {
    "module": {
      "code": "CORE_SWITCH",
      "name": "核心交换机",
      "traverseReferences": {
        "edges": [
          {
            "path": "CORE_SWITCH -> FIREWALL_SUBMODULE",
            "targetModule": {
              "code": "FIREWALL_SUBMODULE",
              "name": "防火墙子模块",
              "moduleType": "COMPONENT",
              "specs": [
                { "specCode": "Throughput", "value": "10Gbps" }
              ]
            }
          },
          {
            "path": "CORE_SWITCH -> FIREWALL_SUBMODULE -> SECURITY_POLICY",
            "targetModule": {
              "code": "SECURITY_POLICY",
              "name": "安全策略库",
              "moduleType": "COMPONENT",
              "specs": [
                { "specCode": "Standard", "value": "ISO27001" }
              ]
            }
          },
          {
            "path": "CORE_SWITCH -> FIREWALL_SUBMODULE -> SECURITY_POLICY -> COMPLIANCE_AUDIT_MODULE",
            "targetModule": {
              "code": "COMPLIANCE_AUDIT_MODULE",
              "name": "合规审计模块",
              "moduleType": "COMPONENT",
              "specs": [
                { "specCode": "Standard", "value": "ISO27001" },
                { "specCode": "AuditFrequency", "value": "MONTHLY" }
              ]
            }
          },
          {
            "path": "CORE_SWITCH -> FIREWALL_SUBMODULE -> SECURITY_POLICY -> COMPLIANCE_AUDIT_MODULE -> BACKUP_POLICY",
            "targetModule": {
              "code": "BACKUP_POLICY",
              "name": "备份策略模块",
              "moduleType": "COMPONENT",
              "specs": []
            }
          }
        ]
      }
    }
  }
}
```

### 3.3 场景二：工程交付项目管理（多维投影）

#### 3.3.1 场景描述

工程交付项目需要同时满足多个干系人的需求：

- **项目经理**：需要查看项目结构、工期、资源分配
- **客户**：需要查看交付物清单、时间表、服务等级
- **财务**：需要查看成本、利润、发票计划
- **运维**：需要查看部署要求、监控指标、应急预案

同一份数据模型，需要投影出不同干系人关注的信息。

#### 3.3.2 多维数据实例

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            工程交付项目 - 多维数据投影                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  【Module: PROJECT_DELIVERY_001】                                                          │
│  顶层项目模块                                                                                 │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  BusinessObjectInstance (SPEC - 项目技术规格)                                    │           │
│  │  ├── ProjectType=ERP_IMPLEMENTATION                                        │           │
│  │  ├── Complexity=HIGH                                                        │           │
│  │  ├── EstimatedDuration=180_DAYS                                            │           │
│  │  └── TechStack=["SAP", "Oracle DB", "Kubernetes"]                         │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  BusinessObjectInstance (MARKETING - 客户可见信息)                               │           │
│  │  ├── ProjectName="ABC集团ERP系统实施"                                        │           │
│  │  ├── ClientIndustry=MANUFACTURING                                           │           │
│  │  ├── ContractValue=50000000                                                │           │
│  │  ├── SlaLevel=GOLD                                                          │           │
│  │  └── KeyMilestones=["需求确认", "UAT通过", "上线切换", "验收签字"]            │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  BusinessObjectInstance (DELIVERY - 交付规格)                                    │           │
│  │  ├── DeliveryFormat=["源码", "文档", "培训材料"]                             │           │
│  │  ├── InstallationRequired=true                                              │           │
│  │  ├── HandoverDate=2026-12-31                                               │           │
│  │  └── SupportPeriod=12_MONTHS                                               │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  BusinessObjectInstance (FINANCE - 财务规格)                                    │           │
│  │  ├── CostModel=TIME_AND_MATERIALS                                           │           │
│  │  ├── BudgetLimit=60000000                                                   │           │
│  │  ├── PaymentSchedule=["签约30%", "需求确认20%", "UAT30%", "验收20%"]         │           │
│  │  ├── EstimatedMargin=0.15                                                    │           │
│  │  └── TaxCategory=VAT_6                                                       │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐           │
│  │  BusinessObjectInstance (OPERATION - 运维规格)                                    │           │
│  │  ├── DeploymentEnvironment=["Dev", "Test", "Prod"]                         │           │
│  │  ├── MonitoringRequired=true                                                 │           │
│  │  ├── BackupPolicy=DAILY_INCREMENTAL_WEEKLY_FULL                             │           │
│  │  ├── RecoveryTimeObjective=4_HOURS                                          │           │
│  │  └── RecoveryPointObjective=1_HOUR                                          │           │
│  └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                             │
│  【子模块层级】                                                                               │
│  ModuleLink (CONTAINS):                                                                     │
│  ├── PROJECT_PHASE_001 (需求分析阶段)                                                       │
│  ├── PROJECT_PHASE_002 (系统设计阶段)                                                       │
│  ├── PROJECT_PHASE_003 (开发实施阶段)                                                       │
│  └── PROJECT_PHASE_004 (验收交付阶段)                                                       │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.3.3 多维查询示例

**需求**：项目经理需要导出完整的交付清单

**SQL 查询示例**：

```sql
-- 查询所有交付维度的业务对象实例（维度过滤）
SELECT
    m.code AS module_code,
    m.name AS module_name,
    bo.object_type,
    boi.values
FROM module m
JOIN business_object_instance boi ON boi.owner_id = m.id AND boi.owner_type = 'Module'
JOIN business_object bo ON bo.id = boi.business_object_id
WHERE m.code LIKE 'PROJECT_DELIVERY_001%'
  AND bo.object_type = 'DELIVERY'
  AND m.status = 'PUBLISHED'
ORDER BY m.depth, m.code;
```

**返回结果**：

| module_code | module_name | object_type | values |
| --- | --- | --- | --- |
| PROJECT_DELIVERY_001 | ABC集团ERP系统实施 | DELIVERY | {"value": ["源码", "文档", "培训材料"]} |
| PROJECT_DELIVERY_001 | ABC集团ERP系统实施 | DELIVERY | {"value": {"installationRequired": true}} |
| PROJECT_DELIVERY_001 | ABC集团ERP系统实施 | DELIVERY | {"value": {"handoverDate": "2026-12-31"}} |
| PROJECT_DELIVERY_001 | ABC集团ERP系统实施 | DELIVERY | {"value": {"supportPeriod": 12}} |
| PROJECT_PHASE_001 | 需求分析阶段 | DELIVERY | {"value": ["需求规格说明书", "现状调研报告"]} |
| PROJECT_PHASE_002 | 系统设计阶段 | DELIVERY | {"value": ["架构设计文档", "接口设计文档"]} |

### 3.4 场景三：产品配置约束求解（继承+扩展）

#### 3.4.1 场景描述

数字产品继承复杂产品配置的能力，支持 Part 候选集裁剪和规格覆盖。

例如：
- 基础网络产品 NETWORK_BASE 支持 4 种路由器型号
- 中端产品 NETWORK_MID 禁用低端型号
- 高端产品 NETWORK_PRO 只保留高端型号

#### 3.4.2 实例数据

```
ModuleInstance: NETWORK_PRO
├── base_module_id: NETWORK_BASE
├── disabled_modules: [ROUTER_V1, ROUTER_V2]  -- 禁用低端
├── enabled_parts: [ROUTER_V4_X, SWITCH_10G]
├── business_object_overrides: [
    { businessObjectId: "SPEC_MAX_BANDWIDTH", values: { overrideValue: "100Gbps" } },
    { businessObjectId: "MKT_SLA_LEVEL", values: { value: "PREMIUM" } }
  ]
```

---

## 四、详细数据案例

### 4.1 网络产品案例

#### 4.1.1 Module 数据

**顶层产品模块**

| code | name | module_type | parent_module_id | depth |
| --- | --- | --- | --- | --- |
| NETWORK_PLATFORM | 网络产品平台 | PRODUCT | null | 0 |
| ROUTER_MODULE | 路由器模块 | COMPONENT | NETWORK_PLATFORM | 1 |
| SWITCH_MODULE | 交换机模块 | COMPONENT | NETWORK_PLATFORM | 1 |
| FIREWALL_MODULE | 防火墙模块 | COMPONENT | NETWORK_PLATFORM | 1 |
| SECURITY_POLICY | 安全策略库 | COMPONENT | null (独立) | 0 |
| COMPLIANCE_MODULE | 合规审计模块 | COMPONENT | SECURITY_POLICY | 1 |

**Part 数据**

| code | name | module_id | price |
| --- | --- | --- | --- |
| RTR_V1_100M | 路由器100M型 | ROUTER_MODULE | 5000 |
| RTR_V2_1G | 路由器1G型 | ROUTER_MODULE | 15000 |
| RTR_V3_10G | 路由器10G型 | ROUTER_MODULE | 45000 |
| RTR_V4_100G | 路由器100G型 | ROUTER_MODULE | 120000 |
| SW_1G_24P | 24口千兆交换机 | SWITCH_MODULE | 8000 |
| SW_10G_48P | 48口万兆交换机 | SWITCH_MODULE | 25000 |
| FW_LIC_STD | 防火墙标准许可 | FIREWALL_MODULE | 3000 |
| FW_LIC_ADV | 防火墙高级许可 | FIREWALL_MODULE | 8000 |

#### 4.1.2 BusinessObject 多维业务对象

**业务对象定义**

| code | name | object_type | schema (字段) |
| --- | --- | --- | --- |
| SPEC_PORT_COUNT | 端口数量 | SPEC | type=INTEGER, unit=ports |
| SPEC_MAX_BANDWIDTH | 最大带宽 | SPEC | type=STRING, unit=Gbps |
| SPEC_THROUGHPUT | 吞吐率 | SPEC | type=STRING, unit=Gbps |
| SPEC_SPEED | 传输速率 | SPEC | type=STRING, unit=Mbps |
| MKT_BROCHURE | 产品手册 | MARKETING | brochureId, sellingPoints[], warrantyMonths |
| MKT_SELLING_POINTS | 卖点 | MARKETING | sellingPoints[] |
| DLV_LEAD_TIME | 交付工期 | DELIVERY | leadTimeDays, unit=days |
| DLV_INSTALLATION | 安装要求 | DELIVERY | installationHours, onSiteSupportDays |
| FIN_COST_BASE | 成本基价 | FINANCE | costBase, unit=CNY |
| FIN_PRICE | 参考价格 | FINANCE | priceCNY, unit=CNY |

**业务对象实例数据**

| owner_type | owner_id | business_object_id | values (JSON) |
| --- | --- | --- | --- |
| Module | ROUTER_MODULE | SPEC_PORT_COUNT | {"value": 24} |
| Module | ROUTER_MODULE | SPEC_MAX_BANDWIDTH | {"value": "100Gbps"} |
| Module | ROUTER_MODULE | MKT_BROCHURE | {"brochureId": "ASSET-RTR", "sellingPoints": ["高可靠", "易运维"]} |
| Module | ROUTER_MODULE | DLV_LEAD_TIME | {"leadTimeDays": 14} |
| Module | ROUTER_MODULE | DLV_INSTALLATION | {"installationHours": 4} |
| Module | ROUTER_MODULE | FIN_COST_BASE | {"costBase": 3000} |
| Module | SWITCH_MODULE | SPEC_PORT_COUNT | {"value": 48} |
| Module | SWITCH_MODULE | MKT_BROCHURE | {"brochureId": "ASSET-SW", "sellingPoints": ["全光口", "PoE支持"]} |
| Module | FIREWALL_MODULE | SPEC_THROUGHPUT | {"value": "10Gbps"} |
| Module | SECURITY_POLICY | SPEC_PORT_COUNT | {"value": 1} |
| Part | RTR_V1_100M | SPEC_SPEED | {"value": "100Mbps"} |
| Part | RTR_V1_100M | FIN_PRICE | {"priceCNY": 5000} |

**ModuleObjectRelation 关系数据**

| module_id | business_object_id | relation_type | dimension |
| --- | --- | --- | --- |
| ROUTER_MODULE | SPEC_PORT_COUNT | HAS | SPEC |
| ROUTER_MODULE | SPEC_MAX_BANDWIDTH | HAS | SPEC |
| ROUTER_MODULE | MKT_BROCHURE | HAS | MARKETING |
| ROUTER_MODULE | DLV_LEAD_TIME | HAS | DELIVERY |
| ROUTER_MODULE | FIN_COST_BASE | HAS | FINANCE |
| SWITCH_MODULE | SPEC_PORT_COUNT | HAS | SPEC |
| SWITCH_MODULE | MKT_BROCHURE | HAS | MARKETING |

#### 4.1.3 ModuleLink 关系边数据

| parent_module | child_module | link_type | min_cardinality | max_cardinality | selection_policy |
| --- | --- | --- | --- | --- | --- |
| NETWORK_PLATFORM | ROUTER_MODULE | CONTAINS | 1 | 2 | REQUIRED |
| NETWORK_PLATFORM | SWITCH_MODULE | CONTAINS | 2 | 10 | REQUIRED |
| NETWORK_PLATFORM | FIREWALL_MODULE | CONTAINS | 0 | 1 | OPTIONAL |
| ROUTER_MODULE | SECURITY_POLICY | REFERENCES | 0 | 1 | OPTIONAL |
| SWITCH_MODULE | SECURITY_POLICY | REFERENCES | 0 | 1 | OPTIONAL |
| FIREWALL_MODULE | SECURITY_POLICY | REFERENCES | 1 | 1 | REQUIRED |
| SECURITY_POLICY | COMPLIANCE_MODULE | CONTAINS | 1 | 1 | REQUIRED |

#### 4.1.4 完整 ModuleInstance 数据

**产品实例：NETWORK_PRO_2000**

```json
{
  "code": "NETWORK_PRO_2000",
  "name": "企业高端网络解决方案",
  "version": "1.0.0",
  "module_id": "NETWORK_PLATFORM",
  "status": "PUBLISHED",
  "enabled_parts": [
    { "partCode": "RTR_V3_10G", "minQty": 1, "maxQty": 2, "defaultSelected": true },
    { "partCode": "RTR_V4_100G", "minQty": 0, "maxQty": 2, "defaultSelected": false },
    { "partCode": "SW_10G_48P", "minQty": 2, "maxQty": 8, "defaultSelected": true },
    { "partCode": "FW_LIC_ADV", "minQty": 1, "maxQty": 1, "defaultSelected": true }
  ],
  "disabled_parts": [
    { "partCode": "RTR_V1_100M", "reason": "高端方案不提供低端型号" },
    { "partCode": "RTR_V2_1G", "reason": "高端方案不提供中端型号" },
    { "partCode": "SW_1G_24P", "reason": "高端方案需要万兆起步" },
    { "partCode": "FW_LIC_STD", "reason": "高端方案标配高级许可" }
  ],
  "enabled_modules": [
    { "moduleCode": "ROUTER_MODULE", "defaultSelected": true },
    { "moduleCode": "SWITCH_MODULE", "defaultSelected": true },
    { "moduleCode": "FIREWALL_MODULE", "defaultSelected": true }
  ],
  "disabled_modules": [],
  "business_object_overrides": {
    "MARKETING": [
      { "businessObjectId": "MKT_BROCHURE", "values": { "brochureId": "ASSET-NETPRO2000", "sellingPoints": ["高性能", "高可靠", "全万兆", "智能运维"], "warrantyMonths": 36 } }
    ],
    "DELIVERY": [
      { "businessObjectId": "DLV_LEAD_TIME", "values": { "leadTimeDays": 21 } },
      { "businessObjectId": "DLV_INSTALLATION", "values": { "installationRequired": true, "installationHours": 8, "onSiteSupportDays": 3 } }
    ],
    "FINANCE": [
      { "businessObjectId": "FIN_COST_BASE", "values": { "costBase": 150000 } }
    ]
  }
}
```

### 4.2 工程交付项目案例

#### 4.2.1 Module 数据

| code | name | module_type | parent_module_id |
| --- | --- | --- | --- |
| PROJECT_ABC_ERP | ABC集团ERP实施项目 | PRODUCT | null |
| PHASE_001_REQUIREMENTS | 需求分析阶段 | COMPONENT | PROJECT_ABC_ERP |
| PHASE_002_DESIGN | 系统设计阶段 | COMPONENT | PROJECT_ABC_ERP |
| PHASE_003_DEVELOPMENT | 开发实施阶段 | COMPONENT | PROJECT_ABC_ERP |
| PHASE_004_HANDOVER | 验收交付阶段 | COMPONENT | PROJECT_ABC_ERP |
| WORKSTREAM_FINANCE | 财务模块工作流 | COMPONENT | PHASE_003_DEVELOPMENT |
| WORKSTREAM_HR | HR模块工作流 | COMPONENT | PHASE_003_DEVELOPMENT |

#### 4.2.2 BusinessObject 多维业务对象

**业务对象定义**

| code | name | object_type | schema (字段) |
| --- | --- | --- | --- |
| SPEC_PROJECT_TYPE | 项目类型 | SPEC | type=ENUM, options=[ERP_IMPLEMENTATION, ...] |
| SPEC_COMPLEXITY | 复杂度 | SPEC | type=ENUM, options=[LOW, MED, HIGH] |
| SPEC_TECH_STACK | 技术栈 | SPEC | type=STRING[] |
| SPEC_DURATION | 工期 | SPEC | type=INTEGER, unit=DAYS |
| MKT_PROJECT_NAME | 项目名称 | MARKETING | type=STRING |
| MKT_CLIENT_INDUSTRY | 客户行业 | MARKETING | type=ENUM |
| MKT_CONTRACT_VALUE | 合同金额 | MARKETING | type=DECIMAL, unit=CNY |
| MKT_SLA_LEVEL | 服务等级 | MARKETING | type=ENUM, options=[GOLD, SILVER, BRONZE] |
| DLV_DELIVERY_FORMAT | 交付格式 | DELIVERY | type=STRING[] |
| DLV_HANDOVER_DATE | 交付日期 | DELIVERY | type=DATE |
| DLV_SUPPORT_PERIOD | 质保期 | DELIVERY | type=INTEGER, unit=MONTHS |
| DLV_DELIVERABLES | 交付物清单 | DELIVERY | type=STRING[] |
| FIN_COST_MODEL | 成本模型 | FINANCE | type=ENUM |
| FIN_BUDGET_LIMIT | 预算上限 | FINANCE | type=DECIMAL, unit=CNY |
| FIN_PAYMENT_SCHEDULE | 付款计划 | FINANCE | type=STRING[] |
| FIN_ESTIMATED_MARGIN | 预计利润率 | FINANCE | type=DECIMAL |
| FIN_TAX_RATE | 税率 | FINANCE | type=DECIMAL |
| OPE_DEPLOYMENT_ENV | 部署环境 | OPERATION | type=STRING[] |
| OPE_MONITORING | 监控要求 | OPERATION | type=BOOLEAN |
| OPE_BACKUP_POLICY | 备份策略 | OPERATION | type=ENUM |
| OPE_RTO | 恢复时间目标 | OPERATION | type=INTEGER, unit=HOURS |
| OPE_RPO | 恢复点目标 | OPERATION | type=INTEGER, unit=HOURS |

**顶层项目多维业务对象实例**

| business_object_id | dimension | values (JSON) |
| --- | --- | --- |
| SPEC_PROJECT_TYPE | SPEC | {"value": "ERP_IMPLEMENTATION"} |
| SPEC_COMPLEXITY | SPEC | {"value": "HIGH"} |
| SPEC_TECH_STACK | SPEC | {"value": ["SAP S/4HANA", "Oracle DB 19c", "K8s"]} |
| MKT_PROJECT_NAME | MARKETING | {"value": "ABC集团数字化转型ERP系统"} |
| MKT_CLIENT_INDUSTRY | MARKETING | {"value": "MANUFACTURING"} |
| MKT_CONTRACT_VALUE | MARKETING | {"value": 50000000} |
| MKT_SLA_LEVEL | MARKETING | {"value": "GOLD"} |
| DLV_DELIVERY_FORMAT | DELIVERY | {"value": ["源码", "文档", "培训材料", "运维手册"]} |
| DLV_HANDOVER_DATE | DELIVERY | {"value": "2026-12-31"} |
| DLV_SUPPORT_PERIOD | DELIVERY | {"value": 12} |
| FIN_COST_MODEL | FINANCE | {"value": "TIME_AND_MATERIALS"} |
| FIN_BUDGET_LIMIT | FINANCE | {"value": 60000000} |
| FIN_PAYMENT_SCHEDULE | FINANCE | {"value": ["30%@签约", "20%@需求确认", "30%@UAT", "20%@验收"]} |
| FIN_ESTIMATED_MARGIN | FINANCE | {"value": 0.15} |
| FIN_TAX_RATE | FINANCE | {"value": 0.06} |
| OPE_DEPLOYMENT_ENV | OPERATION | {"value": ["Dev", "Test", "Staging", "Prod"]} |
| OPE_MONITORING | OPERATION | {"value": true} |
| OPE_BACKUP_POLICY | OPERATION | {"value": "DAILY_INCREMENTAL_WEEKLY_FULL"} |
| OPE_RTO | OPERATION | {"value": 4} |
| OPE_RPO | OPERATION | {"value": 1} |

**阶段子模块业务对象**

| module_code | business_object_id | dimension | values |
| --- | --- | --- | --- |
| PHASE_001_REQUIREMENTS | SPEC_DURATION | SPEC | {"value": 45} |
| PHASE_001_REQUIREMENTS | DLV_DELIVERABLES | DELIVERY | {"value": ["需求规格说明书", "现状调研报告", "业务流程文档"]} |
| PHASE_001_REQUIREMENTS | FIN_BUDGET_LIMIT | FINANCE | {"value": 5000000} |
| PHASE_002_DESIGN | SPEC_DURATION | SPEC | {"value": 60} |
| PHASE_002_DESIGN | DLV_DELIVERABLES | DELIVERY | {"value": ["架构设计文档", "详细设计文档", "接口文档"]} |
| PHASE_002_DESIGN | FIN_BUDGET_LIMIT | FINANCE | {"value": 8000000} |
| PHASE_003_DEVELOPMENT | SPEC_DURATION | SPEC | {"value": 180} |
| PHASE_003_DEVELOPMENT | DLV_DELIVERABLES | DELIVERY | {"value": ["源代码", "配置说明", "测试报告"]} |
| PHASE_003_DEVELOPMENT | FIN_BUDGET_LIMIT | FINANCE | {"value": 28000000} |
| PHASE_004_HANDOVER | SPEC_DURATION | SPEC | {"value": 30} |
| PHASE_004_HANDOVER | DLV_DELIVERABLES | DELIVERY | {"value": ["用户手册", "培训材料", "验收报告"]} |
| PHASE_004_HANDOVER | FIN_BUDGET_LIMIT | FINANCE | {"value": 9000000} |

---

## 五、业务处理流程

### 5.1 流程总览

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              数字产品全生命周期                                              │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        阶段一：模块建模（产品数据架构师）                                 │   │
│  │                                                                                    │   │
│  │  1. 创建顶层 Module（type=PRODUCT）                                                  │   │
│  │  2. 递归创建子 Module（type=COMPONENT）                                              │   │
│  │  3. 定义 ModuleLink 关系（CONTAINS / EXTENDS / REFERENCES）                         │   │
│  │  4. 定义 BusinessObject 及 ModuleObjectRelation（含 dimension）                      │   │
│  │  5. 录入 Part 及 BusinessObjectInstance（含多维度取值）                              │   │
│  │  6. 发布 Module                                                                   │   │
│  │                                                                                    │   │
│  │  输出：NETWORK_PLATFORM:1.0.0（已发布）                                             │   │
│  └────────────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                                    │
│                                      ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        阶段二：产品实例化（产品数据工程师）                              │   │
│  │                                                                                    │   │
│  │  1. 创建 ModuleInstance（引用 Module）                                              │   │
│  │  2. 裁剪 enabled/disabled modules 和 parts                                          │   │
│  │  3. 定义 business_object_overrides（业务对象覆盖）                                   │   │
│  │  4. 填充多维度扩展数据（Marketing / Delivery / Finance / Operation）                   │   │
│  │  5. 发布 ModuleInstance                                                             │   │
│  │                                                                                    │   │
│  │  输出：NETWORK_PRO_2000:1.0.0（已发布）                                             │   │
│  └────────────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                                    │
│                                      ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        阶段三：数据消费（各类业务系统）                                  │   │
│  │                                                                                    │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ 树状遍历         │  │ 图的多跳查询     │  │ 多维投影查询     │  │ 配置约束求解     │  │   │
│  │  │ BOM展开         │  │ 安全链追溯       │  │ 营销材料生成     │  │ Part筛选        │  │   │
│  │  │ 层级导航        │  │ 影响分析        │  │ 交付清单导出     │  │ 规格校验        │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 阶段一：模块建模

**责任人**：产品数据架构师

**核心任务**：定义产品的模块结构、关系边和规格参数。

```
Step 1: 创建顶层 Module
├── code: NETWORK_PLATFORM
├── name: 网络产品平台
├── module_type: PRODUCT
└── parent_module_id: null

Step 2: 递归创建子 Module
├── ROUTER_MODULE (parent: NETWORK_PLATFORM)
├── SWITCH_MODULE (parent: NETWORK_PLATFORM)
├── FIREWALL_MODULE (parent: NETWORK_PLATFORM)
└── SECURITY_POLICY (parent: null, 独立模块)

Step 3: 定义 ModuleLink 关系
├── NETWORK_PLATFORM contains ROUTER_MODULE (REQUIRED, 1-2)
├── NETWORK_PLATFORM contains SWITCH_MODULE (REQUIRED, 2-10)
├── ROUTER_MODULE references SECURITY_POLICY (OPTIONAL, 0-1)
└── FIREWALL_MODULE references SECURITY_POLICY (REQUIRED, 1-1)

Step 4: 定义 BusinessObject 及 ModuleObjectRelation（含 dimension）
├── ROUTER_MODULE.BusinessObject.PortCount (SPEC)
├── ROUTER_MODULE.BusinessObject.MaxBandwidth (SPEC)
├── ROUTER_MODULE.BusinessObject.brochureId (MARKETING)
├── ROUTER_MODULE.BusinessObject.leadTimeDays (DELIVERY)
└── ROUTER_MODULE.BusinessObject.costBase (FINANCE)

Step 5: 录入 Part 及 BusinessObjectInstance
├── RTR_V1_100M (part)
│   ├── BusinessObjectInstance.Speed = "100Mbps" (SPEC)
│   └── BusinessObjectInstance.priceCNY = "5000" (FINANCE)
└── ... (其他 Part)

Step 6: 发布 Module
└── NETWORK_PLATFORM:1.0.0 PUBLISHED
```

### 5.3 阶段二：产品实例化

**责任人**：产品数据工程师

**核心任务**：基于已发布的 Module 创建可售产品实例。

```
Step 1: 创建 ModuleInstance
├── code: NETWORK_PRO_2000
├── name: 企业高端网络解决方案
├── module_id: NETWORK_PLATFORM
└── version: 1.0.0

Step 2: 裁剪 Part 候选集
├── enabled_parts: RTR_V3_10G, RTR_V4_100G, SW_10G_48P, FW_LIC_ADV
└── disabled_parts: RTR_V1_100M, RTR_V2_1G, SW_1G_24P, FW_LIC_STD

Step 3: 定义规格覆盖
└── business_object_overrides: [
    { businessObjectId: "SPEC_MAX_BANDWIDTH", values: { overrideValue: "100Gbps" } }
  ]

Step 4: 填充多维度数据
├── BusinessObjectInstance.MARKETING: { brochureId, sellingPoints, warrantyMonths }
├── BusinessObjectInstance.DELIVERY: { leadTimeDays, installationRequired }
└── BusinessObjectInstance.FINANCE: { costBase, paymentTerms }

Step 5: 发布 ModuleInstance
└── NETWORK_PRO_2000:1.0.0 PUBLISHED
```

---

## 六、与复杂产品配置模型的关系

### 6.1 概念映射

| 复杂产品配置概念 | 数字产品概念 | 说明 |
| --- | --- | --- |
| ProductClass | Module (module_type=PRODUCT) | 顶层产品模块 |
| PartClass | Module (module_type=COMPONENT) | 组件模块 |
| Part | Part | 原子部件 |
| Specification | BusinessObject (type=SPEC) | 技术规格 |
| Parameter | BusinessObject (type=PARAM) | 配置参数 |
| SpecValue | BusinessObjectInstance | 规格值实例 |
| ProductInstance | ModuleInstance | 产品实例 |
| offersPart | enabled_parts / disabled_parts | 部件裁剪 |
| SpecOverride | business_object_overrides | 业务对象覆盖 |
| （无对应） | BusinessObject (type=MARKETING/DELIVERY/FINANCE/OPERATION) | 多维扩展 |
| （无对应） | ModuleObjectRelation (HAS) | 模块-对象关系 |
| （无对应） | ModuleLink (REFERENCES) | 图的引用边 |

### 6.2 扩展点总结

```
复杂产品配置模型 ──扩展──> 数字产品模型
      │                              │
      │                              ├── 多层性：Module 递归包含子 Module
      │                              │
      │                              ├── 多维性：BusinessObject 支持多业务维度
      │                              │       (SPEC/PARAM/MARKETING/DELIVERY/FINANCE/OPERATION)
      │                              │
      │                              ├── 模块-对象关系：ModuleObjectRelation 支持灵活的业务对象关联
      │                              │
      │                              └── 图的能力：ModuleLink.REFERENCES 支持多跳查询
      │
      └── ProductClass → PartClass → Part (三层树状)
                               ↓
                    Module → Module/Part (统一递归)
```

---

## 七、关键指标汇总

### 7.1 实体规模

| 实体类型 | 数量（网络产品案例） | 说明 |
| --- | --- | --- |
| Module | 6 | 含 1 个顶层 + 4 个组件 + 1 个独立模块 |
| ModuleLink | 7 | 含 CONTAINS、REFERENCES 边 |
| Part | 8 | 路由器 4 个 + 交换机 2 个 + 防火墙许可 2 个 |
| BusinessObject | 15+ | 按 object_type 分布 |
| BusinessObjectInstance | 20+ | 按 dimension 分布 |
| ModuleObjectRelation | 10+ | 按 relation_type 和 dimension 分布 |
| ModuleInstance | 1 | NETWORK_PRO_2000 |

### 7.2 维度覆盖

| 维度 | 支持的实体 | 典型用例 |
| --- | --- | --- |
| SPEC | Module, Part | 技术规格、性能指标 |
| MARKETING | Module, ModuleInstance | 产品资料、销售策略 |
| DELIVERY | Module, ModuleInstance | 交付规格、物流信息 |
| FINANCE | Module, ModuleInstance | 成本、定价、发票 |
| OPERATION | Module, ModuleInstance | 部署、监控、运维 |

### 7.3 图的边类型

| 边类型 | 语义 | 支持的查询 |
| --- | --- | --- |
| CONTAINS | 树状包含 | 层级遍历、BOM 展开 |
| EXTENDS | 模板继承 | 配置模板复用 |
| REFERENCES | 跨模块引用 | 安全链追溯、影响分析 |

---

## 八、附录

### 8.1 术语表

| 术语 | 全称 | 说明 |
| --- | --- | --- |
| Module | 模块 | 数字产品的核心抽象，统一替代 ProductClass 和 PartClass |
| ModuleLink | 模块关系边 | 表达模块间的 CONTAINS/EXTENDS/REFERENCES 关系 |
| BusinessObject | 业务对象 | 多维业务数据的统一抽象（规格/参数/营销资料/交付资料等） |
| BusinessObjectInstance | 业务对象实例 | BusinessObject 的具体取值 |
| ModuleObjectRelation | 模块-对象关系 | 建立业务对象与模块的 HAS/EXTENDS/OVERRIDES 关系 |
| ModuleInstance | 模块实例 | 基于 Module 实例化的可售产品 |
| REFERENCES 边 | 引用边 | 图的多跳查询基础，跨模块引用关系 |
| 多跳查询 | Multi-hop Query | 沿 REFERENCES 边进行深度遍历的查询 |
| object_type | 业务对象类型 | BusinessObject 的类型（SPEC/PARAM/MARKETING/DELIVERY/FINANCE/OPERATION） |
| relation_type | 关系类型 | ModuleObjectRelation 的类型（HAS/EXTENDS/OVERRIDES） |
| dimension | 维度 | 区分业务对象的语义分类 |

### 8.2 维度速查

| 问题 | 答案 |
| --- | --- |
| 产品宣传册 ID 属于哪个维度？ | MARKETING |
| 交付工期属于哪个维度？ | DELIVERY |
| 成本基价属于哪个维度？ | FINANCE |
| 部署环境要求属于哪个维度？ | OPERATION |
| 技术规格属于哪个维度？ | SPEC |
| 配置参数属于哪个维度？ | CONFIG |

---

*文档结束*
