# 基于 Palantir 范式的复杂产品配置器语义建模方案

> **文档版本**: v1.0
> **创建时间**: 2026-07-28
> **核心主题**: 复杂产品配置器的 Palantir Ontology 语义建模、三层业务模型到双层元模型的映射
> **重写说明**: v1.0 将复杂产品配置器的三层业务模型（L1业务元模型/L2业务对象实例/L3配置运行实例）映射到 Palantir 范式的双层语义模型（Meta Layer / Object Instance Layer），保持原有建模语义不变，同时获得 Ontology 的可组合、可扩展能力。

---

## 一、Palantir 范式解读与复杂产品配置器映射

### 1.1 Palantir 核心概念回顾

|| Palantir 概念 | 定义 | 文档中的定义位置 | 复杂产品配置器映射 |
|--------------|------|------------------|-------------------|
| **Object Type** | 对象的类型定义（实体/事件） | §2.1 | ProductClassType、PartClassType、SpecDefinition、PartClass、Part | 复杂产品领域的核心实体类型 |
| **Property Type** | 对象类型的属性定义（含基础类型、约束） | 在每个 ObjectType 的 `properties` 中 | SpecDefinition.spec_code、Part.price、PartClass.selection_policy | 规格、参数、数量边界等属性 |
| **Object Instance** | ObjectType 的具体实例 | §2.2 | SERVER_X86@1.0.0、cpu1、cpu2、S1110@1.0.0 | 具体的产品类、部件、可售型号 |
| **Link Type** | **连接两个 ObjectType 的关系类型定义（与 ObjectType 平级的一等公民）** | §1.1.1 | composedOf、offersPart、realizes、hasSpec | 部件组成关系、裁剪关系、实现关系、规格关联 |
| **Interface Type** | 多 ObjectType 可实现的共享 shape | 规划 | Configurable、HasPrice、HasSpec | 可配置性接口、价格能力接口 |
| **Backing Datasource** | ObjectType / LinkType 背后的物理数据源 | §4.2 | 数据库表、JSON 配置 | 部件主数据、规则引擎数据 |

### 1.1.1 LinkType 详解（复杂产品配置器扩展）

复杂产品配置器的 LinkType 设计：

|| # | LinkType Id | A-side | B-side | 一端类型 | 另一端类型 | A-side API | B-side API | Link Properties | 说明 |
|---|------------|--------|--------|---------|-----------|------------|------------|-----------------|---------|
| 1 | `COMPOSED_OF` | productClass | partClass | OT_PRODUCT_CLASS | OT_PART_CLASS | containedPartClasses | parentProductClass | selection_policy, min_cardinality, max_cardinality, multi_instance | 产品类包含部件分类 |
| 2 | `CANDIDATE_PART` | partClass | part | OT_PART_CLASS | OT_PART | availableParts | partClass | — | 部件分类下有候选部件 |
| 3 | `HAS_SPEC` | productClass/partClass | specDefinition | OT_PRODUCT_CLASS / OT_PART_CLASS | OT_SPEC_DEFINITION | specs | definedOn | scope: product_level / part_level | 定义固有规格 |
| 4 | `SPEC_VALUE` | productClass / part | specValue | OT_PRODUCT_CLASS / OT_PART | OT_SPEC_VALUE | specValues | ownedBy | — | 持有规格值 |
| 5 | `DEFINES_PARAMETER` | partClass | parameter | OT_PART_CLASS | OT_PARAMETER | parameters | definedOn | assign_type: INPUT/COMPUTED/SUMMARY | 定义可配置参数 |
| 6 | `REALIZES` | productInstance | productClass | OT_PRODUCT_INSTANCE | OT_PRODUCT_CLASS | realizedProduct | productClass | — | 产品实例实现产品类 |
| 7 | `OFFERS_PART` | productInstance | part | OT_PRODUCT_INSTANCE | OT_PART | offeredParts | offeredIn | enabled, disabled, defaultSelected, minQty, maxQty, fixed | 产品实例裁剪部件候选集 |
| 8 | `OVERRIDES_SPEC` | productInstance | specOverride | OT_PRODUCT_INSTANCE | OT_SPEC_OVERRIDE | specOverrides | overriddenBy | override_value, reason | 产品实例覆盖基线规格 |
| 9 | `SELECTS_PART` | configuration | configuredPart | OT_CONFIGURATION | OT_CONFIGURED_PART | selectedParts | configuration | quantity, selected, reason | 配置方案选择部件 |
| 10 | `HAS_CONFIGURED_VALUE` | configuration | configuredValue | OT_CONFIGURATION | OT_CONFIGURED_VALUE | configuredValues | owner | value, unit, source | 配置方案持有参数值 |

> **关键认知**：LinkType 在复杂产品配置器中承载了核心业务语义：
> - `COMPOSED_OF` 表达产品的递归组成结构
> - `OFFERS_PART` 表达可售型号的部件裁剪（enabled/disabled/minQty/maxQty/fixed）
> - `OVERRIDES_SPEC` 表达产品实例相对于基线的规格差异

### 1.2 复杂产品配置器语义两层模型架构

```
┌────────────────────────────────────────────────────────────────────────────────┐
│              Palantir 范式下的复杂产品配置器语义两层模型                          │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                第一层：元数据层 (Meta Layer)                               │ │
│  │  ──────────────────────────────────────────────────────────────────────  │ │
│  │                                                                           │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  A. 模板类型（复杂产品特有）                                          │  │ │
│  │  │     —— "元数据的元数据"，规定某类 ObjectType 应有哪些规格/参数        │  │ │
│  │  │                                                                    │  │ │
│  │  │    ┌────────────────────────┐      ┌────────────────────────┐     │  │ │
│  │  │    │ OT_PRODUCT_CLASS_TYPE   │      │ OT_PART_CLASS_TYPE      │     │  │ │
│  │  │    │ (产品类类型：定义       │ ───▶ │ (部件类类型：定义        │     │  │ │
│  │  │    │  产品实例的元数据)       │ 驱动 │  部件实例的元数据)       │     │  │ │
│  │  │    └────────────────────────┘      └────────────────────────┘     │  │ │
│  │  └────────┬───────────────────┬────────────────────┬─────────────────┘  │ │
│  │           │COMPOSED_OF         │HAS_SPEC             │DEFINES_PARAMETER   │ │
│  │           ▼                    ▼                     ▼                    │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  B. ObjectType 定义（Palantir 原生概念，对应"实例的数据结构"）        │  │ │
│  │  │     ——  与 LinkType 平级，均为一等公民，需被注册/版本化/权限控制      │  │ │
│  │  │                                                                    │  │ │
│  │  │    规格字典（全局平台级）     │    参数定义（全局平台级）              │  │ │
│  │  │    ┌─────────────────────┐ │      ┌─────────────────────┐         │  │ │
│  │  │    │  OT_SPEC_DEFINITION  │ │      │  OT_PARAMETER        │         │  │ │
│  │  │    │  规格定义             │ │      │  参数定义             │         │  │ │
│  │  │    │  §2.1.3              │ │      │  §2.1.4              │         │  │ │
│  │  │    └─────────────────────┘ │      └─────────────────────┘         │  │ │
│  │  │                                                                    │  │ │
│  │  │    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │  │ │
│  │  │    │OT_PRODUCT  │ │OT_PART_    │ │OT_PRODUCT_ │ │OT_SPEC_    │    │  │ │
│  │  │    │_CLASS      │ │CLASS       │ │INSTANCE    │ │OVERRIDE    │    │  │ │
│  │  │    │ 产品类      │ │ 部件分类    │ │ 可售产品实例 │ │ 规格覆盖    │    │  │ │
│  │  │    │ §2.1.5    │ │ §2.1.6    │ │ §2.1.7    │ │ §2.1.8    │    │  │ │
│  │  │    └────────────┘ └────────────┘ └────────────┘ └────────────┘    │  │ │
│  │  │                                                                    │  │ │
│  │  │    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │  │ │
│  │  │    │OT_PART     │ │OT_SPEC_    │ │OT_CONFIGUR │ │OT_CONFIGUR│    │  │ │
│  │  │    │ 部件        │ │VALUE       │ │ATION       │ │ED_PART    │    │  │ │
│  │  │    │ §2.1.9    │ │ 规格值      │ │ 配置方案    │ │ 已选部件   │    │  │ │
│  │  │    └────────────┘ └────────────┘ └────────────┘ └────────────┘    │  │ │
│  │  │                                                                    │  │ │
│  │  │  LinkType（与 ObjectType 平级，本方案共 10 个）                     │  │ │
│  │  │  COMPOSED_OF / CANDIDATE_PART / HAS_SPEC / SPEC_VALUE /           │  │ │
│  │  │  DEFINES_PARAMETER / REALIZES / OFFERS_PART / OVERRIDES_SPEC /    │  │ │
│  │  │  SELECTS_PART / HAS_CONFIGURED_VALUE                               │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                            │
│                                  │ 实例化（填入具体值）                       │
│                                  ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                第二层：Object Instance（Palantir 原生概念）                  │ │
│  │  ──────────────────────────────────────────────────────────────────────  │ │
│  │                                                                           │ │
│  │  ┌──────────────┐   COMPOSED_OF   ┌──────────────┐                      │ │
│  │  │ ProductClass │─────────────────▶│ PartClass    │  …… §2.2.1           │ │
│  │  │ SERVER_X86   │    (1:N)        │ cpu/drive    │                      │ │
│  │  │ @1.0.0       │                 │ §2.2.2       │                      │ │
│  │  └──────┬───────┘                 └──────┬───────┘                      │ │
│  │         │ CANDIDATE_PART                  │ HAS_SPEC / DEFINES_PARAMETER  │ │
│  │         ▼                                 ▼                              │ │
│  │  ┌──────────────┐                 ┌──────────────┐                      │ │
│  │  │ Part         │                 │ SpecDefinition / Parameter         │ │
│  │  │ cpu1/cpu2    │                 │ CoreNum/Memory/Sum_Capacity       │ │
│  │  │ §2.2.3       │                 │ §2.2.4                              │ │
│  │  └──────┬───────┘                 └──────────────┘                      │ │
│  │         │ SPEC_VALUE                        │                              │ │
│  │         ▼                                  │                              │ │
│  │  ┌──────────────┐                          │                              │ │
│  │  │ SpecValue    │◀─────────────────────────┘                              │ │
│  │  │ CoreNum=2    │                          │                              │ │
│  │  │ Memory=123   │                          │                              │ │
│  │  └──────────────┘                          │                              │ │
│  │                                             │                              │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                        ProductInstance 层                             │ │ │
│  │  │                                                                     │ │ │
│  │  │  ┌──────────────┐   REALIZES   ┌──────────────┐                    │ │ │
│  │  │  │ProductInstance│──────────────▶│ ProductClass │                    │ │ │
│  │  │  │ S1110/S22    │              │ SERVER_X86   │                    │ │ │
│  │  │  │ @1.0.0       │              │ @1.0.0       │                    │ │ │
│  │  │  └──────┬───────┘              └──────────────┘                    │ │ │
│  │  │         │ OFFERS_PART (N:M, linkProps 裁剪)                         │ │ │
│  │  │         ▼                                                            │ │ │
│  │  │  ┌──────────────┐                                                   │ │ │
│  │  │  │ Part         │ ← S1110 禁用 cpu3/cpu4，启用 cpu1/cpu2              │ │ │
│  │  │  │ (裁剪后)     │                                                   │ │ │
│  │  │  └──────────────┘                                                   │ │ │
│  │  │                                                                     │ │ │
│  │  │  ┌────────────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ ProductInstance ──OVERRIDES_SPEC──▶ SpecOverride              │ │ │ │
│  │  │  │ S22 强制 FormFactor=4U（覆盖基线 2U）                          │ │ │ │
│  │  │  └────────────────────────────────────────────────────────────────┘ │ │ │
│  │  └────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                        Configuration 层                             │ │ │
│  │  │                                                                     │ │ │
│  │  │  ┌──────────────┐   SELECTS_PART   ┌──────────────┐              │ │ │
│  │  │  │Configuration │──────────────────▶│ ConfiguredPart│              │ │ │
│  │  │  │ 客户配置      │                  │ 已选部件      │              │ │ │
│  │  │  └──────┬───────┘                  └──────────────┘              │ │ │
│  │  │         │ HAS_CONFIGURED_VALUE                                   │ │ │
│  │  │         ▼                                                        │ │ │
│  │  │  ┌──────────────┐                                                │ │ │
│  │  │  │ConfiguredValue│                                               │ │ │
│  │  │  │ Sum_Capacity │                                                │ │ │
│  │  │  │ = 5 TB       │                                                │ │ │
│  │  │  └──────────────┘                                                │ │ │
│  │  └────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**说明**：
- 第一层 A（模板类型）→ 第一层 B（ObjectType）：是「驱动关系」，类型定义规定实例应包含哪些属性
- 第一层 B → 第二层：是「实例化关系」，ObjectType 定义是 schema，实例是 schema 的一行
- LinkType 跨越第一层与第二层：LinkType 的两端是 ObjectType，LinkType 的实例是 Object Instance 之间的边
- 复杂产品配置器的特殊之处：`OFFERS_PART` LinkType 的 linkProperties 承载了部件裁剪语义（enabled/disabled/defaultSelected/minQty/maxQty/fixed）

---

## 二、数据与映射构建方案

### 2.1 第一层元数据的建模

> **本节说明**：第一层包含复杂产品配置器的类型定义：
> - **ProductClassType**（产品类类型）：定义产品族的元数据
> - **PartClassType**（部件类类型）：定义可配置子模块的类型
> - **SpecDefinition**（规格定义）：产品的物理特性或性能指标定义
> - **Parameter**（参数）：可由用户输入/修改的配置需求定义
> - **ProductInstanceType**（可售产品实例类型）：可售产品定义

#### 2.1.1 产品类类型定义 (OT_PRODUCT_CLASS_TYPE)

```json
{
  "object_type": "ProductClassType",
  "type_id": "OT_PRODUCT_CLASS_TYPE",
  "description": "产品类类型，产品族或产品平台类型的定义。承载平台化和标准化。",
  "properties": {
    "type_code": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "类型唯一标识，如 SERVER_X86"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "类型名称，如 X86服务器平台"
    },
    "domain": {
      "type": "STRING",
      "description": "领域，如 IT硬件、工业设备、PLC"
    },
    "modeling_policy": {
      "type": "ENUM",
      "values": ["PLATFORM_STANDARDIZATION", "BRAND_LINE", "CUSTOMIZATION"],
      "description": "建模策略：平台标准化 / 品牌线 / 定制化"
    },
    "description": {
      "type": "TEXT",
      "description": "类型描述"
    }
  }
}
```

> **设计要点**：ProductClassType 定义"服务器类产品类"这一类型元数据（code、domain、modeling_policy），是类型的模板，不含版本。类比：ProductClassType 是"人类的基因定义"。

#### 2.1.2 部件类类型定义 (OT_PART_CLASS_TYPE)

```json
{
  "object_type": "PartClassType",
  "type_id": "OT_PART_CLASS_TYPE",
  "description": "部件类类型，可配置子模块的抽象，如 CPU、硬盘、显示器。",
  "properties": {
    "type_code": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "类型唯一标识，如 cpu、drive、memory"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "类型名称，如 CPU、硬盘、内存"
    },
    "part_kind": {
      "type": "ENUM",
      "values": ["COMPONENT", "STORAGE", "SERVICE", "ACCESSORY"],
      "description": "部件种类：组件 / 存储 / 服务 / 配件"
    },
    "selection_policy": {
      "type": "ENUM",
      "values": ["REQUIRED", "OPTIONAL"],
      "description": "选择策略：REQUIRED（必选）/ OPTIONAL（可选）"
    },
    "min_cardinality": {
      "type": "INTEGER",
      "default": 0,
      "description": "最小数量"
    },
    "max_cardinality": {
      "type": "INTEGER",
      "description": "最大数量"
    },
    "multi_instance": {
      "type": "BOOLEAN",
      "default": false,
      "description": "是否支持多实例"
    }
  }
}
```

#### 2.1.3 规格定义类型 (OT_SPEC_DEFINITION)

```json
{
  "object_type": "SpecDefinitionType",
  "type_id": "OT_SPEC_DEFINITION",
  "description": "规格定义，产品的物理特性或性能指标定义。定义在 ProductClass 或 PartClass 上。",
  "properties": {
    "spec_code": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "规格唯一标识，如 FormFactor、CoreNum、Capacity"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "规格名称，如 外形规格、核心数、容量"
    },
    "defined_on": {
      "type": "STRING",
      "references": "OT_PRODUCT_CLASS_TYPE / OT_PART_CLASS_TYPE",
      "description": "定义在哪个类型上（产品类或部件类）"
    },
    "data_type": {
      "type": "ENUM",
      "values": ["STRING", "INTEGER", "DECIMAL", "BOOLEAN", "ENUM"],
      "is_required": true
    },
    "unit": {
      "type": "STRING",
      "description": "单位，如 U、core、GB、TB、rpm"
    },
    "value_domain": {
      "type": "ARRAY[STRING]",
      "description": "值域，如 ['1U','2U','4U']、['2','4','8','18']"
    },
    "required": {
      "type": "BOOLEAN",
      "default": true,
      "description": "是否为必填规格"
    }
  }
}
```

> **与电商方案的区别**：复杂产品配置器的 SpecDefinition 直接定义在 ProductClassType 或 PartClassType 上，不通过 Template 中转。规格是"产品或部件本身已有的物理特性"，不可由用户修改。

#### 2.1.4 参数定义类型 (OT_PARAMETER)

```json
{
  "object_type": "ParameterType",
  "type_id": "OT_PARAMETER",
  "description": "参数定义，可由用户输入/修改的配置需求定义。定义在 PartClassType 上。",
  "properties": {
    "param_code": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "参数唯一标识，如 Sum_Capacity、Sum_Memory、Quantity"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "参数名称，如 硬盘总容量需求、CPU总内存需求"
    },
    "defined_on": {
      "type": "STRING",
      "references": "OT_PART_CLASS_TYPE",
      "description": "定义在哪个部件类类型上"
    },
    "data_type": {
      "type": "ENUM",
      "values": ["STRING", "INTEGER", "DECIMAL", "BOOLEAN"],
      "is_required": true
    },
    "unit": {
      "type": "STRING",
      "description": "单位，如 TB、GB、块"
    },
    "assign_type": {
      "type": "ENUM",
      "values": ["INPUT", "COMPUTED", "SUMMARY"],
      "description": "赋值类型：INPUT（用户输入）/ COMPUTED（计算得出）/ SUMMARY（汇总）"
    },
    "min_value": {
      "type": "DECIMAL",
      "description": "最小值"
    },
    "max_value": {
      "type": "DECIMAL",
      "description": "最大值"
    },
    "default_value": {
      "type": "DECIMAL",
      "description": "默认值"
    },
    "description": {
      "type": "TEXT",
      "description": "参数描述，如 客户要求的硬盘总容量下限"
    }
  }
}
```

> **规格与参数的核心区别**：
> - **规格（SpecDefinition）**：产品或部件本身已有的物理特性或性能指标，不可由用户修改。Part 有对应的 SpecValue。
> - **参数（Parameter）**：可由用户输入的配置需求，Part 无对应 Parameter 值，参数值在配置阶段由用户输入。

#### 2.1.5 产品类定义 (OT_PRODUCT_CLASS)

```json
{
  "object_type": "ProductClassType",
  "type_id": "OT_PRODUCT_CLASS",
  "description": "产品类，产品族或平台的可复用骨架（本身带版本，可发布多次）。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "产品类唯一标识"
    },
    "code": {
      "type": "STRING",
      "is_required": true,
      "description": "产品类编码，如 SERVER_X86"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "产品类名称，如 X86服务器平台"
    },
    "version": {
      "type": "STRING",
      "is_required": true,
      "description": "版本号，如 1.0.0"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "PUBLISHED", "DEPRECATED"],
      "default": "DRAFT",
      "description": "状态"
    },
    "effective_from": {
      "type": "TIMESTAMP",
      "description": "生效时间"
    },
    "effective_to": {
      "type": "TIMESTAMP",
      "description": "失效时间"
    }
  },
  "generated_links": {
    "COMPOSED_OF": {
      "link_id": "COMPOSED_OF",
      "target": "OT_PART_CLASS",
      "cardinality": "ONE_TO_MANY",
      "description": "产品类包含部件分类"
    },
    "SPEC_VALUE": {
      "link_id": "SPEC_VALUE",
      "target": "OT_SPEC_VALUE",
      "cardinality": "ONE_TO_MANY",
      "description": "产品类持有规格值（产品层规格如 FormFactor、PowerSupply）"
    }
  }
}
```

#### 2.1.6 部件分类定义 (OT_PART_CLASS)

```json
{
  "object_type": "PartClassType",
  "type_id": "OT_PART_CLASS",
  "description": "部件分类，可配置子模块的分类边界。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "code": {
      "type": "STRING",
      "is_required": true,
      "description": "部件分类编码，如 cpu、drive、memory"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "部件分类名称，如 CPU、硬盘、内存"
    },
    "product_class_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_PRODUCT_CLASS",
      "description": "所属产品类"
    },
    "selection_policy": {
      "type": "ENUM",
      "values": ["REQUIRED", "OPTIONAL"],
      "description": "选择策略"
    },
    "min_qty": {
      "type": "INTEGER",
      "default": 0,
      "description": "最小数量"
    },
    "max_qty": {
      "type": "INTEGER",
      "description": "最大数量"
    },
    "multi_instance": {
      "type": "BOOLEAN",
      "default": false,
      "description": "是否支持多实例"
    }
  },
  "generated_links": {
    "CANDIDATE_PART": {
      "link_id": "CANDIDATE_PART",
      "target": "OT_PART",
      "cardinality": "ONE_TO_MANY",
      "description": "部件分类下有候选部件"
    },
    "HAS_SPEC": {
      "link_id": "HAS_SPEC",
      "target": "OT_SPEC_DEFINITION",
      "cardinality": "ONE_TO_MANY",
      "description": "部件分类有规格定义"
    },
    "DEFINES_PARAMETER": {
      "link_id": "DEFINES_PARAMETER",
      "target": "OT_PARAMETER",
      "cardinality": "ONE_TO_MANY",
      "description": "部件分类定义参数"
    }
  }
}
```

#### 2.1.7 可售产品实例定义 (OT_PRODUCT_INSTANCE)

```json
{
  "object_type": "ProductInstanceType",
  "type_id": "OT_PRODUCT_INSTANCE",
  "description": "可售产品实例，确定销售边界的可售产品（对标电商 SPU，本身带版本）。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "code": {
      "type": "STRING",
      "is_required": true,
      "description": "产品实例编码，如 S1110、S22"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "产品实例名称，如 X86服务器S1110低端型"
    },
    "version": {
      "type": "STRING",
      "is_required": true,
      "description": "版本号，如 1.0.0"
    },
    "market": {
      "type": "STRING",
      "description": "市场，如 CN、Global"
    },
    "positioning": {
      "type": "STRING",
      "description": "市场定位，如 低端通用场景、高端计算存储"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "PUBLISHED", "DEPRECATED"],
      "default": "DRAFT"
    },
    "effective_from": {
      "type": "TIMESTAMP"
    },
    "effective_to": {
      "type": "TIMESTAMP"
    }
  },
  "generated_links": {
    "REALIZES": {
      "link_id": "REALIZES",
      "target": "OT_PRODUCT_CLASS",
      "cardinality": "MANY_TO_ONE",
      "description": "产品实例实现产品类"
    },
    "OFFERS_PART": {
      "link_id": "OFFERS_PART",
      "target": "OT_PART",
      "cardinality": "MANY_TO_MANY",
      "description": "产品实例裁剪部件候选集（linkProperties 承载 enabled/disabled/minQty/maxQty/fixed）"
    },
    "OVERRIDES_SPEC": {
      "link_id": "OVERRIDES_SPEC",
      "target": "OT_SPEC_OVERRIDE",
      "cardinality": "ONE_TO_MANY",
      "description": "产品实例覆盖基线规格"
    }
  }
}
```

> **OFFERS_PART LinkType 的 linkProperties 设计**：
> ```json
> {
>   "linkType": "OFFERS_PART",
>   "from": "OT_PRODUCT_INSTANCE/S1110",
>   "to": "OT_PART/cpu1",
>   "linkProperties": {
>     "enabled": true,
>     "defaultSelected": true,
>     "minQty": 1,
>     "maxQty": 1,
>     "fixed": false
>   }
> }
> ```

#### 2.1.8 规格覆盖定义 (OT_SPEC_OVERRIDE)

```json
{
  "object_type": "SpecOverrideType",
  "type_id": "OT_SPEC_OVERRIDE",
  "description": "规格覆盖，产品实例相对于基线的规格差异。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "product_instance_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_PRODUCT_INSTANCE",
      "description": "所属产品实例"
    },
    "spec_code": {
      "type": "STRING",
      "description": "规格编码，如 FormFactor"
    },
    "override_value": {
      "type": "STRING",
      "description": "覆盖值，如 4U"
    },
    "reason": {
      "type": "TEXT",
      "description": "覆盖原因"
    }
  }
}
```

#### 2.1.9 部件定义 (OT_PART)

```json
{
  "object_type": "PartType",
  "type_id": "OT_PART",
  "description": "部件，PartClass 的具体实例，如一个明确编码的 CPU 或硬盘。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "code": {
      "type": "STRING",
      "is_required": true,
      "description": "部件编码，如 cpu1、sd1、md1"
    },
    "name": {
      "type": "STRING",
      "is_required": true,
      "description": "部件名称"
    },
    "part_class_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_PART_CLASS",
      "description": "所属部件分类"
    },
    "status": {
      "type": "ENUM",
      "values": ["ACTIVE", "INACTIVE", "DEPRECATED"],
      "default": "ACTIVE"
    },
    "price": {
      "type": "DECIMAL",
      "description": "基础价格（简化设计，完整定价应引用独立定价域）"
    }
  },
  "generated_links": {
    "SPEC_VALUE": {
      "link_id": "SPEC_VALUE",
      "target": "OT_SPEC_VALUE",
      "cardinality": "ONE_TO_MANY",
      "description": "部件持有规格值（继承自 PartClass 的规格定义）"
    }
  }
}
```

#### 2.1.10 规格值定义 (OT_SPEC_VALUE)

```json
{
  "object_type": "SpecValueType",
  "type_id": "OT_SPEC_VALUE",
  "description": "规格值，产品或部件的具体规格属性值。挂在 ProductClass 或 Part 上。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "owner_type": {
      "type": "ENUM",
      "values": ["PRODUCT_CLASS", "PART"],
      "description": "持有者类型"
    },
    "owner_id": {
      "type": "STRING",
      "description": "持有者ID"
    },
    "spec_code": {
      "type": "STRING",
      "description": "规格编码，与 SpecDefinition.spec_code 对应"
    },
    "value": {
      "type": "STRING",
      "description": "规格值，如 2U、2 core、3 TB"
    },
    "unit": {
      "type": "STRING",
      "description": "单位"
    }
  }
}
```

#### 2.1.11 配置方案定义 (OT_CONFIGURATION)

```json
{
  "object_type": "ConfigurationType",
  "type_id": "OT_CONFIGURATION",
  "description": "配置方案，一次客户配置方案。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "product_instance_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_PRODUCT_INSTANCE",
      "description": "选择的可售产品"
    },
    "model_snapshot": {
      "type": "STRING",
      "description": "模型快照，用于历史报价复现，如 SERVER_X86:1.0.0 / S1110:1.0.0"
    },
    "status": {
      "type": "ENUM",
      "values": ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      "default": "IN_PROGRESS"
    },
    "customer_context": {
      "type": "JSON",
      "description": "客户上下文"
    }
  },
  "generated_links": {
    "SELECTS_PART": {
      "link_id": "SELECTS_PART",
      "target": "OT_CONFIGURED_PART",
      "cardinality": "ONE_TO_MANY",
      "description": "配置方案选择部件"
    },
    "HAS_CONFIGURED_VALUE": {
      "link_id": "HAS_CONFIGURED_VALUE",
      "target": "OT_CONFIGURED_VALUE",
      "cardinality": "ONE_TO_MANY",
      "description": "配置方案持有参数值"
    }
  }
}
```

#### 2.1.12 已选部件定义 (OT_CONFIGURED_PART)

```json
{
  "object_type": "ConfiguredPartType",
  "type_id": "OT_CONFIGURED_PART",
  "description": "已选部件，配置方案中被选中的部件及其数量。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "configuration_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_CONFIGURATION",
      "description": "所属配置方案"
    },
    "part_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_PART",
      "description": "选中的部件"
    },
    "instance_no": {
      "type": "INTEGER",
      "description": "实例号"
    },
    "quantity": {
      "type": "INTEGER",
      "description": "数量"
    },
    "selected": {
      "type": "BOOLEAN",
      "description": "是否被选中"
    },
    "reason": {
      "type": "TEXT",
      "description": "选中/排除原因"
    }
  }
}
```

#### 2.1.13 已选参数值定义 (OT_CONFIGURED_VALUE)

```json
{
  "object_type": "ConfiguredValueType",
  "type_id": "OT_CONFIGURED_VALUE",
  "description": "已选参数值，配置阶段用户输入的参数值。",
  "properties": {
    "id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "configuration_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_CONFIGURATION",
      "description": "所属配置方案"
    },
    "parameter_code": {
      "type": "STRING",
      "description": "参数编码，如 Sum_Capacity、Sum_Memory"
    },
    "part_class": {
      "type": "STRING",
      "description": "部件分类，如 drive、cpu"
    },
    "value": {
      "type": "STRING",
      "description": "参数值，如 5、512"
    },
    "filter": {
      "type": "STRING",
      "description": "筛选条件，如 Speed=5400、CoreNum=4"
    },
    "source": {
      "type": "ENUM",
      "values": ["USER_INPUT", "DEFAULT", "COMPUTED"],
      "description": "值来源"
    }
  }
}
```

### 2.2 第二层实例数据的建模

#### 2.2.1 产品类实例 (ProductClass Instance)

```json
{
  "object_instance": "ProductClass Instance",
  "instance_id": "PC-SERVER_X86-1.0.0",
  "type_id": "OT_PRODUCT_CLASS",
  "type_definition_ref": "§2.1.5",
  "properties": {
    "id": "PC-SERVER_X86-1.0.0",
    "code": "SERVER_X86",
    "name": "X86服务器平台",
    "version": "1.0.0",
    "status": "PUBLISHED",
    "effective_from": "2026-07-01T00:00:00Z"
  },
  "_links": {
    "SPEC_VALUE": [
      { "target": "SV-FORMFACTOR", "spec_code": "FormFactor", "value": "2U" },
      { "target": "SV-POWERSUPPLY", "spec_code": "PowerSupply", "value": "DUAL" }
    ],
    "COMPOSED_OF": [
      { "target": "PCL-cpu", "selection_policy": "REQUIRED", "min_qty": 1, "max_qty": 2 },
      { "target": "PCL-drive", "selection_policy": "OPTIONAL", "min_qty": 0, "max_qty": 8, "multi_instance": true },
      { "target": "PCL-memory", "selection_policy": "REQUIRED", "min_qty": 1, "max_qty": 16, "multi_instance": true }
    ]
  }
}
```

#### 2.2.2 部件分类实例 (PartClass Instance)

```json
{
  "object_instance": "PartClass Instance",
  "instance_id": "PCL-cpu",
  "type_id": "OT_PART_CLASS",
  "type_definition_ref": "§2.1.6",
  "properties": {
    "id": "PCL-cpu",
    "code": "cpu",
    "name": "CPU",
    "product_class_id": "PC-SERVER_X86-1.0.0",
    "selection_policy": "REQUIRED",
    "min_qty": 1,
    "max_qty": 2,
    "multi_instance": false
  },
  "_links": {
    "HAS_SPEC": [
      { "target": "SD-CoreNum", "spec_code": "CoreNum", "data_type": "INTEGER", "unit": "core" },
      { "target": "SD-Memory", "spec_code": "Memory", "data_type": "INTEGER", "unit": "GB" },
      { "target": "SD-ConfigType", "spec_code": "ConfigType", "data_type": "INTEGER", "unit": "配置" }
    ],
    "DEFINES_PARAMETER": [
      { "target": "P-Sum_Memory", "param_code": "Sum_Memory", "data_type": "INTEGER", "unit": "GB" }
    ],
    "CANDIDATE_PART": [
      { "target": "P-cpu1" },
      { "target": "P-cpu2" },
      { "target": "P-cpu3" },
      { "target": "P-cpu4" }
    ]
  }
}
```

#### 2.2.3 部件实例 (Part Instance)

```json
{
  "object_instance": "Part Instance",
  "instance_id": "P-cpu2",
  "type_id": "OT_PART",
  "type_definition_ref": "§2.1.9",
  "properties": {
    "id": "P-cpu2",
    "code": "cpu2",
    "name": "CPU 4核 256GB",
    "part_class_id": "PCL-cpu",
    "status": "ACTIVE",
    "price": 200
  },
  "_links": {
    "SPEC_VALUE": [
      { "spec_code": "CoreNum", "value": "4", "unit": "core" },
      { "spec_code": "Memory", "value": "256", "unit": "GB" },
      { "spec_code": "ConfigType", "value": "2" }
    ]
  }
}
```

#### 2.2.4 规格与参数实例

**规格定义实例 (SpecDefinition Instance)**：

```json
{
  "object_instance": "SpecDefinition Instance",
  "instance_id": "SD-CoreNum",
  "type_id": "OT_SPEC_DEFINITION",
  "properties": {
    "spec_code": "CoreNum",
    "name": "核心数",
    "defined_on": "OT_PART_CLASS_TYPE/cpu",
    "data_type": "INTEGER",
    "unit": "core",
    "value_domain": ["2", "4", "8", "18"],
    "required": true
  }
}
```

**参数定义实例 (Parameter Instance)**：

```json
{
  "object_instance": "Parameter Instance",
  "instance_id": "P-Sum_Capacity",
  "type_id": "OT_PARAMETER",
  "properties": {
    "param_code": "Sum_Capacity",
    "name": "硬盘总容量需求",
    "defined_on": "OT_PART_CLASS_TYPE/drive",
    "data_type": "INTEGER",
    "unit": "TB",
    "assign_type": "INPUT",
    "description": "客户要求的硬盘总容量下限（可筛选转速）"
  }
}
```

#### 2.2.5 可售产品实例 (ProductInstance Instance)

**S1110 低端服务器**：

```json
{
  "object_instance": "ProductInstance Instance",
  "instance_id": "PI-S1110-1.0.0",
  "type_id": "OT_PRODUCT_INSTANCE",
  "type_definition_ref": "§2.1.7",
  "properties": {
    "id": "PI-S1110-1.0.0",
    "code": "S1110",
    "name": "X86服务器S1110低端型",
    "version": "1.0.0",
    "market": "CN",
    "positioning": "低端通用场景",
    "status": "PUBLISHED"
  },
  "_links": {
    "REALIZES": [
      { "target": "PC-SERVER_X86-1.0.0" }
    ],
    "OFFERS_PART": [
      { "target": "P-cpu1", "enabled": true, "defaultSelected": true, "minQty": 1, "maxQty": 1, "fixed": false },
      { "target": "P-cpu2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-cpu3", "enabled": false },
      { "target": "P-cpu4", "enabled": false },
      { "target": "P-sd1", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-sd2", "enabled": false },
      { "target": "P-sd3", "enabled": false },
      { "target": "P-md1", "enabled": true, "defaultSelected": true, "minQty": 1, "maxQty": 8, "fixed": false },
      { "target": "P-md2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 8, "fixed": false },
      { "target": "P-md3", "enabled": false }
    ]
  }
}
```

**S22 高端服务器**：

```json
{
  "object_instance": "ProductInstance Instance",
  "instance_id": "PI-S22-1.0.0",
  "type_id": "OT_PRODUCT_INSTANCE",
  "type_definition_ref": "§2.1.7",
  "properties": {
    "id": "PI-S22-1.0.0",
    "code": "S22",
    "name": "X86服务器S22高端型",
    "version": "1.0.0",
    "market": "CN/Global",
    "positioning": "高端计算与存储",
    "status": "PUBLISHED"
  },
  "_links": {
    "REALIZES": [
      { "target": "PC-SERVER_X86-1.0.0" }
    ],
    "OFFERS_PART": [
      { "target": "P-cpu1", "enabled": false },
      { "target": "P-cpu2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-cpu3", "enabled": true, "defaultSelected": true, "minQty": 1, "maxQty": 1, "fixed": false },
      { "target": "P-cpu4", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-sd1", "enabled": false },
      { "target": "P-sd2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-sd3", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2, "fixed": false },
      { "target": "P-md1", "enabled": false },
      { "target": "P-md2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 8, "fixed": false },
      { "target": "P-md3", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 8, "fixed": false }
    ],
    "OVERRIDES_SPEC": [
      { "target": "SO-S22-FormFactor", "spec_code": "FormFactor", "override_value": "4U", "reason": "高端型号强制4U外形" }
    ]
  }
}
```

#### 2.2.6 配置方案实例 (Configuration Instance)

**客户需求配置**：

```json
{
  "object_instance": "Configuration Instance",
  "instance_id": "CFG-20260727-0001",
  "type_id": "OT_CONFIGURATION",
  "type_definition_ref": "§2.1.11",
  "properties": {
    "id": "CFG-20260727-0001",
    "product_instance_id": "PI-S1110-1.0.0",
    "model_snapshot": "SERVER_X86:1.0.0 / S1110:1.0.0",
    "status": "COMPLETED",
    "customer_context": { "customer_id": "CUST-001", "region": "CN" }
  },
  "_links": {
    "HAS_CONFIGURED_VALUE": [
      {
        "target": "CV-001",
        "parameter_code": "Sum_Capacity",
        "part_class": "drive",
        "value": "5",
        "filter": "Speed=5400",
        "source": "USER_INPUT"
      },
      {
        "target": "CV-002",
        "parameter_code": "Sum_Memory",
        "part_class": "cpu",
        "value": "512",
        "filter": "CoreNum=4",
        "source": "USER_INPUT"
      }
    ],
    "SELECTS_PART": [
      {
        "target": "CP-001",
        "part_id": "P-cpu2",
        "quantity": 2,
        "selected": true,
        "reason": "满足4核CPU内存>=512G需求"
      },
      {
        "target": "CP-002",
        "part_id": "P-md1",
        "quantity": 5,
        "selected": true,
        "reason": "5400rpm机械硬盘，满足5T容量需求"
      },
      {
        "target": "CP-003",
        "part_id": "P-sd1",
        "quantity": 0,
        "selected": false,
        "reason": "被4核CPU不兼容固态硬盘规则排除"
      }
    ]
  }
}
```

### 2.3 映射关系构建

#### 2.3.1 元数据到实例的映射表

|| 映射关系 | 源 | 目标 | 映射类型 | 说明 |
|---------|-----|------|---------|------|
| ProductClassType → ProductClass | 产品类类型 | 产品类实例 | 1:N | 类型定义驱动实例创建 |
| PartClassType → PartClass | 部件类类型 | 部件分类实例 | 1:N | 类型定义驱动实例创建 |
| ProductClass → PartClass | 产品类实例 | 部件分类实例 | 1:N | COMPOSED_OF link |
| PartClass → Part | 部件分类实例 | 部件实例 | 1:N | CANDIDATE_PART link |
| PartClass → SpecDefinition | 部件分类实例 | 规格定义实例 | 1:N | HAS_SPEC link |
| Part → SpecValue | 部件实例 | 规格值实例 | 1:N | SPEC_VALUE link |
| PartClass → Parameter | 部件分类实例 | 参数定义实例 | 1:N | DEFINES_PARAMETER link |
| ProductInstance → ProductClass | 产品实例 | 产品类 | N:1 | REALIZES link |
| ProductInstance → Part | 产品实例 | 部件 | M:N | OFFERS_PART link（含裁剪属性） |
| ProductInstance → SpecOverride | 产品实例 | 规格覆盖 | 1:N | OVERRIDES_SPEC link |
| Configuration → ConfiguredPart | 配置方案 | 已选部件 | 1:N | SELECTS_PART link |
| Configuration → ConfiguredValue | 配置方案 | 已选参数值 | 1:N | HAS_CONFIGURED_VALUE link |

#### 2.3.2 继承关系映射

复杂产品配置器的继承关系体现在版本管理上：

```
ProductClassType (SERVER_X86)          ← 元数据层：类型定义
        │
        │ instantiate (创建实例)
        ▼
ProductClass (SERVER_X86 @1.0.0)       ← 实例层：已发布版本
        │
        │ realize (产品实例化)
        ▼
ProductInstance (S1110 @1.0.0)         ← 实例层：可售产品
        │
        │ 配置 (用户输入参数)
        ▼
Configuration (CFG-20260727-0001)      ← 运行时层：配置方案
```

**三层概念架构的 Palantir 映射**：

| 业务层 | Palantir 层 | 核心对象 |
|-------|------------|---------|
| **L1 业务元模型** | Meta Layer (第一层) | ProductClassType、PartClassType、SpecDefinition、Parameter |
| **L2 业务对象实例** | Instance Layer (第二层) | ProductClass（含 version）、PartClass、Part（含 SpecValue）、ProductInstance（含 offersPart 裁剪） |
| **L3 配置运行实例** | Runtime Layer | Configuration、ConfiguredPart、ConfiguredValue |

---

## 三、角色协同设计

### 3.1 角色模型与职责划分

|| 角色 | Palantir 对应 | 职责范围 | 操作权限 |
|------|--------------|---------|---------|
| **平台架构师** | Platform Architect | 定义 ProductClassType、PartClassType、SpecDefinition 全局字典 | 全局写 |
| **产品数据架构师** | Domain Architect | 创建和管理 ProductClass（含版本）、PartClass、Part、SpecValue | 产品域写 |
| **产品数据工程师** | Product Data Engineer | 创建 ProductInstance、通过 offersPart 裁剪部件候选集 | 产品实例写 |
| **销售/客户** | Business User | 选择 ProductInstance、输入 Parameter 值、执行配置 | 配置写 |
| **Agent 系统** | Automated Agent | 数据聚合、规则推理、配置求解 | 场景化权限 |

### 3.2 基于角色的数据视图设计

#### 3.2.1 平台架构师视角

```json
{
  "role": "PLATFORM_ARCHITECT",
  "data_view": {
    "visible_layers": ["META"],
    "visible_object_types": ["OT_PRODUCT_CLASS_TYPE", "OT_PART_CLASS_TYPE", "OT_SPEC_DEFINITION", "OT_PARAMETER"],
    "can_modify": {
      "product_class_types": true,
      "part_class_types": true,
      "spec_definitions": true,
      "parameters": true
    }
  },
  "workspace": {
    "tasks": [
      "定义新的产品类类型（如工业设备、PLC）",
      "维护规格定义全局字典",
      "维护参数定义全局字典",
      "制定建模策略（平台标准化/品牌线/定制化）"
    ]
  }
}
```

#### 3.2.2 产品数据架构师视角

```json
{
  "role": "PRODUCT_DATA_ARCHITECT",
  "data_view": {
    "visible_layers": ["META", "INSTANCE"],
    "visible_object_types": ["OT_PRODUCT_CLASS", "OT_PART_CLASS", "OT_PART", "OT_SPEC_VALUE"],
    "accessible_domains": ["IT硬件"],
    "can_modify": {
      "product_classes": true,
      "part_classes": true,
      "parts": true,
      "spec_values": true
    }
  },
  "workspace": {
    "focused_product_classes": ["SERVER_X86"],
    "tasks": [
      "创建产品类版本（SERVER_X86 @1.0.0）",
      "定义部件分类及数量边界",
      "录入部件及规格值",
      "发布产品类"
    ]
  }
}
```

#### 3.2.3 产品数据工程师视角

```json
{
  "role": "PRODUCT_DATA_ENGINEER",
  "data_view": {
    "visible_layers": ["INSTANCE"],
    "visible_object_types": ["OT_PRODUCT_INSTANCE", "OT_PART", "OT_SPEC_OVERRIDE"],
    "accessible_product_classes": ["SERVER_X86"],
    "can_modify": {
      "product_instances": true,
      "offers_part_links": true,
      "spec_overrides": true
    }
  },
  "workspace": {
    "focused_instances": ["S1110", "S22"],
    "tasks": [
      "创建可售产品实例（S1110、S22）",
      "配置 offersPart 裁剪（启用/禁用部件）",
      "配置 specOverrides（高端型号强制4U）",
      "发布产品实例"
    ]
  }
}
```

#### 3.2.4 销售/客户视角

```json
{
  "role": "SALES_CUSTOMER",
  "data_view": {
    "visible_layers": ["INSTANCE"],
    "visible_object_types": ["OT_PRODUCT_INSTANCE", "OT_CONFIGURATION"],
    "accessible_product_instances": ["S1110", "S22"],
    "can_modify": {
      "configurations": true,
      "configured_values": true
    }
  },
  "workspace": {
    "tasks": [
      "选择可售产品（S1110 低端服务器）",
      "输入配置参数（5400rpm 硬盘总容量 >= 5TB）",
      "查看配置结果（BOM、报价、交付规格）",
      "确认或调整配置"
    ]
  }
}
```

### 3.3 角色协同流程

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                      复杂产品配置角色协同流程                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  【阶段一：产品类设计】                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  责任人：产品数据架构师                                                    │ │
│  │                                                                          │ │
│  │  1. 创建 ProductClass (SERVER_X86 @1.0.0)                               │ │
│  │     ↓                                                                    │ │
│  │  2. 定义 PartClass (cpu/drive/memory)                                   │ │
│  │     ↓                                                                    │ │
│  │  3. 定义 SpecDefinition (CoreNum/Memory/Speed/Capacity)                  │ │
│  │     ↓                                                                    │ │
│  │  4. 定义 Parameter (Sum_Capacity/Sum_Memory)                             │ │
│  │     ↓                                                                    │ │
│  │  5. 录入 Part 及 SpecValue (cpu1~cpu4, sd1~sd3, md1~md3)                │ │
│  │     ↓                                                                    │ │
│  │  6. 发布 ProductClass                                                    │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                            │
│                                    ▼                                            │
│  【阶段二：产品实例化】                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  责任人：产品数据工程师                                                   │ │
│  │                                                                          │ │
│  │  1. 创建 ProductInstance (S1110 @1.0.0 / S22 @1.0.0)                     │ │
│  │     ↓                                                                    │ │
│  │  2. 配置 offersPart 裁剪                                                 │ │
│  │     - S1110 禁用 cpu3/cpu4/sd2/sd3/md3                                  │ │
│  │     - S22 禁用 cpu1/sd1/md1                                             │ │
│  │     ↓                                                                    │ │
│  │  3. 配置 SpecOverride (S22 强制 FormFactor=4U)                           │ │
│  │     ↓                                                                    │ │
│  │  4. 发布 ProductInstance                                                 │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                            │
│                                    ▼                                            │
│  【阶段三：客户配置】                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  责任人：销售/客户                                                        │ │
│  │                                                                          │ │
│  │  1. 选择 ProductInstance (S1110)                                         │ │
│  │     ↓                                                                    │ │
│  │  2. 输入 Parameter 值                                                    │ │
│  │     - drive.Sum_Capacity >= 5 where Speed=5400                          │ │
│  │     - cpu.Sum_Memory >= 512 where CoreNum=4                             │ │
│  │     ↓                                                                    │ │
│  │  3. 配置引擎求解                                                         │ │
│  │     - cpu2 x2 (满足 4核内存 >= 512G)                                     │ │
│  │     - md1 x5 (满足 5T 容量)                                             │ │
│  │     ↓                                                                    │ │
│  │  4. 输出 BOM/报价/交付规格                                               │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、完整案例：以服务器配置为例

### 4.1 案例背景

某企业需要采购 X86 服务器，要求：
- 选择 S1110 低端服务器
- 5400 rpm 硬盘总容量至少 5 TB
- 4 核 CPU 总支持内存至少 512 GB

### 4.2 配置过程

**Step 1：锁定模型快照**

```
Configuration → model_snapshot = "SERVER_X86:1.0.0 / S1110:1.0.0"
```

**Step 2：输入参数值**

```json
{
  "HAS_CONFIGURED_VALUE": [
    {
      "parameter_code": "Sum_Capacity",
      "part_class": "drive",
      "value": "5",
      "filter": "Speed=5400"
    },
    {
      "parameter_code": "Sum_Memory",
      "part_class": "cpu",
      "value": "512",
      "filter": "CoreNum=4"
    }
  ]
}
```

**Step 3：引擎求解**

1. **候选过滤（基于 S1110 的 offersPart 裁剪）**
   - cpu 候选：cpu1, cpu2（cpu3/cpu4 被 S1110 禁用）
   - drive 候选：sd1, md1, md2（sd2/sd3 被 S1110 禁用）

2. **参数匹配**
   - `drive.Sum_Capacity >= 5 where Speed=5400`
     - 筛选出 md1 (5400rpm, 1TB), sd1 (5400rpm, 3TB)
   - `cpu.Sum_Memory >= 512 where CoreNum=4`
     - 筛选出 cpu2 (4核, 256GB)

3. **规则校验**
   - 4核 CPU 排除固态硬盘 → sd1 被排除
   - 求解：md1 x5 (满足 5T 容量)

**Step 4：输出配置结果**

```json
{
  "SELECTS_PART": [
    {
      "part_id": "cpu2",
      "quantity": 2,
      "selected": true,
      "reason": "满足4核CPU内存>=512G需求"
    },
    {
      "part_id": "md1",
      "quantity": 5,
      "selected": true,
      "reason": "5400rpm机械硬盘，满足5T容量需求"
    }
  ],
  "artifacts": {
    "bom": [
      { "partCode": "cpu2", "quantity": 2, "unitPrice": 200, "totalPrice": 400 },
      { "partCode": "md1", "quantity": 5, "unitPrice": 30, "totalPrice": 150 }
    ],
    "totalPrice": 550,
    "salesSpec": "4核CPU, 512GB内存, 5TB硬盘",
    "deliverySpec": "7天交付, 标准包装"
  }
}
```

---

## 五、与电商方案的对比

|| 维度 | Palantir 电商方案 | Palantir 复杂产品配置器方案 |
|------|------|------------------|--------------------------|
| **核心业务** | SKU 组合生成、价格、库存 | 部件配置、约束求解、BOM 生成 |
| **模板类型** | OT_SPU_TEMPLATE / OT_SKU_TEMPLATE | OT_PRODUCT_CLASS_TYPE / OT_PART_CLASS_TYPE |
| **属性定义** | OT_ATTRIBUTE（全局字典）+ allowed_value_refs | OT_SPEC_DEFINITION（定义在类型上）+ SpecValue（持有值） |
| **用户输入** | SKU 选颜色/容量 | Parameter（Sum_Capacity、Sum_Memory） |
| **实例类型** | OT_SPU / OT_SKU | OT_PRODUCT_CLASS（含 version）/ OT_PART |
| **产品实例** | SPU 本身（无专门的实例类型） | OT_PRODUCT_INSTANCE（含 offersPart 裁剪） |
| **配置结果** | 选中的 SKU + 价格 + 库存 | OT_CONFIGURATION + OT_CONFIGURED_PART + BOM |
| **LinkType 特色** | SOLD_BY（沉淀为 MerchantSKU）、GENERATES | OFFERS_PART（裁剪语义）、COMPOSED_OF（递归组成） |

---

## 六、附录

### 6.1 LinkType 总览

|| # | LinkType Id | A-side | B-side | Link Properties | 说明 |
|---|------------|--------|--------|-----------------|------|
| 1 | `COMPOSED_OF` | OT_PRODUCT_CLASS | OT_PART_CLASS | selection_policy, min/max_cardinality, multi_instance | 产品类包含部件分类 |
| 2 | `CANDIDATE_PART` | OT_PART_CLASS | OT_PART | — | 部件分类下有候选部件 |
| 3 | `HAS_SPEC` | OT_PRODUCT_CLASS / OT_PART_CLASS | OT_SPEC_DEFINITION | scope | 定义固有规格 |
| 4 | `SPEC_VALUE` | OT_PRODUCT_CLASS / OT_PART | OT_SPEC_VALUE | — | 持有规格值 |
| 5 | `DEFINES_PARAMETER` | OT_PART_CLASS | OT_PARAMETER | assign_type | 定义可配置参数 |
| 6 | `REALIZES` | OT_PRODUCT_INSTANCE | OT_PRODUCT_CLASS | — | 产品实例实现产品类 |
| 7 | `OFFERS_PART` | OT_PRODUCT_INSTANCE | OT_PART | enabled, disabled, defaultSelected, minQty, maxQty, fixed | 裁剪部件候选集 |
| 8 | `OVERRIDES_SPEC` | OT_PRODUCT_INSTANCE | OT_SPEC_OVERRIDE | override_value, reason | 覆盖基线规格 |
| 9 | `SELECTS_PART` | OT_CONFIGURATION | OT_CONFIGURED_PART | quantity, selected, reason | 选择部件 |
| 10 | `HAS_CONFIGURED_VALUE` | OT_CONFIGURATION | OT_CONFIGURED_VALUE | value, unit, source | 持有参数值 |

### 6.2 ObjectType 总览

|| ObjectType Id | 说明 | 层级 |
|---------------|------|------|
| `OT_PRODUCT_CLASS_TYPE` | 产品类类型 | Meta Layer |
| `OT_PART_CLASS_TYPE` | 部件类类型 | Meta Layer |
| `OT_SPEC_DEFINITION` | 规格定义 | Meta Layer |
| `OT_PARAMETER` | 参数定义 | Meta Layer |
| `OT_PRODUCT_CLASS` | 产品类（含版本） | Instance Layer |
| `OT_PART_CLASS` | 部件分类 | Instance Layer |
| `OT_PART` | 部件 | Instance Layer |
| `OT_SPEC_VALUE` | 规格值 | Instance Layer |
| `OT_PRODUCT_INSTANCE` | 可售产品实例 | Instance Layer |
| `OT_SPEC_OVERRIDE` | 规格覆盖 | Instance Layer |
| `OT_CONFIGURATION` | 配置方案 | Runtime Layer |
| `OT_CONFIGURED_PART` | 已选部件 | Runtime Layer |
| `OT_CONFIGURED_VALUE` | 已选参数值 | Runtime Layer |

### 6.3 规格 vs 参数速查

|| 问题 | 答案 |
|------|------|
| 服务器外形（2U/4U）是规格还是参数？ | 产品类规格，因为外形是 ProductClass SERVER_X86 固有的物理属性 |
| 硬盘容量是规格还是参数？ | 部件规格，因为容量是 Part sd1 固有的（3TB） |
| 客户需要"至少 5TB 容量"是什么？ | 参数，因为这是用户可配置的输入需求 |
| CPU 核心数是规格还是参数？ | 部件规格，因为核心数是 CPU 固有的（2/4/8/18） |
| 客户要求"4 核 CPU 总内存 >= 512GB"是什么？ | 参数，因为这是用户可配置的筛选条件 |
| Parameter 有 SpecValue 吗？ | 没有，Parameter 值在 Configuration 中由用户输入 |
| SpecValue 只挂在 Part 上吗？ | 不，ProductClass 也可以挂自己的 SpecValue（产品层规格如 FormFactor） |

---

*文档结束*
