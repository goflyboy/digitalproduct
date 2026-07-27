# 备选方案 B：ProductInstance→Part 边的多属性建模（每边一属性 vs. 单边多属性）

> **文档版本**: v1.0
> **创建时间**: 2026-07-28
> **来源章节**: docs3/复杂产品配置器的数据模型.md §六
> **适用场景**: 复杂产品（服务器、PLC、工业设备等）配置场景下，ProductInstance→Part 边的属性（enabled / defaultSelected / minQty / maxQty / fixed 等）应建模为单边多属性还是每边一属性

---

## 章节定位

前文 docs3 §1.4 / §4.2 已采用「边属性一等公民」建模（offersPart 边携带 enabled / defaultSelected / minQty / maxQty / fixed 五个属性）。本章作为**备选方案**专门论证：在产品配置场景下，ProductInstance→Part 边（或更一般的 LinkType）到底应不应该承载多个属性？这是另一个独立的建模决策，与**备选方案 A：Part 规格值的属性 vs 边**（docs3/备选方案A-Part规格值的图建模-属性vs边.md）正交。

---

## 1. 产品配置场景下的 LinkType 多属性问题

### 1.1 真实场景中的边属性诉求

在 `MultiPCTest` 场景中，`ProductInstance → Part` 这条边（对应 cruleengine 的 `PartCategoryInst`）已经承载了 5 个属性：

| 属性 | 含义 | 示例 |
|------|------|------|
| `enabled` | 是否启用该 Part | S1110 启用 cpu1，禁用 cpu3 |
| `defaultSelected` | 默认是否选中 | S1110 默认选中 cpu1 |
| `minQty` | 最小数量 | cpu1 minQty=1 |
| `maxQty` | 最大数量 | cpu1 maxQty=1 |
| `fixed` | 是否固定不可改 | cpu1 固定 |

但实际产品配置场景中，ProductInstance→Part 边可能还需要承载：

| 扩展属性 | 含义 | 业务诉求 |
|---------|------|---------|
| `effectiveFrom` / `effectiveTo` | 边属性有效期 | 季节性 SKU 临时上线 |
| `priority` | 选中优先级 | 同 PartClass 下多个候选时的选中顺序 |
| `compatibilityGroup` | 兼容性分组 | 与其他 Part 的兼容性规则 |
| `pricingTier` | 阶梯定价 | 数量 > 阈值时折扣比例 |
| `constraintRule` | 附加约束 | "必须搭配 >= 8GB 内存" |
| `lastModified` | 修改时间 | 审计/版本追溯 |
| `modifiedBy` | 修改人 | 多人协作审计 |
| `source` | 数据来源 | 主数据 / 临时配置 / 自动生成 |

> **核心问题**：当边属性从 5 个增长到 10+ 个时，应保持"每边一属性"（一个边只承载一个属性），还是用"单边多属性"（一条边承载所有属性）？

### 1.2 两种方案的呈现

**方案 A：W3C 标准方案（每边一属性）**

```sparql
# 每个属性拆成一条独立的边
:PI_S1110 :hasPart :cpu1 .
:PI_S1110 :hasPartEnabled :cpu1 .          # cpu1 enabled
:PI_S1110 :hasPartDefault :cpu1 .          # cpu1 defaultSelected
:PI_S1110 :hasPartMinQty :cpu1 .           # cpu1 minQty=1
:PI_S1110 :hasPartMaxQty :cpu1 .           # cpu1 maxQty=1
:PI_S1110 :hasPartFixed :cpu1 .            # cpu1 fixed=false
:PI_S1110 :hasPart :cpu2 .
:PI_S1110 :hasPartEnabled :cpu2 .
# ... 每个 Part × 每个属性 = 一条独立边
```

**方案 B：业界主流方案（单边多属性）**

```sparql
# 一条边承载全部属性，属性挂在边上
:PI_S1110 :hasPart [
    :targetPart :cpu1 ;
    :partEnabled true ;
    :partDefault true ;
    :partMinQty 1 ;
    :partMaxQty 1 ;
    :partFixed false ;
] .

# 或 RDF Reification
:PI_S1110 :hasPart :cpu1 .
_:edge1 rdf:subject :PI_S1110 ; rdf:predicate :hasPart ; rdf:object :cpu1 ;
        :partEnabled true ; :partDefault true ; :partMinQty 1 ; :partMaxQty 1 .
```

```cypher
# Neo4j / Fabric IQ LPG 的原生表达
(PI_S1110)-[:OFFERS_PART {
    enabled: true,
    defaultSelected: true,
    minQty: 1,
    maxQty: 1,
    fixed: false,
    effectiveFrom: '2026-01-01',
    priority: 10
}]->(cpu1)
```

---

## 2. 方案 A：W3C 标准方案（每边一属性）

### 2.1 对图的具体要求

| 能力要求 | 说明 | 必要性 |
|---------|------|-------|
| **边类型数量** | 一个业务边（如"hasPart"）需要拆成 N 个 ObjectProperty | 必需 |
| **属性值与节点分离** | `hasPart` 边连接 PI 和 Part，其他边（hasPartEnabled）连接同一对节点但只承载值 | 必需 |
| **多重边支持** | 同一对节点之间允许多条不同类型边 | 必需 |
| **丰富的属性类型** | 每个 ObjectProperty 都是一等公民，可挂 range / domain / cardinality | 推荐 |
| **推理 + 一致性** | RDF/OWL 推理器能识别多重边并推导约束 | 推荐 |
| **SPARQL Property Path** | 复杂查询用 `pi :hasPart*/:hasPartEnabled ?e` 表达"边上的边" | 必需 |

适用引擎：

| 引擎 | 方案 A 适配度 | 说明 |
|------|------------|------|
| **Stardog** | ⭐⭐⭐⭐⭐ | RDF 多重边原生；OWL ObjectProperty 数量无限制；对 SPARQL 1.1 Property Path 完整支持 |
| **Microsoft Fabric IQ** | ⭐⭐ | Relationship Type 一对一对齐 Graph 边；属性挂在 Mapping Table 上，**且每个 Relationship Type 只能挂映射表**（不是真正的边属性） |
| **Neo4j Aura** | ⭐⭐ | 节点对可以有多条同名 Relationship，但把"每边一属性"拆成 N 条边后，Relationship Type 数量爆炸（multiplicative blowup） |
| **AbutionGraph** | ⭐⭐⭐⭐ | Edge 支持多 Predicate，但拆分后 Type 数量翻倍 |
| **TDengine IDMP** | ⭐ | Element Reference 不支持边属性 |

### 2.2 对查询精确性的诉求

| 查询诉求 | 方案 A 表达 | 精确性 |
|---------|------------|-------|
| 「PI_S1110 启用哪些 Part」 | `?pi :hasPartEnabled true , :Part` | 精确 |
| 「PI_S1110 启用且默认选中的 Part」 | `?pi :hasPartEnabled true ; :hasPartDefault true , :Part` | 精确 |
| 「PI_S1110 数量边界最宽的 Part」 | `?pi :hasPartMaxQty > 5 , :Part` | 精确 |
| 「所有满足 maxQty>5 的边，无论 PI」 | `?s :hasPartMaxQty ?q . FILTER(?q>5)` | 精确 |
| 「PI→Part 边 + 所有属性一次性取出」 | 需 5 条 Pattern 拼接（多跳 / Unbound 变量） | 较复杂 |
| 「PI→Part 边 + 边属性 + 跨 PartClass 推理」 | SPARQL 推理 + ObjectProperty 链 | 推理友好 |

### 2.3 优点

1. **W3C 标准原生**：RDF/OWL 模型本身是"三元组无边属性"，每边一属性是规范表达
2. **推理最友好**：每个属性边是独立 ObjectProperty，OWL reasoner 可以独立推理每个属性的约束
3. **属性可独立治理**：每个属性边有独立的 schema / valueDomain / range，可以独立做 SHACL 校验
4. **跨集合操作容易**：「所有 `hasPartMaxQty>5` 的边」用一条 SPARQL 即可，不论 PI
5. **细粒度权限**：可以对某条属性边单独授权，例如"某角色只能看 enabled，不能看 minQty"
6. **演化容易**：增加新属性 = 新增一条 ObjectProperty，不影响现有边
7. **与备选方案 A 方案 B 天然对齐**：如果备选方案 A 用方案 B 把 SpecValue 拆成边，那么本章也用方案 A 把 LinkType 属性拆成边，整个图模型在结构上完全一致

### 2.4 缺点

1. **图的体积爆炸**：N 个属性 × M 个 Part × K 个 PI = N×M×K 条边
   - 1000 PI × 10 Part/PI × 8 属性 = 80,000 条额外边
   - 10000 PI × 10 Part × 8 = 800,000 条边
   - 与"单边多属性"相比，边数膨胀 5~10 倍
2. **非关键信息冗余**：enabled=true / defaultSelected=false 这种信息占据了与有效负载相同数量的边
3. **多跳查询低效**：「PI→Part 边 + 5 个属性」查询需要 6 条 MATCH（每个属性一条边），比"单边多属性"多 5~6 倍 pattern
4. **写入复杂**：更新一个属性边 = 删旧边 + 增新边（多条 SPI 操作）；不支持原子地"修改一个边的多个属性"
5. **跨属性过滤需要 Multiple Pattern**：`WHERE (?p :hasPartEnabled true) (?p :hasPartMaxQty ?q) FILTER(?q>5)` 比单边多属性 `WHERE edge.maxQty > 5` 复杂
6. **与现有 cruleengine 模型不对位**：cruleengine 的 `PartCategoryInst` 就是单边多属性（一个 PartCategoryInst 节点带 Q/H/S 多个属性），拆分后无法直接编译

---

## 3. 方案 B：业界主流方案（单边多属性）

### 3.1 对图的具体要求

| 能力要求 | 说明 | 必要性 |
|---------|------|-------|
| **边属性（属性图）一等公民** | 边直接挂属性，无需 reification | 必需 |
| **复合索引（边属性 + 目标节点）** | 跨边属性 + 目标节点查询 | 必需 |
| **范围索引（边属性上）** | `WHERE edge.maxQty > 5` 走 range scan | 必需 |
| **跨边属性 AND 过滤** | 单条 MATCH 内多个属性过滤 | 必需 |
| **关系属性版本管理** | 边属性自身的版本/历史 | 推荐 |
| **边属性写入原子性** | 单条边属性更新要么全成要么全败 | 必需 |
| **边属性 schema 校验** | SHACL / 数据类型 / required | 推荐 |

适用引擎：

| 引擎 | 方案 B 适配度 | 说明 |
|------|------------|------|
| **Neo4j Aura** | ⭐⭐⭐⭐⭐ | 属性图边属性是一等公民；composite index + range index 原生 |
| **Microsoft Fabric IQ** | ⭐⭐⭐⭐ | Relationship Type 自带 relationship property（关系属性），可挂属性 |
| **AbutionGraph** | ⭐⭐⭐⭐⭐ | Edge 原生带属性 + 边聚合独有能力 |
| **Stardog** | ⭐⭐⭐⭐ | 需要 Reification / Named Graph 实现边属性，对 SPARQL 不够透明 |
| **TDengine IDMP** | ⭐⭐ | Element Reference 不支持边属性 |

### 3.2 对查询精确性的诉求

| 查询诉求 | 方案 B 表达 | 精确性 |
|---------|------------|-------|
| 「PI_S1110 启用哪些 Part」 | `MATCH (pi)-[r:OFFERS_PART]->(p) WHERE r.enabled = true` | 精确 |
| 「PI_S1110 启用且默认选中的 Part」 | `MATCH (pi)-[r:OFFERS_PART]->(p) WHERE r.enabled = true AND r.defaultSelected = true` | 精确 |
| 「PI_S1110 数量边界最宽的 Part」 | `MATCH (pi)-[r:OFFERS_PART]->(p) WHERE r.maxQty > 5` | 精确 |
| 「所有满足 maxQty>5 的边，无论 PI」 | `MATCH ()-[r:OFFERS_PART]->() WHERE r.maxQty > 5` | 精确 |
| 「PI→Part 边 + 所有属性一次性取出」 | 一次 MATCH 拿所有属性 | 最简 |
| 「PI→Part 边 + 边属性 + 跨 PartClass 推理」 | 不依赖 OWL 推理，靠业务规则 | 推理较弱 |

### 3.3 优点

1. **边的数量最少**：N 个属性 × M 个 Part × K 个 PI = N×M×K 节点对，单条边承载所有属性
   - 1000 PI × 10 Part/PI = 10,000 条边（与方案 A 的 80,000 对比是 8 倍差距）
2. **多属性查询高效**：单条 MATCH 拿到所有属性，无多次 pattern
3. **范围查询高效**：`edge.maxQty > 5` 走 range index，与节点属性查询等价
4. **写入简单**：更新一个属性 = 一次 `SET edge.maxQty = 5`
5. **原子性强**：单边多属性更新是单条 update statement，原子完成
6. **与 cruleengine 直接对位**：cruleengine 的 `PartCategoryInst` 节点天然就是单边多属性的中间节点
7. **业务心智简单**：业务人员理解"一条边 + 多个属性"远比"5 条平行边"直观

### 3.4 缺点

1. **属性间不能独立推理**：OWL reasoner 不能对 5 个属性分别做属性链推理（除非拆成 5 条边）
2. **属性间不能独立 SHACL 校验**：要把 5 个属性合并到一个 NodeShape / PropertyShape
3. **属性间不能用 Property Path 表达关系**：例如 `OFFERS_PART/hasPartMaxQty` 不能表达"边属性的边"
4. **跨集合反向查询复杂**：单边多属性下，要找"所有 enabled=true 的边"统一遍历所有 PI，性能较差
5. **细粒度权限较难**：5 个属性共用一条边，权限只能"边可见/不可见"，不能"只可见 enabled"
6. **新属性加入需要 schema 升级**：增加一个属性 = schema 改动，影响所有 PI
7. **属性稀疏问题**：如果一个属性对 99% 的边都是默认值，会浪费存储空间（但属性图不显式存默认值，所以这点影响小）

---

## 4. 方案对比总表

| 维度 | 方案 A：W3C 每边一属性 | 方案 B：单边多属性 | 谁优 |
|------|---------------------|-------------------|------|
| **图的体积** | 边数 × N（属性数） | 边数 × 1 | B |
| **多属性同查** | 多次 Pattern 拼接 | 单次 MATCH | B |
| **范围查询** | 走 ObjectProperty 索引 | 走边属性 range index | B（性能相当） |
| **推理 / SHACL** | 每个属性独立规则 | 合并为一个 NodeShape | A |
| **跨属性约束** | 用 SPARQL/Bind 表达 | 一次性 WHERE | B |
| **原子写入** | 多边拆写 | 一次 SET | B |
| **细粒度权限** | 单边属性授权 | 仅有边级授权 | A |
| **演化** | 新 ObjectProperty 不影响旧 | 需 schema 升级 | A |
| **与 cruleengine 对位** | 需 reification 转换 | 直接对应 PartCategoryInst | B |
| **W3C 标准** | 原生 | 需 reification | A |
| **业务心智** | 复杂（多边对应一个属性） | 简单（一边多属性） | B |
| **稀疏属性** | 边数膨胀严重 | 紧凑 | B |

---

## 5. 在我们产品配置场景下的最终选择

### 5.1 产品配置场景的特征

我们的核心主场景是：

1. **配置查询**：`MATCH (pi:ProductInstance)-[r:OFFERS_PART]->(p:Part) WHERE r.enabled = true AND r.minQty >= 1` — 单条 MATCH 跨多属性
2. **配置求解**：沿 `OFFERS_PART` 边拿候选 + 多属性过滤 → 选最优 Part 组合
3. **跨 PI 反向查询**：`MATCH ()-[r:OFFERS_PART]->(p:Part {code:'cpu2'}) WHERE r.enabled = true` — 找所有启用 cpu2 的 PI
4. **批量更新**：`MATCH (pi)-[r:OFFERS_PART]->(p) WHERE p.PartClass = 'cpu' SET r.lastModified = datetime()` — 批量改边属性
5. **审计与历史**：`r.modifiedBy` / `r.lastModified` — 边属性即可承载
6. **属性数量**：当前 5 个 + 扩展到 8~10 个

### 5.2 结论：方案 B 显著占优，但保留方案 A 的部分能力

**主路径（90% 的配置查询）：采用方案 B（单边多属性）**

- 边数减少 5~8 倍，存储/查询性能都是最优
- 与现有 cruleengine 的 `PartCategoryInst` 节点直接对位
- 与备选方案 A 方案 A（SpecValue 作为节点属性）风格一致：都是"扁平化 + 走索引"
- 单条 MATCH 拿全部属性，符合业务查询习惯

**补救路径（10% 的复杂语义场景）：方案 A 的部分元素**

只在以下场景下，把部分关键属性拆成独立边：

1. **跨集合反向查询频繁的属性**（如 `OFFERS_PART_ENABLED`）：频繁需要"找所有 enabled 的边"时，单独建边 + 索引
2. **推理 / SHACL 校验复杂的属性**（如 `constraintRule`）：需要 OWL 推理时，作为独立 ObjectProperty
3. **细粒度权限要求的属性**（如 `pricingTier` 商家只能看自己）：单独的 ObjectProperty 能更细粒度授权

**混合方案示意**：

```
ProductInstance → Part 边（主路径：方案 B 单边多属性）
├── 边属性: enabled, defaultSelected, minQty, maxQty, fixed, priority, lastModified, modifiedBy
│
└── 关键属性单独边（补救：方案 A 适用于频繁跨集合查询的属性）
      ├── -[:HAS_ENABLED]->(:Part)              # 频繁查询 "所有启用的边"
      ├── -[:HAS_DEFAULT_SELECTED]->(:Part)     # 频繁查询 "所有默认选中的边"
      └── -[:HAS_CONSTRAINT]->(:ConstraintRule) # 推理 / SHACL 复杂
```

主路径用方案 B（单边多属性），关键属性再额外独立建边（方案 A 的子集）。这种"主 B + 补救 A"的混合方案，兼顾性能和语义。

### 5.3 决策矩阵

| 你的核心场景 | 建议 | 备注 |
|-------------|------|------|
| **配置查询为主，单条 MATCH 多属性过滤** | **方案 B** | 性能最高，边数最少 |
| **跨集合反向查询频繁**（"所有 enabled 的边"） | **方案 A** 或 **混合方案** | 单独建边 + 索引 |
| **OWL 推理 / SHACL 强校验** | **方案 A** | 独立 ObjectProperty 推理友好 |
| **细粒度权限**（不同角色看不同属性） | **方案 A** | 边级 vs 属性级权限 |
| **与 cruleengine 直接对位** | **方案 B** | PartCategoryInst 直接对应 |
| **边属性 ≥ 8 个** | **方案 B** | 边数膨胀成本太高 |
| **W3C 标准强制合规** | **方案 A** | 须 reification 表达 |
| **业务心智简单优先** | **方案 B** | 一边多属性更直观 |

---

## 6. 与备选方案 A 的协同

本章（备选方案 B）与**备选方案 A：Part 规格值的属性 vs 边**（docs3/备选方案A-Part规格值的图建模-属性vs边.md）是两个正交的设计决策：

| 维度 | 备选方案 A SpecValue 的属性 vs 边 | 本章 边 LinkType 的多属性 |
|------|--------------------------|------------------------|
| **核心问题** | SpecValue 是 Part 的属性还是 Part→AttributeValue 边 | ProductInstance→Part 边是单边多属性还是每边一属性 |
| **主路径建议** | 方案 A（属性） | 方案 B（单边多属性） |
| **补救路径** | 方案 B（边）用于多值/元数据/历史 | 方案 A（每边一属性）用于跨集合查询/推理 |
| **核心诉求** | 范围/等值过滤性能 | 边数紧凑 + 单条 MATCH 多属性 |

**整体策略**：

- 在「Part 自身」的属性维度上，倾向于把属性做扁（属性层）
- 在「Part 之间的关联」维度上，倾向于把关联做紧（单边多属性）
- 整个图模型呈现"节点属性紧凑 + 边属性紧凑"的双紧凑结构，性能与可维护性兼得

---

## 7. 与现有方案的衔接

- docs3 §1.4 / §4.2 中的 `offersPart` 边（携带 enabled / defaultSelected / minQty / maxQty / fixed）就是**方案 B（单边多属性）**的体现
- docs3 §4.3 / §4.2 中 `ConfigurationSolution → ConfiguredPart` 的对应关系也是方案 B
- **保留方案 A 的部分能力**：当备选方案 A 引入方案 B（属性作为边）时，本章的 "HAS_SPEC" 关系也需要承载 `effectiveFrom` / `source` 等属性，此时建议用方案 B（单边多属性）在边属性上挂这些元数据
- **混合方案是最终推荐**：90% 主路径用方案 B，关键属性（`enabled` / `constraintRule`）单独建边作为方案 A 的子集
