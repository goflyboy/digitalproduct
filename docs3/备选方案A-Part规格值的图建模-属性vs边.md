# 备选方案 A：Part 规格值的两种图建模方式（属性 vs. 边）

> **文档版本**: v1.0
> **创建时间**: 2026-07-28
> **来源章节**: docs3/复杂产品配置器的数据模型.md §五
> **适用场景**: 复杂产品（服务器、PLC、工业设备等）的本体建模中，Part 规格值（SpecValue）应建模为节点属性还是节点间的边

---

## 章节定位

前文 docs3 §1.4 / §2.1 / §2.2 已采用「Part 自身属性 = SpecValue」的标准建模。本章作为**备选方案**专门论证：当业务方倾向"SKU 不继承 SPU、属性全部实例化（扁平化）"的场景下，把 SpecValue 当成 Part 的**属性**还是当成 Part → AttributeValue 节点的**边**，各自的得失。

---

## 1. 问题来源：电商 SKU 扁平化场景

电商 SPU/SKU 在很多业务中是这样建模的：

```
SPU iPhone 16 ──┬── SKU: iPhone16 256G 黑色   (颜色=黑色, 容量=256GB, 制式=公开版, ...)
                ├── SKU: iPhone16 512G 钛色    (颜色=钛色, 容量=512GB, 制式=公开版, ...)
                └── SKU: iPhone16 128G 黑色电信 (颜色=黑色, 容量=128GB, 制式=电信版, ...)
```

关键差异：

| 维度 | 复杂产品（本文主线） | 电商 SKU 扁平化 |
|------|-------------------|---------------|
| 属性的"层级" | Part 继承 PartClass 的 SpecDefinition | SKU 直接持有全部属性值，没有"模板层" |
| 属性共享 | 同 PartClass 的 Part 共用同一组 SpecDefinition | 不同 SKU 之间属性可任意组合 |
| 属性数量 | PartClass 通常 3~10 个规格 | SKU 可达 20~50 个属性 |
| 查询主场景 | 「满足 4 核 CPU 且内存 ≥ 512GB 的 Part」 | 「重量=10 的 SKU」「重量≥100 的 SKU」|

最后一行是本章要回答的核心问题：**当业务主场景是「属性过滤」（重量 = 10 或 ≥ 100）时，把属性建模成节点的属性还是节点之间的边，性能/能力差异如何？**

---

## 2. 方案 A：SpecValue 作为 Part 节点自身的属性

### 2.1 数据形态

```cypher
// Neo4j Cypher 表示
(:Part {code:'cpu1', CoreNum:2, Memory:123, ConfigType:2})
(:Part {code:'cpu2', CoreNum:4, Memory:256, ConfigType:2})
(:Part {code:'sd1',  Speed:5400, Capacity:3, Type:'sd'})
```

```sparql
# Stardog SPARQL 表示
:cpu1 :CoreNum 2 ; :Memory 123 ; :ConfigType 2 .
:sd1  :Speed 5400 ; :Capacity 3 ; :Type "sd" .
```

### 2.2 优点

1. **属性过滤是最快路径**：原生属性索引（Neo4j 的 schema index / Stardog 的 predicate index）直接命中，不需要再走边的 join
2. **范围查询高效**：`WHERE p.Memory >= 512` 走 B-tree / range index，单表 O(log N)
3. **存储紧凑**：每 Part 一个节点 + K 个属性，节点数和边数最少
4. **写入简单**：批量更新 SpecValue 就是 `SET n.Memory = 256`
5. **JSON / CSV 导出自然**：与业务系统的"扁平表"心智模型一致
6. **图遍历 + 过滤混合场景强**：先沿关系拿到候选 Part 集，再 `WHERE p.Weight >= 100`，一步到位

### 2.3 缺点

1. **属性 schema 不固定**：不同 PartClass 的 Part 节点上的属性集合不同（cpu 有 CoreNum，drive 有 Speed），节点是"异构 schema"
2. **不支持二级索引**：无法在 (PartClass, 属性名, 值) 上做"以属性名查值"反向查询（用起来少）
3. **多值属性难**：如果一个属性有多个值（如 Part 的"接口类型"集合），只能序列化为字符串数组，失去属性索引能力
4. **属性变化代价高**：新增属性（如要给所有 drive 加 NoiseLevel）需遍历所有 Part 节点
5. **无法表达"值本身"的语义**：50 这个数字，可以是 GB 也可以是 TB，节点属性不会区分
6. **跨引擎迁移成本**：Cypher / GQL / SPARQL 之间的属性访问语法差异较大

### 2.4 配置查询场景的性能特点

```sql
-- 主场景：重量等于 10 / 大于等于 100
WHERE p.Weight = 10       -- 等值过滤：O(log N) 索引命中
WHERE p.Weight >= 100     -- 范围过滤：O(log N) range index 命中
```

实测参考（Neo4j 4.x/5.x + Property Index，1M Part 节点，单属性过滤）：

| 查询 | 索引命中 | 延迟 |
|------|---------|------|
| `MATCH (p:Part) WHERE p.Weight = 10` | 单值 B-tree | < 5 ms |
| `MATCH (p:Part) WHERE p.Weight >= 100` | range scan | 5~20 ms |
| `MATCH (p:Part) WHERE p.Weight BETWEEN 50 AND 150` | range scan | 10~30 ms |
| 跨 2 个属性 `Weight >= 100 AND Capacity >= 3` | composite index 更优 | 10~40 ms |

---

## 3. 方案 B：SpecValue 作为 Part → AttributeValue 节点的一条边

### 3.1 数据形态

```cypher
(:Part {code:'cpu1'})
    -[:HAS_SPEC {spec:'CoreNum',   unit:'core'}]->(:AttributeValue {value:2})
    -[:HAS_SPEC {spec:'Memory',    unit:'GB'}]->(:AttributeValue {value:123})
    -[:HAS_SPEC {spec:'ConfigType',unit:'-'}]->(:AttributeValue {value:2})

(:Attribute {code:'CoreNum', dataType:'INTEGER', unit:'core'})
(:Attribute {code:'Weight',  dataType:'DECIMAL', unit:'kg'})
```

```sparql
:cpu1 :hasSpec :sv_cpu1_core .   :sv_cpu1_core :spec "CoreNum" ; :value 2 .
```

### 3.2 优点

1. **属性 schema 稳定**：`Part` 节点没有属性，只有统一 `(p)-[:HAS_SPEC]->(av)-[:OF_ATTR]->(attr)` 三元结构
2. **多值属性自然**：一个 Part 可以对同一 Spec 出多条边（例：接口类型 = [USB, HDMI]）
3. **值的元数据可挂**：`(AttributeValue)-[:OF_ATTR]->(Attribute)` 上挂 unit / dataType / valueDomain，能反向校验
4. **跨类型统一查询**：「所有 SpecValue 中值=10 的对象」用一条 MATCH 即可跨 Part / ProductClass / SKU 等任意实体
5. **属性的版本/历史可挂**：在 `:HAS_SPEC` 边上挂 effectiveFrom / source，便于做"按时间过滤"
6. **W3C 标准原生**：RDF/OWL 模型本来就是"实体-属性-值"三元，Stardog 上 SHACL 校验天然支持

### 3.3 缺点

1. **属性过滤性能差**：`MATCH (p:Part)-[:HAS_SPEC]->(av {value:10})` 是图遍历，**不是**索引命中，需要做 (属性名, 值) 复合索引才能接近属性查询
2. **范围查询更慢**：要走边 + 节点属性扫描，除非在 `(HAS_SPEC.spec, av.value)` 上建复合索引
3. **存储翻倍**：每 SpecValue 多 1 节点 + 1 边，Part × SpecCount 的图规模
4. **跨属性过滤代码复杂**：「`Weight >= 100 AND Capacity >= 3`」要写两条 MATCH，性能是两次图遍历的叠加
5. **关系代数开销**：边遍历在 OLTP 查询中比属性访问慢 5~20 倍（经验值，依引擎而定）

### 3.4 配置查询场景的性能特点

```cypher
-- 主场景：重量等于 10 / 大于等于 100
MATCH (p:Part)-[:HAS_SPEC]->(av:AttributeValue)
WHERE av.spec = 'Weight' AND av.value = 10
-- 性能：取决于是否在 (spec, value) 上建索引。无索引：O(N)；有索引：O(log N)

MATCH (p:Part)-[:HAS_SPEC]->(av:AttributeValue)
WHERE av.spec = 'Weight' AND av.value >= 100
-- 范围扫描在属性图上需要显式建 composite index；纯边遍历无法用 range scan
```

---

## 4. 方案对比总表

| 维度 | 方案 A：属性 | 方案 B：边+节点 | 谁优 |
|------|-------------|----------------|------|
| **等值过滤** `Weight = 10` | 单值 B-tree 索引，O(log N) | 需复合索引 (spec, value) | A |
| **范围过滤** `Weight >= 100` | range scan，原生支持 | 需 composite index + range scan | A |
| **多属性过滤** `Weight >= 100 AND Capacity >= 3` | 两列 index + intersect | 两次 MATCH + 节点交集 | A |
| **跨类型统一查询**「所有值=10 的实体」 | 每种类型各写一次 | 一条 MATCH 即可 | B |
| **多值属性** | 序列化为数组，丧失索引 | 多个 `:HAS_SPEC` 边 | B |
| **属性 schema 演进** | 异构 schema，迁移难 | 节点结构稳定 | B |
| **值的元数据**（unit/dataType） | 不易挂载 | 天然可挂 | B |
| **W3C / SHACL 校验** | 需要额外表达 | RDF/OWL 原生 | B |
| **存储** | 紧凑 | 节点/边翻倍 | A |
| **写入** | 单次 `SET` | 多次 `CREATE` | A |
| **跨引擎迁移** | Cypher/GQL/SPARQL 差异 | 较一致 | B |

---

## 5. 对图数据库的能力要求

### 5.1 方案 A 要求

| 能力 | 说明 | 必要性 |
|------|------|------|
| **节点属性索引**（property index / schema index） | 单值等值过滤必须 | 必需 |
| **复合索引**（composite / multi-column index） | 多属性过滤必须 | 必需 |
| **范围索引**（range index） | `>=`、`<=`、`BETWEEN` 必须 | 必需 |
| **异构节点 schema 容忍** | 同一 Label 下节点属性可不同 | 必需 |
| **数据类型校验** | INTEGER/DECIMAL/STRING 等类型 | 推荐 |
| **JSON 序列化** | 部分异构属性序列化输出 | 可选 |

适用引擎：

| 引擎 | 方案 A 适配度 | 说明 |
|------|------------|------|
| **Neo4j Aura** | ⭐⭐⭐⭐⭐ | Property Index + Composite Index + Range Index 原生一等公民 |
| **Microsoft Fabric IQ** | ⭐⭐⭐⭐ | Graph item 是 LPG，等值/范围都支持，但复合索引能力弱于 Neo4j |
| **Stardog** | ⭐⭐⭐⭐ | 属性可建 predicate index + range；OWL DataProperty 表达规整 |
| **AbutionGraph** | ⭐⭐⭐⭐ | Edge + 属性索引，T/P/F 模型原生 |
| **TDengine IDMP** | ⭐⭐⭐ | Element + Attribute 三件套可表达，但本质是工业时序 |

### 5.2 方案 B 要求

| 能力 | 说明 | 必要性 |
|------|------|------|
| **节点 + 边遍历** | 图遍历基本能力 | 必需 |
| **复合索引 `(属性名, 值)`** | `(:HAS_SPEC {spec:'Weight'})-[]->(:AttributeValue {value:10})` 等值过滤 | 必需（否则慢到不可用） |
| **范围索引 `(属性名, 值范围)`** | `value >= 100` 走 range scan | 必需 |
| **多跳关系遍历** | 反向查询（值 → Spec → Part）需要 | 推荐 |
| **SHACL / OWL 校验** | 值域、单位、required 等 | 推荐 |
| **时序 / 历史** | SpecValue 在不同时间的值 | 可选 |

适用引擎：

| 引擎 | 方案 B 适配度 | 说明 |
|------|------------|------|
| **Stardog** | ⭐⭐⭐⭐⭐ | RDF/OWL 一等公民，predicate + reification 表达边属性，SHACL 校验原生 |
| **Microsoft Fabric IQ** | ⭐⭐⭐⭐ | Relationship Type + Mapping Table，但复合索引需要应用层配合 |
| **Neo4j Aura** | ⭐⭐⭐⭐ | 原生支持，但 `:HAS_SPEC` 边的 composite index 需要显式建 |
| **AbutionGraph** | ⭐⭐⭐⭐⭐ | Edge 原生带属性 + 边聚合独占能力 |
| **TDengine IDMP** | ⭐⭐ | Element Reference 跨树引用表达，但范围查询弱 |

---

## 6. 在我们配置查询主场景下的最终选择

### 6.1 主场景特征

我们的核心主场景是：

```sql
-- 主场景 1：等值过滤
MATCH (p:Part) WHERE p.Weight = 10

-- 主场景 2：范围过滤
MATCH (p:Part) WHERE p.Weight >= 100

-- 主场景 3：多属性组合过滤（产品配置器的实际场景）
MATCH (p:Part)
WHERE p.CoreNum = 4 AND p.Memory >= 512

-- 主场景 4：沿关系 + 属性过滤（客户配置 S1110 时的候选过滤）
MATCH (pi:ProductInstance {code:'S1110'})-[:OFFERS_PART]->(p:Part)
WHERE p.Capacity >= 5 AND p.Type = 'sd'
```

这些场景中，**所有过滤都是属性过滤**，且都需要：

1. 单属性等值
2. 单属性范围
3. 多属性 AND
4. 沿关系拿候选集 + 属性过滤

### 6.2 结论：方案 A 显著占优，但需要"边 + 节点"的混合补救

**主路径（90% 的配置查询）：采用方案 A**

- 范围/等值/复合过滤全部走索引，性能是方案 B 的 5~20 倍
- 与现有关系型业务库心智一致
- 与 cruleengine 的 `@DAttrAnno` 注解模型直接对位

**补救路径（10% 的复杂语义场景）：方案 B 的子集**

只在以下场景引入 `(Part)-[:HAS_SPEC]->(AttributeValue)` 边：

1. **多值属性**（如 Part 的接口集合 [USB, HDMI]）—— 序列化为数组后无法做单值过滤，必须用边
2. **值的元数据**（如单位 / 数据类型 / 校验规则要挂在值上）—— 属性方案只能挂在 Part 上，结构冗余
3. **值的版本/历史**（如 SpecValue 在不同 effectivePeriod 的值）—— 属性方案只能"覆盖写"，无法保留历史
4. **跨类型统一查询**（如"找所有值=10 的实体，包括 Part、ProductClass、SKU"）—— 属性方案需要按类型各写一次

**混合方案示意**：

```
Part (方案A 主路径)
├── 属性层 (node properties, 走索引)
│     ├── CoreNum: 4
│     ├── Memory: 256
│     ├── Capacity: 3
│     ├── Type: 'sd'
│     └── Weight: 10
│
└── 边层 (方案B 补救，仅在需要时)
      ├── -[:HAS_MULTIVALUED_ATTR]->(:MultiValuedAttrSet)   -- 接口集合等
      ├── -[:HAS_SPEC_WITH_META]->(:AttributeValue)-[:OF_ATTR]->(:Attribute)  -- 带元数据
      └── -[:HAS_SPEC_HISTORY]->(:AttributeValueHistory)   -- 历史值
```

### 6.3 决策矩阵

| 你的核心主场景 | 建议 | 备注 |
|---------------|------|------|
| **主要是范围/等值过滤**（重量 ≥ 100） | **方案 A** | 索引覆盖，性能最高 |
| **主要是多值 / 元数据 / 历史** | **方案 B** 或 **混合方案** | 单值过滤慢 5~20 倍是代价 |
| **跨类型统一查询**（"所有值=10 的对象"） | **方案 B** 或 **混合方案** | 单一 MATCH 跨多类型 |
| **配置求解 + 沿关系过滤**（S1110 候选 + 重量过滤） | **方案 A** | 沿 OFFERS_PART 边拿到候选后，在属性层一步过滤 |
| **多 W3C 形式化校验** | **方案 B** | SHACL 在 RDF 上原生 |
| **两种都不可少** | **混合方案** | 90% 主路径走 A，10% 复杂场景走 B |

---

## 7. 与现有方案的衔接

- docs3 §1.4 / §2.2 中的 `SpecValue` 表是**方案 A 的关系型落地**，与方案 A 的图建模一致：SpecValue 是挂在 Part / ProductClass 上的属性（或独立行承载）。
- docs3 §4.2 概念映射表中的 `SpecValue → dynAttr value` 也是方案 A 的体现：dynAttr value 是 Part 上的属性，不是独立节点。
- **如果引入方案 B 的部分元素**，需要补充：`Attribute`（规格元数据节点）、`AttributeValue`（规格值节点）、`(:Part)-[:HAS_SPEC]->(:AttributeValue)` 边。建议仅在电商 SKU 扁平化场景下引入。

---

## 8. 与备选方案 B 的协同

本章（备选方案 A）与**备选方案 B：LinkType 多属性建模**（docs3/备选方案B-Part规格值的图建模-属性vs边.md）是两个正交的设计决策：

| 维度 | 本章 SpecValue 的属性 vs 边 | 备选方案 B 边 LinkType 的多属性 |
|------|--------------------------|------------------------|
| **核心问题** | SpecValue 是 Part 的属性还是 Part→AttributeValue 边 | ProductInstance→Part 边是单边多属性还是每边一属性 |
| **主路径建议** | 方案 A（属性） | 方案 B（单边多属性） |
| **补救路径** | 方案 B（边）用于多值/元数据/历史 | 方案 A（每边一属性）用于跨集合查询/推理 |
| **核心诉求** | 范围/等值过滤性能 | 边数紧凑 + 单条 MATCH 多属性 |

**整体策略**：

- 在「Part 自身」的属性维度上，倾向于把属性做扁（属性层）
- 在「Part 之间的关联」维度上，倾向于把关联做紧（单边多属性）
- 整个图模型呈现"节点属性紧凑 + 边属性紧凑"的双紧凑结构
