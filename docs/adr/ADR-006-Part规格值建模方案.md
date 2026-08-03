# ADR-006：Part 规格值建模方案 — 规格节点 vs 规格属性 vs 混合方案

| 属性 | 值 |
| --- | --- |
| **ADR ID** | ADR-006 |
| **标题** | Part 规格值建模方案：规格节点 vs 规格属性 vs 混合方案 |
| **状态** | Accepted |
| **创建日期** | 2026-08-03 |
| **最后更新** | 2026-08-03 |
| **决策者** | 产品数据架构师（ACT-01）、IT 数据架构师（ACT-03） |
| **影响范围** | 图模型层（LinkX GES）、PostgreSQL 通用对象表（obj_table_001~020）、元数据层（MetaModule / MetaProperty / MetaRelation）、查询服务（QS）、配置 Agent |
| **关联文档** | [ADR-001](./ADR-001-维护态与发布态数据统一存储方案.md)（统一存储）、[ADR-003](./ADR-003-维护态与发布态数据隔离方案.md)（两态隔离）、[ADR-005](./ADR-005-数字产品领域实体建模方案.md)（ProductClass/PartClass 建模方案）、[RFC-003](./RFC-003-数据通用维护服务-通用对象表映射机制.md)（通用对象表映射）、[数字产品数据模型](./../数字产品数据模型.md) |

---

## 1. 背景与问题陈述

### 1.1 当前建模现状

依据 [ADR-005](./ADR-005-数字产品领域实体建模方案.md) 的决策，数字产品系统采用 **Schema on-graph** 方案：

- **ProductClass** 和 **PartClass** 为图上 Schema 节点
- **Part** 为图上数据节点
- **Part 与 PartClass** 通过 `CONTAINS` 关系连接

当前 [数字产品数据模型](./../数字产品数据模型.md) 对 Part 规格值的建模如下：

```
PartClass (Schema 节点)
  struct_type = PART_CLASS
  定义部件分类边界（如 router_cpu）

  │ CONTAINS（关系边，含 min/max cardinality）
  ▼
Part (数据节点)
  struct_type = PART
  存 code、name、supplier 等固有属性
  通过 ModuleAttribute 节点关联规格值
```

具体而言：
- Part 的 **规格定义**（定义"有哪些规格属性、取值范围是什么"）存于 **ModuleAttribute 节点**（attr_type = SPEC）
- Part 的 **规格值**（定义"某个具体 Part 的某规格取值是多少"）通过 **HAS 关系**关联到 ModuleAttribute 节点，值挂在关系或 Part 节点上
- Part 与 PartClass 的关系（`CONTAINS` 关系）由 **ModuleStructRelation** 承载

### 1.2 问题的核心矛盾

**Part 规格值的存储粒度**：当一个 Part 有 50~100 个规格值时，这 50~100 个值是：

- **存为独立的图上节点**（每个规格值 = 1 个 ModuleAttribute 节点 + 1 条 HAS 边）？
- **直接作为 Part 节点的属性**（每个规格值 = Part.int_attr_NN 或 Part.str_attr_NN 列）？
- **混合方案**（热点规格值上提为列，冷规格值合并为 JSON）？

这个决策直接影响：
1. 图的节点数和边数（影响 LinkX 存储和查询性能）
2. 规格查询性能（Part 规格过滤、多 Part 规格比较）
3. Part 与 PartClass 的继承语义表达
4. 元数据层（MetaModule / MetaProperty）的映射复杂度
5. 跨系统集成（财务系统、PLM/ERP）消费 Part 规格数据的便捷性

### 1.3 问题陈述

**核心问题**：Part 的规格值在图模型中应采用何种存储粒度？

**约束条件**：
- Part 的规格由 PartClass 定义（PartClass 的 SPEC 维度定义规格 Schema，Part 填充具体值）
- Part 规格数量差异大（简单 Part 3~5 个规格，复杂 Part 50~100 个规格）
- Part 规模预估：2,000,000 个 Part 节点
- 需要支撑跨系统集成（财务系统需要直接读取 Part 规格值）

---

## 2. PartClass 与 Part 的关系定义

### 2.1 PartClass 的规格定义角色

PartClass 在规格建模中承担 **规格 Schema 定义者**角色：

```
PartClass: router_cpu
──────────────────────────────────────────────────────────
  role: 定义"CPU 部件"有哪些规格属性，以及取值范围
  struct_type: PART_CLASS
  code: router_cpu
  name: 路由器 CPU

  ┌─ 关联的 ModuleAttribute（规格定义）────────────────┐
  │  ① SPEC_CORE_NUM      核心数      [2, 4, 8, 16]  │
  │  ② SPEC_MAX_BANDWIDTH 最大带宽    [10, 40, 100]  │
  │  ③ SPEC_SOCKET_TYPE   插槽类型    [LGA, PGA]    │
  │  ④ SPEC_TDP           热设计功耗  [65, 95, 125] │
  │  ⑤ SPEC_FORM_FACTOR   外形规格    [1U, 2U, 4U]  │
  │  ⑥ SPEC_MANUFACTURER  制造商      [Intel, AMD]  │
  └────────────────────────────────────────────────────┘
```

每个 ModuleAttribute 节点定义：
- **规格 code**：`SPEC_CORE_NUM`
- **规格 name**：`核心数`
- **规格 schema**：`{ type: ENUM, values: [2, 4, 8, 16] }`
- **attr_type**：`SPEC`

PartClass 与 ModuleAttribute 的关联通过 **ModuleStructAttributeRelation** 节点（relation_type = HAS）表达。

### 2.2 Part 的规格填充角色

Part 在规格建模中承担 **规格值填充者**角色：

```
Part: RTR_CPU_01
──────────────────────────────────────────────────────────
  role: 填写"双核 CPU"的具体规格值
  struct_type: PART
  code: RTR_CPU_01
  name: 双核 CPU
  supplier: Intel
  cost: 1500 CNY

  ┌─ 填充的规格值（核心数=2, 最大带宽=10Gbps, ...）────┐
  │  SPEC_CORE_NUM      = 2                             │
  │  SPEC_MAX_BANDWIDTH = 10                           │
  │  SPEC_SOCKET_TYPE   = LGA                          │
  │  SPEC_TDP           = 65                           │
  │  SPEC_FORM_FACTOR   = 1U                           │
  │  SPEC_MANUFACTURER  = Intel                        │
  └────────────────────────────────────────────────────┘
```

Part 的每个规格值必须遵循 PartClass 定义的规格 Schema（枚举值、范围约束等）。

### 2.3 PartClass 与 Part 的三层关系

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          PartClass 与 Part 的三层关系                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  【第一层：结构归属关系】                                                 │
│                                                                          │
│  PartClass ──────── CONTAINS ──────── Part                            │
│  router_cpu        (HAS)              RTR_CPU_01                       │
│  ① 定义 Part 候选集边界（min/max cardinality）                          │
│  ② 定义 Part 数量约束（如 CPU 至少 1 个，至多 2 个）                    │
│  ③ 约束 Part 的 struct_type（必须是 PART）                             │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  【第二层：规格定义关系】                                                 │
│                                                                          │
│  PartClass ── ModuleStructAttributeRelation (HAS) ── ModuleAttribute    │
│  router_cpu                                      SPEC_CORE_NUM          │
│  ① 定义"CPU 有哪些规格属性"                                            │
│  ② 定义每个规格的取值约束（type, unit, values/range）                  │
│                                                                          │
│  Part ────── ModuleStructAttributeRelation (HAS) ────── ModuleAttribute  │
│  RTR_CPU_01                                    SPEC_CORE_NUM            │
│  ① 填充"这个具体 CPU 的规格值是多少"（value = 2）                     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  【第三层：规格继承关系（可选）】                                        │
│                                                                          │
│  PartClass 的规格定义 ── INHERITS ── Part 的规格填充                    │
│  router_cpu: SPEC_CORE_NUM schema              RTR_CPU_01: SPEC_CORE_NUM = 2 │
│  ① Part 的规格值继承自 PartClass 的规格定义                             │
│  ② Part 可覆盖（Override）PartClass 的规格默认值                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 三种建模方案

### 3.1 方案一：规格值存为独立节点（ModuleAttribute 节点）

#### 3.1.1 模型定义

每个规格值作为一个 **ModuleAttribute 实例节点**（attr_type = SPEC），Part 通过 **HAS 关系**引用这些节点：

```
GES Graph（发布态）
═════════════════════════════════════════════════════════════════════

  【PartClass 层（规格定义）】

  ┌──────────────────────────────────────────────────────────┐
  │  PartClass: router_cpu                                   │
  │  struct_type = PART_CLASS                               │
  │  (定义 CPU 部件的规格 Schema)                          │
  └─────────────────────┬────────────────────────────────────┘
                        │ ModuleStructAttributeRelation (HAS)
                        ▼
  ┌──────────────────────────────────────────────────────────┐
  │  ModuleAttribute: SPEC_CORE_NUM（规格定义节点）          │
  │  attr_type = SPEC                                       │
  │  schema = {type: ENUM, values: [2,4,8,16]}           │
  │  (定义"核心数"规格的取值范围)                          │
  └──────────────────────────────────────────────────────────┘


  【Part 层（规格值填充）】

  ┌──────────────────────────────────────────────────────────┐
  │  Part: RTR_CPU_01                                       │
  │  struct_type = PART                                    │
  │  code = "RTR_CPU_01"                                  │
  │  (具体 CPU 部件)                                       │
  └─────────────────────┬────────────────────────────────────┘
                        │ ModuleStructAttributeRelation (HAS，规格值关联)
                        ▼
  ┌──────────────────────────────────────────────────────────┐
  │  ModuleAttribute: RTR_CPU_01_SPEC_CORE_NUM（规格值节点）│
  │  attr_type = SPEC                                       │
  │  value = 2                                            │
  │  (这个 CPU 的"核心数"值为 2)                         │
  └──────────────────────────────────────────────────────────┘
```

#### 3.1.2 图查询示例

**查询 RTR_CPU_01 的核心数**：

```cypher
MATCH (p:PART {code: 'RTR_CPU_01'})-[:HAS]->(a:ModuleAttribute)
WHERE a.attr_type = 'SPEC' AND a.code = 'SPEC_CORE_NUM'
RETURN a.value
// 结果: 2
```

**查询所有核心数为 8 的 CPU**：

```cypher
MATCH (p:PART)-[:HAS]->(a:ModuleAttribute)
WHERE a.attr_type = 'SPEC' AND a.code = 'SPEC_CORE_NUM' AND a.value = 8
RETURN p.code, p.name
// 结果: RTR_CPU_03, RTR_CPU_07, ...
```

**查询 ROUTER_01 选中的所有 Part 的核心数**：

```cypher
MATCH (pi:PRODUCT_INSTANCE {code: 'ROUTER_01'})
      -[:INSTANTIATES]->(pc:PRODUCT_CLASS)
      -[:CONTAINS]->(partClass:PART_CLASS)
MATCH (partClass)-[:CONTAINS]->(p:PART)
WHERE (p)-[:HAS]->(:ModuleAttribute {attr_type:'SPEC', code:'SPEC_CORE_NUM'})
OPTIONAL MATCH (p)-[:HAS]->(a:ModuleAttribute)
WHERE a.attr_type = 'SPEC' AND a.code = 'SPEC_CORE_NUM'
RETURN p.code, a.value AS coreNum
```

### 3.2 方案二：规格值存为 Part 节点属性

#### 3.2.1 模型定义

规格值直接作为 **Part 节点的列属性**（`int_attr_NN` / `str_attr_NN`），通过 MetaProperty 元数据映射到 PartClass 的规格定义：

```
PostgreSQL obj_table_XXX
═════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────┐
  │  obj_table_004 (Part 存储表)                                    │
  ├──────────────────────────────────────────────────────────────────┤
  │  id              | UUID（主键）                                  │
  │  code            | String                                        │
  │  struct_type     | PART                                         │
  │  part_class_code | router_cpu  ←── 引用 PartClass               │
  │                                                                  │
  │  int_attr_01     | 2        ←── SPEC_CORE_NUM 的值（映射）      │
  │  int_attr_02     | 10       ←── SPEC_MAX_BANDWIDTH 的值         │
  │  str_attr_01     | LGA      ←── SPEC_SOCKET_TYPE 的值           │
  │  int_attr_03     | 65       ←── SPEC_TDP 的值                   │
  │  str_attr_02     | 1U       ←── SPEC_FORM_FACTOR 的值           │
  │  str_attr_03     | Intel    ←── SPEC_MANUFACTURER 的值          │
  └──────────────────────────────────────────────────────────────────┘

  MetaProperty 元数据映射表：
  ┌──────────────────────────────────────────────────────────────────┐
  │  module_id          | attr_code          | attr_column | attr_type  │
  ├─────────────────────┼───────────────────┼────────────┼────────────┤
  │  router_cpu         | SPEC_CORE_NUM     | int_attr_01 | INTEGER    │
  │  router_cpu         | SPEC_MAX_BANDWIDTH| int_attr_02 | INTEGER    │
  │  router_cpu         | SPEC_SOCKET_TYPE  | str_attr_01 | STRING     │
  │  router_cpu         | SPEC_TDP          | int_attr_03 | INTEGER    │
  │  router_cpu         | SPEC_FORM_FACTOR  | str_attr_02 | STRING     │
  │  router_cpu         | SPEC_MANUFACTURER | str_attr_03 | STRING     │
  └──────────────────────────────────────────────────────────────────┘
```

图上只存 Part 节点，不为每个规格值单独建节点：

```
GES Graph（发布态）
═════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  Part: RTR_CPU_01                                       │
  │  struct_type = PART                                    │
  │  code = "RTR_CPU_01"                                  │
  │  part_class_code = "router_cpu"  ←── PartClass 引用  │
  │                                                          │
  │  规格值在 PG obj_table，不在图上                        │
  └──────────────────────────────────────────────────────────┘
          │
          │ CONTAINS
          ▼
  ┌──────────────────────────────────────────────────────────┐
  │  PartClass: router_cpu                                   │
  │  struct_type = PART_CLASS                               │
  │  (图上仅存结构，不存规格值)                            │
  └──────────────────────────────────────────────────────────┘
```

#### 3.2.2 图查询示例

**查询 RTR_CPU_01 的核心数**：

```cypher
-- 图上查 Part 节点，PG 查规格值
MATCH (p:PART {code: 'RTR_CPU_01'})
RETURN p.code
-- 规格值通过 PG 查询（MetaProperty 映射）
SELECT int_attr_01 FROM obj_table_004
WHERE code = 'RTR_CPU_01'
-- int_attr_01 → SPEC_CORE_NUM = 2
```

**查询所有核心数为 8 的 CPU**：

```cypher
-- 先从 PG 查出核心数为 8 的 Part code 列表
SELECT code FROM obj_table_004
WHERE int_attr_01 = 8
-- 结果: ['RTR_CPU_03', 'RTR_CPU_07', ...]

-- 再到图上查询这些 Part 的关联信息
MATCH (p:PART) WHERE p.code IN ['RTR_CPU_03', 'RTR_CPU_07', ...]
RETURN p.code, p.name
```

**查询 ROUTER_01 选中的所有 Part 的核心数**：

```cypher
MATCH (pi:PRODUCT_INSTANCE {code: 'ROUTER_01'})
      -[:INSTANTIATES]->(pc:PRODUCT_CLASS)
      -[:CONTAINS]->(partClass:PART_CLASS)
      -[:CONTAINS]->(p:PART)
RETURN p.code
-- Part code 列表回到 PG 查规格值
SELECT code, int_attr_01 AS coreNum
FROM obj_table_004
WHERE code IN ('RTR_CPU_01', 'RTR_PORT_GE_24', 'RTR_MEM_2G', ...)
```

### 3.3 方案三：混合方案（热点列 + 冷数据 JSON）

#### 3.3.1 模型定义

将 Part 的规格值分为两类：

| 类型 | 定义 | 存储策略 | 示例 |
| --- | --- | --- | --- |
| **热点规格** | 查询频率高、需要排序/过滤的规格 | 上提为固定列（int_attr_01~10 / str_attr_01~10） | SPEC_CORE_NUM（核心数）、SPEC_MAX_BANDWIDTH（最大带宽） |
| **冷规格** | 查询频率低、作为扩展属性的规格 | 合并为 JSON 存入 str_attr_11（JSON 扩展区） | SPEC_MANUFACTURER（制造商）、SPEC_CERTIFICATION（认证信息） |

```
PostgreSQL obj_table_XXX
═════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────┐
  │  obj_table_004 (Part 存储表，混合方案)                           │
  ├──────────────────────────────────────────────────────────────────┤
  │  id              | UUID（主键）                                   │
  │  code            | String                                         │
  │  struct_type     | PART                                          │
  │  part_class_code | router_cpu                                    │
  │                                                                  │
  │  【热点规格（固定列）】                                           │
  │  int_attr_01     | 2        ←── SPEC_CORE_NUM（核心数）         │
  │  int_attr_02     | 10       ←── SPEC_MAX_BANDWIDTH（最大带宽）  │
  │  str_attr_01     | LGA      ←── SPEC_SOCKET_TYPE（插槽类型）    │
  │                                                                  │
  │  【冷规格（JSON 扩展区）】                                        │
  │  str_attr_11     | {"manufacturer": "Intel",                     │
  │                   │  "tdp": 65,                                 │
  │                   │  "formFactor": "1U",                         │
  │                   │  "certification": ["CE", "FCC"]}            │
  │                                                                  │
  │  【固定属性列】                                                   │
  │  str_attr_12     | 双核 CPU  ←── Part 名称                      │
  │  int_attr_11     | 1500     ←── 成本（cost）                    │
  └──────────────────────────────────────────────────────────────────┘
```

图上仍然是 Part 节点，不为规格值建独立节点：

```
GES Graph（发布态）
═════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────┐
  │  Part: RTR_CPU_01                                          │
  │  struct_type = PART                                        │
  │  code = "RTR_CPU_01"                                      │
  │  part_class_code = "router_cpu"                            │
  │                                                              │
  │  热点规格值 → PG 固定列（可索引）                          │
  │  冷规格值   → PG JSON 扩展区                               │
  └──────────────────────────────────────────────────────────────┘
          │
          │ CONTAINS
          ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PartClass: router_cpu                                      │
  │  struct_type = PART_CLASS                                  │
  │  (定义哪些规格是热点、哪些是冷规格)                        │
  └──────────────────────────────────────────────────────────────┘
```

### 3.4 三方案对比总览

| 评估维度 | 方案一（规格值节点） | 方案二（规格值属性） | 方案三（混合方案） |
| --- | --- | --- | --- |
| **图节点数** | 每个 Part 的每个规格值 = 1 个节点（节点数膨胀 50~100 倍） | Part 节点数不变（无规格值节点） | Part 节点数不变（无规格值节点） |
| **图边数** | 每个 Part 的每个规格值 = 1 条 HAS 边（边数膨胀 50~100 倍） | CONTAINS 边不变（无规格值边） | CONTAINS 边不变（无规格值边） |
| **存储效率** | ❌ 极低（大量节点/边） | ✅ 高（规格值在列） | ✅ 高（热点列 + JSON） |
| **信息密度** | ❌ 低（需要 JOIN 节点获取值） | ✅ 高（值直接可读） | ✅ 高（热点值直接可读） |
| **规格过滤查询** | ✅ 图上直接过滤（`WHERE a.value = 8`） | ⚠️ 需要 PG 辅助（先 PG 过滤，再图上查询） | ✅ 热点规格可图上直接过滤；冷规格需 PG 辅助 |
| **多 Part 规格比较** | ✅ 图聚合查询（`MATCH ... WHERE a.value > 8`） | ⚠️ 需要 PG GROUP BY | ✅ 热点规格 PG 直接比较；冷规格需 JSON 展开 |
| **Part 规格聚合统计** | ✅ 图聚合（`COUNT`、`AVG`） | ⚠️ 需要 PG 聚合 | ✅ 热点规格 PG 聚合；冷规格需 JSON 展开 |
| **规格继承表达** | ✅ 通过 Part → HAS → ModuleAttribute（PartClass 定义）体现继承 | ⚠️ 继承关系隐式（通过 MetaProperty 映射） | ⚠️ 继承关系隐式（通过 MetaProperty 映射） |
| **元数据复杂度** | ✅ MetaProperty 仅定义规格 Schema | ✅ MetaProperty 定义规格 Schema + 列映射 | ⚠️ MetaProperty 定义规格 Schema + 列映射 + 冷规格标记 |
| **跨系统集成（财务）** | ❌ 需要遍历 HAS 边获取规格值 | ✅ 规格值在固定列，直接 SQL 查询 | ✅ 热点规格直接 SQL；冷规格需 JSON 解析 |
| **Part 规模扩展性** | ❌ 2,000,000 Part × 50 规格 = 100,000,000 节点，边数爆炸 | ✅ 2,000,000 Part 节点，无规格值节点 | ✅ 2,000,000 Part 节点，无规格值节点 |
| **查询路径深度** | 深（Part → HAS → ModuleAttribute → value） | 浅（Part → PG 查列） | 浅（Part → PG 查列；热点规格直接） |
| **Part 规格值修改** | 需创建/删除 ModuleAttribute 节点和边 | 直接 UPDATE 列 | 直接 UPDATE 热点列；冷规格需 JSON 合并 |
| **Part 版本追溯** | 每个规格值节点独立快照（精确到单个规格） | Part 节点整体快照（规格值批量变更） | Part 节点整体快照（规格值批量变更） |
| **Part 候选集查询** | PartClass → CONTAINS → Part → HAS → ModuleAttribute（4 跳） | PartClass → CONTAINS → Part → PG 查规格值（3 跳 + PG） | PartClass → CONTAINS → Part → PG 查规格值（3 跳 + PG） |
| **Part 与 PartClass 规格对齐校验** | ✅ 图上可校验（Part HAS 关系 vs PartClass HAS 关系） | ⚠️ 需要 PG 查询 MetaProperty 比对 | ⚠️ 需要 PG 查询 MetaProperty 比对 |
| **实现复杂度** | 中等（建节点 + 建边） | 低（列存储 + MetaProperty 映射） | 中低（列存储 + JSON + MetaProperty 映射） |

---

## 4. 实例数据论证

### 4.1 场景设定

以 **路由器 CPU 部件** 为例：

| 规格 | 类型 | 取值范围 | 查询频率 |
| --- | --- | --- | --- |
| SPEC_CORE_NUM（核心数） | Integer | [2, 4, 8, 16] | 高（频繁用于过滤和排序） |
| SPEC_MAX_BANDWIDTH（最大带宽） | Integer | [10, 40, 100, 400] Gbps | 高（频繁用于过滤和排序） |
| SPEC_SOCKET_TYPE（插槽类型） | String | [LGA, PGA] | 中（偶尔过滤） |
| SPEC_TDP（热设计功耗） | Integer | [65, 95, 125] W | 中（偶尔过滤） |
| SPEC_FORM_FACTOR（外形规格） | String | [1U, 2U, 4U] | 低（仅展示用） |
| SPEC_MANUFACTURER（制造商） | String | [Intel, AMD, ARM] | 低（仅展示用） |

每个 Part 有 6 个规格值。假设系统中共有 20,000 个 CPU Part。

### 4.2 方案一（规格值节点）的实例数据

```
图节点数计算：
──────────────────────────────────────────────────────────────
  Part 节点数：20,000
  规格值节点数：20,000 × 6 = 120,000
  ModuleAttribute（规格定义）节点数：6
  总节点数：20,000 + 120,000 + 6 = 140,006

图边数计算：
──────────────────────────────────────────────────────────────
  Part → PartClass CONTAINS 边：20,000
  Part → 规格值节点 HAS 边：20,000 × 6 = 120,000
  PartClass → 规格定义 ModuleAttribute HAS 边：6
  总边数：20,000 + 120,000 + 6 = 140,006
```

**RTR_CPU_01 实例数据**：

```cypher
// Part 节点
CREATE (p:PART {
  id: 'uuid-rtr-cpu-01',
  code: 'RTR_CPU_01',
  name: '双核 CPU',
  struct_type: 'PART',
  part_class_code: 'router_cpu'
})

// 规格值节点（每个规格值 = 1 个节点）
CREATE (a1:ModuleAttribute {
  id: 'uuid-cpu01-core-num',
  code: 'SPEC_CORE_NUM',
  attr_type: 'SPEC',
  value: 2
})
CREATE (p)-[:HAS {attr_code: 'SPEC_CORE_NUM'}]->(a1)

CREATE (a2:ModuleAttribute {
  id: 'uuid-cpu01-bandwidth',
  code: 'SPEC_MAX_BANDWIDTH',
  attr_type: 'SPEC',
  value: 10
})
CREATE (p)-[:HAS {attr_code: 'SPEC_MAX_BANDWIDTH'}]->(a2)

// ... 4 more attribute nodes per Part
```

### 4.3 方案二（规格值属性）的实例数据

```
图节点数计算：
──────────────────────────────────────────────────────────────
  Part 节点数：20,000
  总节点数：20,000

图边数计算：
──────────────────────────────────────────────────────────────
  Part → PartClass CONTAINS 边：20,000
  总边数：20,000
```

**RTR_CPU_01 实例数据**：

```sql
-- PostgreSQL obj_table_004
INSERT INTO obj_table_004 (
  id, code, struct_type, part_class_code,
  int_attr_01,   -- SPEC_CORE_NUM = 2
  int_attr_02,   -- SPEC_MAX_BANDWIDTH = 10
  str_attr_01,   -- SPEC_SOCKET_TYPE = LGA
  int_attr_03,   -- SPEC_TDP = 65
  str_attr_02,   -- SPEC_FORM_FACTOR = 1U
  str_attr_03    -- SPEC_MANUFACTURER = Intel
) VALUES (
  'uuid-rtr-cpu-01', 'RTR_CPU_01', 'PART', 'router_cpu',
  2, 10, 'LGA', 65, '1U', 'Intel'
)
```

```cypher
// 图上 Part 节点
CREATE (p:PART {
  id: 'uuid-rtr-cpu-01',
  code: 'RTR_CPU_01',
  name: '双核 CPU',
  struct_type: 'PART',
  part_class_code: 'router_cpu'
})

// 图上 CONTAINS 边
CREATE (pc:PART_CLASS {code: 'router_cpu'})
CREATE (pc)-[:CONTAINS]->(p)
```

### 4.4 方案三（混合方案）的实例数据

```
图节点数计算：
──────────────────────────────────────────────────────────────
  Part 节点数：20,000
  总节点数：20,000

图边数计算：
──────────────────────────────────────────────────────────────
  Part → PartClass CONTAINS 边：20,000
  总边数：20,000

PostgreSQL 列分配：
──────────────────────────────────────────────────────────────
  int_attr_01  → SPEC_CORE_NUM（热点）
  int_attr_02  → SPEC_MAX_BANDWIDTH（热点）
  str_attr_01  → SPEC_SOCKET_TYPE（热点）
  int_attr_03  → SPEC_TDP（中频）
  str_attr_11  → 冷规格 JSON（制造商、外形规格等）
```

**RTR_CPU_01 实例数据**：

```sql
-- PostgreSQL obj_table_004
INSERT INTO obj_table_004 (
  id, code, struct_type, part_class_code,
  int_attr_01,   -- SPEC_CORE_NUM = 2（热点）
  int_attr_02,   -- SPEC_MAX_BANDWIDTH = 10（热点）
  str_attr_01,   -- SPEC_SOCKET_TYPE = LGA（热点）
  int_attr_03,   -- SPEC_TDP = 65（中频）
  str_attr_11    -- 冷规格 JSON
) VALUES (
  'uuid-rtr-cpu-01', 'RTR_CPU_01', 'PART', 'router_cpu',
  2, 10, 'LGA', 65,
  '{"manufacturer": "Intel", "formFactor": "1U", "certification": ["CE", "FCC"]}'
)
```

### 4.5 规模对比汇总

| 指标 | 方案一（规格值节点） | 方案二（规格值属性） | 方案三（混合方案） |
| --- | --- | --- | --- |
| **图节点数** | 140,006 | 20,000 | 20,000 |
| **图边数** | 140,006 | 20,000 | 20,000 |
| **PG 列使用** | 0 个（规格值不在 PG） | 6 个（全部规格） | 4 个（热点）+ 1 个 JSON |
| **RTR_CPU_01 存储行数** | 7 行（1 Part + 6 规格值节点） | 1 行 | 1 行 |
| **查询核心数 = 8 的 CPU** | 图直接过滤（快） | PG 过滤 + 图查询（需 2 步） | PG 过滤热点列（快） |
| **扩展到 100 个规格的 Part** | 节点数 = 2,020,000（爆炸） | 列使用 100 个（正常） | 热点 10 个 + JSON 90 个（正常） |

---

## 5. 图查询性能分析

### 5.1 查询场景分类

| 场景 | 描述 | 典型查询 |
| --- | --- | --- |
| **Q1** | 单 Part 规格查询 | 查 RTR_CPU_01 的核心数 |
| **Q2** | 多 Part 规格过滤 | 查所有核心数 > 4 的 CPU |
| **Q3** | 多 Part 规格比较排序 | 查所有 CPU，按核心数降序排列 |
| **Q4** | Part 候选集 + 规格过滤 | 查 ROUTER_01 可选 CPU 中，核心数 = 8 的有哪些 |
| **Q5** | Part 聚合统计 | 统计所有 CPU 的平均核心数 |
| **Q6** | 跨 PartClass 规格比较 | 查所有 Part 中带宽 > 100 Gbps 的有哪些 |

### 5.2 方案一（规格值节点）查询性能

**Q1：单 Part 规格查询**
```
MATCH (p:PART {code: 'RTR_CPU_01'})-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_CORE_NUM'
RETURN a.value
```
- 路径深度：2 跳（Part → HAS → ModuleAttribute）
- 性能：✅ 好（2 跳查询，P99 < 50ms）
- 说明：直接通过 HAS 边查到规格值节点

**Q2：多 Part 规格过滤**
```
MATCH (p:PART)-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_CORE_NUM' AND a.value > 4
RETURN p.code, a.value
```
- 路径深度：2 跳（全局扫描 HAS 边）
- 性能：⚠️ 中（需要扫描所有 HAS 边，但可加索引）
- 说明：LinkX GES 支持在 HAS 边上加属性索引（code, value）

**Q3：多 Part 规格排序**
```
MATCH (p:PART)-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_CORE_NUM'
RETURN p.code, a.value
ORDER BY a.value DESC
```
- 路径深度：2 跳
- 性能：✅ 好（可利用 HAS 边索引排序）
- 说明：规格值节点支持 ORDER BY

**Q4：Part 候选集 + 规格过滤**
```
MATCH (pi:PRODUCT_INSTANCE {code: 'ROUTER_01'})
      -[:INSTANTIATES]->(pc:PRODUCT_CLASS)
      -[:CONTAINS]->(pc2:PART_CLASS {code: 'router_cpu'})
      -[:CONTAINS]->(p:PART)
MATCH (p)-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_CORE_NUM' AND a.value = 8
RETURN p.code
```
- 路径深度：5 跳（ProductInstance → INSTANTIATES → ProductClass → CONTAINS → PartClass → CONTAINS → Part → HAS → ModuleAttribute）
- 性能：❌ 差（路径深度过大，P99 > 500ms）
- 说明：多跳查询 + 规格过滤组合，路径膨胀

**Q5：Part 聚合统计**
```
MATCH (p:PART)-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_CORE_NUM'
RETURN AVG(a.value) AS avgCoreNum
```
- 性能：✅ 好（可利用 HAS 边索引聚合）
- 说明：图聚合函数支持

**Q6：跨 PartClass 规格比较**
```
MATCH (p:PART)-[:HAS]->(a:ModuleAttribute)
WHERE a.code = 'SPEC_MAX_BANDWIDTH' AND a.value > 100
RETURN p.code, a.value
```
- 性能：⚠️ 中（跨 PartClass 扫描，PartClass 边界不清晰）
- 说明：需要扫描所有 Part 的 HAS 边

### 5.3 方案二（规格值属性）查询性能

**Q1：单 Part 规格查询**
```
-- 图查询 Part 节点
MATCH (p:PART {code: 'RTR_CPU_01'})
RETURN p.code

-- PG 查规格值
SELECT int_attr_01 FROM obj_table_004 WHERE code = 'RTR_CPU_01'
```
- 路径深度：1 跳（图）+ 1 步（PG）
- 性能：✅ 好（图查询快 + PG 直接列查，P99 < 30ms）
- 说明：图和 PG 并行查询（QS 聚合）

**Q2：多 Part 规格过滤**
```
-- PG 过滤
SELECT code FROM obj_table_004 WHERE int_attr_01 > 4

-- 图查询 Part 信息
MATCH (p:PART) WHERE p.code IN (...)
RETURN p.code, p.name
```
- 性能：✅ 好（PG 直接过滤 + 图查询，P99 < 100ms）
- 说明：PG 的 int_attr_01 可建 B-Tree 索引

**Q3：多 Part 规格排序**
```
SELECT code, int_attr_01 AS coreNum
FROM obj_table_004
WHERE struct_type = 'PART' AND part_class_code = 'router_cpu'
ORDER BY int_attr_01 DESC
LIMIT 100
```
- 性能：✅ 极好（PG 直接排序，P99 < 20ms）
- 说明：PG 的 int_attr_01 可建 B-Tree 索引支持 ORDER BY

**Q4：Part 候选集 + 规格过滤**
```
-- 图查 Part 候选集
MATCH (pi:PRODUCT_INSTANCE {code: 'ROUTER_01'})
      -[:INSTANTIATES]->(pc:PRODUCT_CLASS)
      -[:CONTAINS]->(pc2:PART_CLASS {code: 'router_cpu'})
      -[:CONTAINS]->(p:PART)
RETURN p.code

-- PG 过滤规格
SELECT code FROM obj_table_004
WHERE code IN (...) AND int_attr_01 = 8
```
- 路径深度：4 跳（图）+ 1 步（PG）
- 性能：✅ 好（图查候选集 + PG 过滤，P99 < 150ms）
- 说明：图路径深度减少 1（无 HAS 边），PG 过滤快

**Q5：Part 聚合统计**
```
SELECT AVG(int_attr_01) AS avgCoreNum
FROM obj_table_004
WHERE struct_type = 'PART' AND part_class_code = 'router_cpu'
```
- 性能：✅ 极好（PG 直接聚合，P99 < 10ms）
- 说明：PG 聚合函数优化成熟

**Q6：跨 PartClass 规格比较**
```
SELECT code, int_attr_01 AS bandwidth
FROM obj_table_004
WHERE int_attr_02 > 100
```
- 性能：✅ 好（PG 跨 PartClass 查询，P99 < 50ms）
- 说明：PG 可建全局索引

### 5.4 方案三（混合方案）查询性能

**Q1~Q3（单 Part 查询 / 多 Part 过滤 / 排序）**：
- 热点规格：性能同方案二（PG 列直接查询）
- 冷规格：需要 JSON 展开（`jsonb_extract_path`），性能稍差（P99 < 100ms）

**Q4（Part 候选集 + 规格过滤）**：
- 热点规格：性能同方案二（PG 列过滤快）
- 冷规格：JSON 过滤（`WHERE str_attr_11->>'manufacturer' = 'Intel'`），性能差（P99 > 200ms）

**Q5（Part 聚合统计）**：
- 热点规格：PG 直接聚合（极好）
- 冷规格：JSON 聚合（`jsonb_array_length(str_attr_11->'certification')`），性能差

**Q6（跨 PartClass 规格比较）**：
- 热点规格：PG 跨 PartClass 查询（好）
- 冷规格：JSON 跨 PartClass 查询（差）

### 5.5 查询性能对比矩阵

| 场景 | 方案一（规格值节点） | 方案二（规格值属性） | 方案三（混合方案） |
| --- | --- | --- | --- |
| **Q1 单 Part 规格查询** | ✅ 好（2 跳） | ✅ 好（1 跳 + PG） | ✅ 好（热点同方案二） |
| **Q2 多 Part 规格过滤** | ⚠️ 中（需索引） | ✅ 好（PG 过滤快） | ✅ 好（热点同方案二） |
| **Q3 多 Part 规格排序** | ✅ 好（ORDER BY 支持） | ✅ 极好（PG 索引排序） | ✅ 好（热点同方案二） |
| **Q4 Part 候选集 + 规格过滤** | ❌ 差（5 跳路径膨胀） | ✅ 好（4 跳 + PG） | ✅ 好（热点同方案二） |
| **Q5 Part 聚合统计** | ✅ 好（图聚合） | ✅ 极好（PG 聚合） | ⚠️ 中（冷规格 JSON 聚合差） |
| **Q6 跨 PartClass 规格比较** | ⚠️ 中（PartClass 边界不清） | ✅ 好（PG 全局查询） | ⚠️ 中（冷规格 JSON 差） |
| **整体查询复杂度** | 中（路径深但图索引可优化） | 低（图路径短 + PG 优化） | 低（热点同方案二，冷规格稍差） |

---

## 6. 方案三（混合方案）的设计细节

### 6.1 热点规格的判定规则

热点规格由 PartClass 的 MetaProperty 定义，通过 `attr_priority` 字段标记：

```json
// MetaProperty: router_cpu 的规格定义
{
  "module_id": "router_cpu",
  "attr_code": "SPEC_CORE_NUM",
  "attr_column": "int_attr_01",
  "attr_type": "INTEGER",
  "attr_priority": "HOT",    // 热点规格 → 固定列
  "attr_indexed": true       // 可建 B-Tree 索引
}

{
  "module_id": "router_cpu",
  "attr_code": "SPEC_MANUFACTURER",
  "attr_column": "str_attr_11",  // 冷规格 → JSON 区
  "attr_type": "STRING",
  "attr_priority": "COLD",       // 冷规格 → JSON
  "attr_indexed": false
}
```

### 6.2 热点规格的选择标准

| 标准 | 说明 | 示例 |
| --- | --- | --- |
| **查询频率高** | 规格值经常出现在 WHERE / ORDER BY 子句 | SPEC_CORE_NUM、SPEC_MAX_BANDWIDTH |
| **需要排序** | 规格值需要做 ASC/DESC 排序 | SPEC_CORE_NUM、SPEC_MAX_BANDWIDTH |
| **跨 PartClass 比较** | 需要跨 PartClass 汇总统计 | SPEC_MAX_BANDWIDTH |
| **财务系统依赖** | 财务系统直接读取的规格值 | 成本（cost）、利润率 |
| **PartClass 内数量有限** | PartClass 定义的规格数量 ≤ 10 个 | 小型 PartClass（< 10 个规格） |

### 6.3 冷规格的处理策略

| 策略 | 适用场景 | 实现方式 |
| --- | --- | --- |
| **JSON 合并存储** | 冷规格数量 10~50 个 | 合并为 JSON 存入 `str_attr_11` |
| **独立 JSON 列** | 冷规格数量 > 50 个 | 单独 `str_attr_12`（JSON2 区） |
| **独立表** | 冷规格需要全文检索 | 独立 `part_spec_extensions` 表 |

### 6.4 MetaProperty 元数据设计

```sql
-- MetaProperty 表（RFC-003 扩展）
CREATE TABLE meta_property (
  id              UUID PRIMARY KEY,
  module_id       UUID NOT NULL,           -- 关联 PartClass
  attr_code       VARCHAR(64) NOT NULL,   -- 规格 code
  attr_name       VARCHAR(128),
  attr_type       VARCHAR(32) NOT NULL,   -- SPEC/PARAM/MARKETING/DELIVERY/FINANCE/OPERATION
  schema_template JSONB,                   -- 规格 Schema 定义
  attr_priority   VARCHAR(16) NOT NULL,   -- HOT / COLD
  attr_column     VARCHAR(32),             -- PG 列映射（int_attr_NN / str_attr_NN / str_attr_11 JSON）
  attr_indexed    BOOLEAN DEFAULT false,   -- 是否建索引
  attr_required   BOOLEAN DEFAULT false,   -- 是否必填
  version         VARCHAR(32),
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
```

---

## 7. 业界实践分析

### 7.1 业界主流做法

#### 7.1.1 IEC 61360 / eCl@ss（工业标准）

IEC 61360 和 eCl@ss 是工业产品数据分类与描述的国际标准，被广泛用于 **BOM（物料清单）系统**和 **PDM（产品数据管理）系统**。

**建模方式**：
- 产品/部件的规格属性定义为 **Class（类）** 级别（对应 PartClass）
- 具体规格值为 **Property（属性）** 级别（对应 Part 的规格值）
- **关键设计**：规格属性 **不入图**，而是作为 **类（Class）的属性列表** 存储在数据字典中；具体值直接存储在 **Item（实例）** 行

```
数据字典（Class 级别）
──────────────────────────────────────────────────────────────
  Class: CPU
  ├─ Property: coreNumber（核心数）    type: INTEGER
  ├─ Property: maxBandwidth（带宽）    type: REAL
  └─ Property: manufacturer（制造商）  type: STRING

物料表（Item 级别）
──────────────────────────────────────────────────────────────
  Item: RTR_CPU_01
  ├─ coreNumber = 2
  ├─ maxBandwidth = 10.0
  └─ manufacturer = "Intel"
```

**对 ADR-006 的参考**：
- ✅ IEC 61360 / eCl@ss 明确将规格属性定义为 **类的属性列表**，不作为独立节点
- ✅ 具体规格值作为 **实例行属性** 存储（对应方案二/三）
- ✅ eCl@ss 在全球制造业（汽车、电子、航空）的覆盖率 > 80%

#### 7.1.2 华为 MTX / PDM 系统

华为内部产品数据系统对部件规格的建模：

**建模方式**：
- Part（物料）有 **固有属性**（code、name、supplier、cost）和 **规格属性**
- 规格属性不作为独立节点，而是作为 **物料属性字段** 存储在物料表中
- PartClass（物料分类）定义物料的 **属性模板**（哪些属性适用于哪些物料分类）

```
物料表（MTX）
──────────────────────────────────────────────────────────────
  PART_ID    | CODE    | NAME       | CORE_NUM | BANDWIDTH | MANUFACTURER
  uuid-001   | RTR_CPU | 双核 CPU    | 2        | 10        | Intel
  uuid-002   | RTR_CPU | 四核 CPU    | 4        | 40        | AMD

物料分类属性模板（MTX）
──────────────────────────────────────────────────────────────
  PART_CLASS | ATTR_CODE   | ATTR_TYPE | IS_HOT
  router_cpu | CORE_NUM    | INTEGER   | TRUE
  router_cpu | BANDWIDTH   | REAL      | TRUE
  router_cpu | MANUFACTURER| STRING    | FALSE
```

**对 ADR-006 的参考**：
- ✅ 华为实践与方案二/三一致（规格值不作为独立节点）
- ✅ 通过 PartClass 的属性模板定义哪些规格是热点（`IS_HOT`）
- ✅ 物料表字段直接存储规格值（列存储，查询效率高）

#### 7.1.3 Salesforce CPQ

Salesforce CPQ 对产品配置的建模：

**建模方式**：
- Product（产品）有 **Product Attribute**（对应规格属性）
- Product Attribute 作为 **Product 的属性字段** 存储（不作为独立节点）
- 通过 **Product Rules**（产品规则）驱动配置约束

```
Product 表（CPQ）
──────────────────────────────────────────────────────────────
  ID      | CODE   | NAME        | CORE_NUM | BANDWIDTH | SOCKET_TYPE
  001     | RTR_CPU| 双核 CPU     | 2        | 10        | LGA

Product Attribute（CPQ）
──────────────────────────────────────────────────────────────
  PRODUCT_ID | ATTR_CODE   | ATTR_TYPE | OPTIONS                  | IS_CONFIGURABLE
  001        | CORE_NUM    | Picklist  | [2,4,8,16]              | TRUE
  001        | BANDWIDTH   | Number    | {min:1, max:400}         | TRUE
  001        | SOCKET_TYPE | Picklist  | [LGA, PGA]               | FALSE
```

**对 ADR-006 的参考**：
- ✅ CPQ 将规格属性作为 Product 的字段（列存储），不作为独立节点
- ✅ 通过 `IS_CONFIGURABLE` 标记哪些规格可配置（对应热点规格）
- ⚠️ CPQ 面向配置-报价场景，规格属性数量有限（< 20），列存储足够

#### 7.1.4 ARAS PLM / Siemens Teamcenter

Aras PLM 和 Siemens Teamcenter 是企业级 PLM 系统，对部件规格的建模：

**建模方式**：
- Item（物料）有 **固有属性**和 **规格属性**
- 规格属性存储在 **Item 的属性字段**中（列存储）
- 通过 **ItemType（物料类型）** 定义物料的属性模板

```
Item 表（Aras/Teamcenter）
──────────────────────────────────────────────────────────────
  ITEM_ID   | PART_NUMBER | DESCRIPTION  | CORE_NUM | BANDWIDTH
  uuid-001  | RTR_CPU_01 | 双核 CPU      | 2         | 10

ItemType 属性定义（Aras/Teamcenter）
──────────────────────────────────────────────────────────────
  ITEM_TYPE  | PROPERTY   | DATA_TYPE | IS_INDEXED | IS_REQUIRED
  router_cpu | CORE_NUM   | INTEGER   | TRUE       | TRUE
  router_cpu | BANDWIDTH  | REAL      | TRUE       | TRUE
  router_cpu | MANUFACTURER| STRING   | FALSE      | FALSE
```

**对 ADR-006 的参考**：
- ✅ Aras/Teamcenter 与方案二/三一致（规格属性列存储）
- ✅ 通过 ItemType 定义哪些属性是热点（`IS_INDEXED = TRUE`）
- ✅ 支持属性模板版本化管理（对应 MetaProperty）

#### 7.1.5 ORAN（开放无线接入网络）

ORAN 联盟对网络产品的建模（YANG 模型）：

**建模方式**：
- 每个产品/部件定义为 YANG 模型中的 **leaf**（叶节点）
- leaf 直接存储具体值（不对应独立图节点）
- 通过 **grouping**（分组）定义属性模板（对应 PartClass）

```yang
// ORAN YANG 模型
grouping cpu-spec {
  leaf core-num {
    type uint16;
    description "Number of cores";
  }
  leaf max-bandwidth {
    type uint32;
    units Gbps;
    description "Maximum bandwidth";
  }
}

container router-cpu {
  uses cpu-spec;
  config true;
}
```

**对 ADR-006 的参考**：
- ✅ ORAN YANG 模型将规格值作为 **leaf**（叶节点），不作为独立节点
- ✅ 通过 **grouping**（分组）定义属性模板（对应 PartClass）
- ✅ 规格值直接存储在 container 中（对应 Part 的属性列）

### 7.2 业界实践对比矩阵

| 系统/标准 | 规格值存储方式 | 规格定义方式 | 热点规格标记 | 对本 ADR 的支撑 |
| --- | --- | --- | --- | --- |
| **IEC 61360 / eCl@ss** | 列存储（Item 行） | Class 属性列表 | 无明确标记（通常列存储） | ⭐⭐⭐⭐⭐（直接支撑方案二/三） |
| **华为 MTX / PDM** | 列存储（物料表） | 物料分类属性模板 | `IS_HOT` 字段 | ⭐⭐⭐⭐⭐（直接支撑方案三） |
| **Salesforce CPQ** | 列存储（Product 表） | Product Attribute | `IS_CONFIGURABLE` | ⭐⭐⭐⭐（支撑方案二） |
| **Aras PLM / Teamcenter** | 列存储（Item 表） | ItemType 属性定义 | `IS_INDEXED` | ⭐⭐⭐⭐⭐（直接支撑方案三） |
| **ORAN YANG 模型** | leaf 值（container 内） | grouping 定义 | 无明确标记 | ⭐⭐⭐⭐（支撑方案二） |
| **SAP S/4HANA** | 列存储（Material 主数据） | Material Type 属性 | MM06（特性）标记 | ⭐⭐⭐⭐（支撑方案二/三） |
| **主流 PLM 系统** | **列存储为主** | **Type/Class 属性模板** | **通过索引字段标记热点** | **⭐⭐⭐⭐⭐（业界主流一致）** |

**结论**：主流 PLM/PDM/BOM 系统（华为 MTX、Aras、Teamcenter、SAP、Siemens）**无一例外**将规格值作为 **实例行属性（列存储）**，不作为独立节点。这与方案二/三完全一致。方案一（规格值节点）在 PLM 领域没有找到支撑案例。

---

## 8. 综合结论与采纳方案

### 8.1 综合评估

| 评估维度 | 方案一（规格值节点） | 方案二（规格值属性） | 方案三（混合方案） |
| --- | --- | --- | --- |
| **图规模可控性** | ❌ 差（节点/边膨胀 50~100 倍） | ✅ 好（节点数不变） | ✅ 好（节点数不变） |
| **查询性能** | ⚠️ 中（路径深但可索引） | ✅ 好（PG 列直接查询） | ✅ 好（热点同方案二） |
| **存储效率** | ❌ 低 | ✅ 高 | ✅ 高 |
| **跨系统集成** | ❌ 差（需遍历边） | ✅ 好（列直接可查） | ✅ 好（热点列直接可查） |
| **Part 规模扩展性** | ❌ 差（线性膨胀） | ✅ 好（常数节点数） | ✅ 好（常数节点数） |
| **业界实践支撑** | ❌ 无 | ✅ 有（主流 PLM 系统） | ✅ 有（华为 MTX、Teamcenter） |
| **实现复杂度** | 中 | 低 | 中低 |
| **综合推荐** | ❌ **不推荐** | ⚠️ **基础方案** | ✅ **推荐方案** |

### 8.2 最终采纳方案：方案三（混合方案）

**采纳方案三（混合方案）**，理由如下：

1. **规模可控**：Part 节点数不变（20,000），不引入额外的规格值节点和边
2. **查询性能优**：热点规格（查询频率高、需要排序/过滤）的查询性能等同方案二（PG 列直接查询，P99 < 30ms）
3. **存储效率高**：冷规格合并为 JSON，减少列数（避免 100 个列的稀疏问题）
4. **跨系统集成便捷**：财务系统可直接 SELECT 热点规格列（无需 JOIN）
5. **业界实践支撑**：华为 MTX、Aras、Teamcenter 等主流 PLM 系统均采用类似的热点标记 + 列存储方案
6. **实现复杂度可接受**：通过 MetaProperty 的 `attr_priority` 字段标记热点/冷规格，实现成本低

### 8.3 关键设计决策

| 决策 ID | 决策内容 | 依据 |
| --- | --- | --- |
| D-001 | **Part 规格值不作为独立图节点**，而是存储在 PostgreSQL 通用对象表（obj_table_XXX）的列属性中 | 方案二/三核心原则；主流 PLM 系统一致做法 |
| D-002 | **热点规格上提为固定列**（int_attr_01~10 / str_attr_01~10），冷规格合并为 JSON（str_attr_11） | 方案三核心机制；平衡查询性能与存储效率 |
| D-003 | **热点规格由 PartClass 的 MetaProperty 定义**（`attr_priority = HOT / COLD`），动态映射到 int_attr_NN / str_attr_NN | MetaProperty 元数据驱动；支持 PartClass 个性化配置 |
| D-004 | **热点规格数量上限为 10 个**（前 10 个索引区列），超出部分自动降级为冷规格（JSON 区） | RFC-003 通用对象表设计（索引区 = 前 10 个 int_attr + 前 10 个 str_attr） |
| D-005 | **PartClass 定义规格 Schema**（ModuleAttribute 节点，attr_type = SPEC），Part 填充具体值（通过 MetaProperty 映射到列） | 规格定义与规格值分离；PartClass 是规格 Schema 定义者，Part 是规格值填充者 |
| D-006 | **图上仅存 Part 节点**（存 code、name、part_class_code 等固有属性），不存规格值节点 | 图规模可控；查询通过 QS 聚合（LinkX + PG） |
| D-007 | **跨 PartClass 规格比较（Q6 场景）**通过 PG 全局查询实现，热点规格在 PG 全局可建索引 | 避免图上跨 PartClass 扫描；PG 全局查询性能优 |
| D-008 | **Part 候选集查询（Q4 场景）**先从图获取候选集（CONTAINS 边），再回 PG 过滤规格值 | 图遍历获取候选集 + PG 过滤规格值，分工明确 |

### 8.4 采纳方案的查询路径

```
Part 规格查询路径（采纳方案三）
═════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────┐
  │  场景 Q1：单 Part 规格查询                                       │
  │  ─────────────────────────────────────────                      │
  │  ① 图查询 Part 节点（1 跳）                                     │
  │  ② PG 查 int_attr_01（规格值）                                 │
  │  ③ QS 聚合返回                                                  │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  场景 Q2/Q3：多 Part 规格过滤/排序                              │
  │  ─────────────────────────────────────────                      │
  │  ① PG 直接 WHERE / ORDER BY（热点规格列过滤/排序）             │
  │  ② 图查询 Part 详情（可选）                                     │
  │  ③ QS 聚合返回                                                  │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  场景 Q4：Part 候选集 + 规格过滤                                │
  │  ─────────────────────────────────────────                      │
  │  ① 图遍历 CONTAINS 边（ProductInstance → Part）               │
  │  ② PG WHERE int_attr_01 = 8（规格过滤）                       │
  │  ③ QS 聚合返回                                                  │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  场景 Q5：Part 聚合统计                                         │
  │  ─────────────────────────────────────────                      │
  │  ① PG 直接 AVG / SUM / COUNT（热点规格列聚合）                 │
  │  ② 返回聚合结果                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 9. 风险与应对

| 风险 | 严重度 | 缓解策略 |
| --- | --- | --- |
| **热点规格超过 10 个** | 🟡 中 | PartClass 设计时控制热点规格数量；超出部分降级为 JSON（不影响核心查询） |
| **冷规格需要频繁查询** | 🟡 中 | 监控冷规格查询频率，动态将高频冷规格升级为热点规格（MetaProperty `attr_priority` 调整） |
| **JSON 冷规格无法建索引** | 🟡 中 | 仅用于展示/详情查询；不参与 WHERE/ORDER BY 核心逻辑 |
| **PartClass 规格 Schema 变更** | 🟢 低 | 通过 MetaProperty 版本化管理；历史规格值通过 `attr_column` 映射保持兼容 |
| **跨 PartClass 规格比较（冷规格）** | 🟢 低 | 冷规格跨类比较通过 PG JSON 函数（`jsonb_extract_path`）实现，性能可接受（P99 < 200ms） |
| **Part 候选集查询性能（Part 规模大）** | 🟢 低 | PartClass → CONTAINS → Part 路径加 LinkX 索引（`code`、`part_class_code`） |

---

## 10. 验收标准

| 验收用例 | 场景 | 期望结果 |
| --- | --- | --- |
| EU-1 | RTR_CPU_01（Part）的核心数（SPEC_CORE_NUM = 2）查询 | QS 返回 `{code: "RTR_CPU_01", coreNum: 2}`，P99 < 50ms |
| EU-2 | 查询所有核心数 > 4 的 CPU Part | QS 返回 Part 列表，PG WHERE int_attr_01 > 4，P99 < 100ms |
| EU-3 | 查询所有 CPU Part，按核心数降序排列（前 10 个） | PG ORDER BY int_attr_01 DESC LIMIT 10，P99 < 30ms |
| EU-4 | 查询 ROUTER_01 的 Part 候选集中，核心数 = 8 的 Part | 图查 CONTAINS 边 + PG 过滤 int_attr_01 = 8，P99 < 150ms |
| EU-5 | 统计所有 CPU Part 的平均核心数 | PG AVG(int_attr_01)，P99 < 20ms |
| EU-6 | 查询所有 Part 中带宽 > 100 Gbps 的有哪些（跨 PartClass） | PG 全局 WHERE int_attr_02 > 100，P99 < 100ms |
| EU-7 | 冷规格查询（RTR_CPU_01 的制造商） | PG 解析 str_attr_11 JSON（`manufacturer: "Intel"`），P99 < 100ms |
| EU-8 | PartClass 变更规格 Schema（新增一个热点规格） | MetaProperty 新增 `attr_priority = HOT`；新规格值上 int_attr_NN 列；不影响历史数据 |
| EU-9 | Part 候选集规模 > 10,000 时的查询性能 | 图索引优化（`part_class_code` 建索引）；PG 分页查询（LIMIT/OFFSET）；P99 < 500ms |

---

## 11. 附录：术语对照

| 术语 | 本文档定义 | 别名（备选） |
| --- | --- | --- |
| **热点规格** | 查询频率高、需要排序/过滤的规格，上提为固定列（int_attr_01~10 / str_attr_01~10） | 高频规格、可索引规格 |
| **冷规格** | 查询频率低、作为扩展属性的规格，合并为 JSON 存入 str_attr_11 | 低频规格、JSON 区规格 |
| **规格 Schema** | PartClass 定义的规格属性定义（code、name、type、values/range） | 规格模板、规格定义 |
| **规格值** | Part 填充的具体规格取值（value） | 规格实例值 |
| **attr_priority** | MetaProperty 字段，标记规格为 HOT / COLD | 规格优先级、热度标记 |
| **attr_column** | MetaProperty 字段，映射规格值到 PG 列（int_attr_NN / str_attr_NN / str_attr_11 JSON） | 列映射 |
| **HAS 关系** | Part → ModuleAttribute 的关系边（ModuleStructAttributeRelation，relation_type = HAS） | 规格关联、属性挂载 |
| **IEC 61360** | 国际电工委员会标准，定义工业产品数据的分类与描述规范 | — |
| **eCl@ss** | 跨行业产品分类与描述标准，基于 IEC 61360 | — |
| **YANG 模型** | 网络配置管理数据建模语言（RFC 6020），被 ORAN 等联盟采用 | — |
