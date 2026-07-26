# 图业界 Ontology 类产品调研与电商/复杂产品建模适配分析

> **文档版本**: v1.0（基于复杂产品配置器数据模型 v1.1 + Palantir 电商方案 v1.0）
> **创建时间**: 2026-07-27
> **核心主题**: 商用/开源 Ontology 类产品调研，按 SpecDefinition/Parameter 区分视角评估适配度
> **关联文档**:
> - `docs3/复杂产品配置器的数据模型.md`（复杂产品配置器数据模型 v1.1）
> - `docs4/Palantir范式电商语义建模方案.md`（电商语义模型 v1.0）
> - `docs/图业界Ontology产品调研与Palantir电商适配分析.md`（v1.3，原始调研）

---

## 一、核心结论

针对「规格（SpecDefinition/SpecValue）vs 参数（Parameter）区分 + ProductClass 自身有规格值 + offersPart 裁剪 + realizes 关系」的复杂产品/电商语义模型：

| 排名 | 产品 | 适配评分 | 一句话定位 |
|------|------|---------|-----------|
| 1 | **Microsoft Fabric IQ** | ⭐⭐⭐⭐⭐ | Entity Type + Relationship 原生，Ontology item 直接映射 ProductClass/SPU/SKU，Relationship 带属性映射 offersPart 裁剪 |
| 2 | **Stardog** | ⭐⭐⭐⭐⭐ | RDF/OWL 一等公民，SpecDefinition 可用 SHACL NodeShape，Parameter 可编译为 Para 类，Virtual Graph 联邦外部数据 |
| 3 | **Neo4j Aura + Aura Agent** | ⭐⭐⭐⭐ | 属性图原生支持 SpecValue，Parameter 可用 Cypher 查询参数化，边属性原生支持 offersPart |
| 4 | **AbutionGraph** | ⭐⭐⭐⭐ | T/P/F/Agg/Action 直接对位，Edge 原生带属性，Function/Action 一等公民，国产信创 |
| 5 | **TDengine IDMP** | ⭐⭐⭐（条件性） | 工业本体的 Element/Attribute/Event 三件套，适合工业品/设备边界品类 |

---

## 二、核心能力诉求

本文档评估的核心能力来自 docs3（复杂产品）和 docs4（电商）的共同建模需求：

### 2.1 SpecDefinition / SpecValue 能力

| 能力 | 在 docs3/4 中的体现 |
|------|-------------------|
| 属性类型定义 | SpecDefinition 定义在 ProductClassType / PartClassType / SPUType / SKUType 上 |
| 属性值存储 | SpecValue 既挂在 Part 上也挂在 ProductClass 上（FormFactor、PowerSupply 等） |
| 属性类型校验 | data_type / value_domain / unit 校验 |
| 属性继承 | PartClass 继承 PartClassType 的规格，SKU 继承 SPU 的规格 |

### 2.2 Parameter 能力

| 能力 | 在 docs3/4 中的体现 |
|------|-------------------|
| 用户输入参数定义 | Parameter 定义在 PartClassType / SPUType / MerchantType 上 |
| 参数无实例值 | Part / SKU 上没有 Parameter 值，值在 Configuration 中输入 |
| 参数过滤/聚合 | Sum_Capacity >= 5、Sum_Memory >= 512 等聚合条件 |
| 参数驱动求解 | Parameter 输入后引擎求解最优 Part/SKU 组合 |

### 2.3 关系与裁剪能力

| 能力 | 在 docs3/4 中的体现 |
|------|-------------------|
| offersPart 边属性 | ProductInstance → Part 的 offersPart 边携带 enabled / disabled / defaultSelected / minQty / maxQty / fixed |
| realizes 关系 | ProductInstance → ProductClass（ProductInstance 自带 version） |
| realizes 关系（电商） | MerchantSKU → SPU（MerchantSKU 自带 version） |
| parentOf 自连接 | Category 品类树的 parentOf 自连接 |
| 递归结构 | PartClass 的 recursive 组成关系 |

---

## 三、Top 5 候选产品详细分析

### 3.1 Microsoft Fabric IQ — ⭐⭐⭐⭐⭐

**定位**：Microsoft 对标 Palantir Foundry 的 Ontology 产品，GA 于 2026 年 6 月（Ontology 仍 Preview）。

**SpecDefinition / SpecValue 适配**：

| docs3/4 概念 | Fabric IQ 对位 | 适配说明 |
|-------------|--------------|---------|
| SpecDefinition | Entity Type Property | 直接支持，data_type / unit 对应 |
| SpecValue | Entity Instance Property Values | 绑定 OneLake 表后自动承载 |
| ProductClass 带规格值 | Entity Type 自身属性 | ProductClass Entity 可以有自己的 Property Values（如 FormFactor=2U） |
| Part 带规格值 | Part Entity 实例属性 | Part Entity 的属性值完全映射 |

**Parameter 适配**：

| docs3/4 概念 | Fabric IQ 对位 | 适配说明 |
|-------------|--------------|---------|
| Parameter | Configurable Property / Rule Parameter | 通过 Activator 或应用层实现 |
| Parameter 输入 | Configuration 表 | OneLake 配置表存储 |
| 参数过滤/聚合 | GQL 聚合查询 | Graph item 支持 GQL 聚合 |

**关系与裁剪适配**：

| docs3/4 概念 | Fabric IQ 对位 | 适配说明 |
|-------------|--------------|---------|
| offersPart 边属性 | Relationship Type + 映射表属性 | offersPart 用映射表承载 enabled/defaultSelected/minQty 等属性 |
| realizes 关系 | Relationship Type | ProductInstance → ProductClass 的 realizes 关系直接映射 |
| parentOf 自连接 | Relationship Type 自连接 | Category.parentOf 用同一张映射表实现 |
| 版本 | Entity Type 自带 version | 通过 Entity Type version 或外部版本表管理 |

**关键优势**：
- Entity Type + Relationship Type 与 docs3 的 ProductClassType / PartClassType / offersPart 完全同构
- OneLake Lakehouse 直接承载 SpecValue 数据，无需额外 ETL
- Fabric Activator 可实现 Parameter 驱动的规则触发
- Data Agent / Operations Agent 可对接 Agent 消费

**关键短板**：
- Ontology 仍 Preview，企业级功能可能变化
- 必须绑定 Microsoft Fabric 生态
- Parameter 的"无 Part 值"语义需要应用层实现

### 3.2 Stardog — ⭐⭐⭐⭐⭐

**定位**：企业级 RDF/OWL 知识图谱，LinkType 天然一等公民。

**SpecDefinition / SpecValue 适配**：

| docs3/4 概念 | Stardog 对位 | 适配说明 |
|-------------|--------------|---------|
| SpecDefinition | OWL Class + DataProperty / ObjectProperty | data_type / value_domain 可用 SHACL 表达 |
| SpecValue | RDF Individual 的属性值 | 完整支持 |
| ProductClass 带规格值 | Class Individual 的属性 | ProductClass 实例可以有自己的 Property Values |
| 属性类型校验 | SHACL PropertyShape | value_domain / min / max / required 完全支持 |

**Parameter 适配**：

| docs3/4 概念 | Stardog 对位 | 适配说明 |
|-------------|--------------|---------|
| Parameter | SHACL Parameter / SPARQL 变量 | Parameter 定义可编译为 Para 类 |
| 参数无 Part 值 | Individual 上无 Parameter Property | 语义完全一致 |
| 参数过滤/聚合 | SPARQL FILTER / AGGREGATE | 完整支持 Sum / Count / Filter |
| 参数驱动求解 | SPARQL 查询 + 推理 | 可编译为规则引擎输入 |

**关系与裁剪适配**：

| docs3/4 概念 | Stardog 对位 | 适配说明 |
|-------------|--------------|---------|
| offersPart 边属性 | Named Graph + reification 或 OWL Annotation | 边属性通过 reification 承载 enabled / defaultSelected 等 |
| realizes 关系 | ObjectProperty | 直接映射为 OWL ObjectProperty |
| parentOf 自连接 | rdfs:subClassOf 或自连接 ObjectProperty | 品类树直接表达 |
| 版本 | Named Graph 或 owl:versionInfo | ProductClass 自带 version 通过 Graph 隔离实现 |

**关键优势**：
- RDF/OWL 是 SpecDefinition 最标准的表达方式
- SHACL 校验是 data_type / value_domain / required 的最强实现
- Virtual Graph 可联邦外部 MySQL/MongoDB，无需 ETL
- Stardog Voicebox + MCP 支持 Agent 消费

**关键短板**：
- Parameter 的"无 Part 值"语义需要应用层约定
- offersPart 边属性的实现比属性图复杂

### 3.3 Neo4j Aura + Aura Agent — ⭐⭐⭐⭐

**定位**：全球最大的原生属性图，2026 年 Aura Agent GA。

**SpecDefinition / SpecValue 适配**：

| docs3/4 概念 | Neo4j 对位 | 适配说明 |
|-------------|--------------|---------|
| SpecDefinition | Node Property | 直接支持，label 对应类型 |
| SpecValue | Node Property Values | 完整支持 |
| ProductClass 带规格值 | Node 自身属性 | ProductClass 节点可有自己的属性值 |
| 属性类型校验 | Cypher 约束或外层校验 | 需要应用层配合 |

**Parameter 适配**：

| docs3/4 概念 | Neo4j 对位 | 适配说明 |
|-------------|--------------|---------|
| Parameter | 查询参数或节点属性 | Parameter 值存储在 Configuration 节点上 |
| 参数无 Part 值 | Part 节点无 Parameter 属性 | 语义一致 |
| 参数过滤/聚合 | Cypher WITH / WHERE / RETURN | 完整支持 |

**关系与裁剪适配**：

| docs3/4 概念 | Neo4j 对位 | 适配说明 |
|-------------|--------------|---------|
| offersPart 边属性 | Relationship Type + Property | **原生支持**，这是 Neo4j 核心优势 |
| realizes 关系 | Relationship Type | 直接映射 |
| parentOf 自连接 | 自连接 Relationship | 直接实现 |
| 版本 | Node 属性 + 时间戳 | 需自行维护 |

**关键优势**：
- **属性图边属性原生一等公民**：offersPart 的 enabled / disabled / defaultSelected / minQty / maxQty / fixed 直接存储在 Relationship Properties 上，**最符合 docs3 的语义**
- Aura Agent 一键部署 MCP，GraphRAG 成熟
- Cypher 是最广泛使用的图查询语言，生态成熟

**关键短板**：
- 没有原生 ObjectType/LinkType Schema 引擎，Schema 校验要靠 Cypher 约束或应用层
- Parameter 语义需要约定（Part 上无 Parameter 属性）
- OWL/RDF 推理需要外接 reasoner

### 3.4 AbutionGraph — ⭐⭐⭐⭐

**定位**：国产原生本体数据库，国产信创，明确对标 Palantir 路线。

**SpecDefinition / SpecValue 适配**：

| docs3/4 概念 | AbutionGraph 对位 | 适配说明 |
|-------------|------------------|---------|
| SpecDefinition | Type (T) + Predicate (P) | 直接对应 |
| SpecValue | Entity Property Values | 完整支持 |
| ProductClass 带规格值 | Entity 自身属性 | 完全支持 |
| Function 类型 | AggregateFunction / TransformFunction | 支持派生属性 |

**Parameter 适配**：

| docs3/4 概念 | AbutionGraph 对位 | 适配说明 |
|-------------|------------------|---------|
| Parameter | Configurable Predicate / Rule Parameter | 通过 Rule 或 Function 实现 |
| 参数过滤/聚合 | AggregateFunction 原生 | 内置 Min/Max/Sum/Hll/Count |
| 参数驱动求解 | Query 内嵌 Function | 核心架构创新 |

**关系与裁剪适配**：

| docs3/4 概念 | AbutionGraph 对位 | 适配说明 |
|-------------|------------------|---------|
| offersPart 边属性 | Edge 原生带属性 + 边聚合 | **原生支持**，边属性是核心卖点 |
| realizes 关系 | Edge 或 Reference | 直接映射 |
| Action | ActionFunction | Schema 一等公民，状态变更自动触发 |
| 版本 | 自带 version 机制 | 通过 Function 维护 |

**关键优势**：
- Edge 原生带属性，offersPart 裁剪边属性完全支持
- ActionFunction 直接对位 Parameter 驱动的配置求解
- T/P/F/Agg/Action 五位一体，对位 docs3 的完整语义
- OntoFlow MCP 一键发布，Agent 工具链完整
- 国产信创，部署灵活

**关键短板**：
- 主动放弃 OWL/RDF，SHACL 校验需自建
- 生态规模较小，生产案例有限
- Parameter 的"无 Part 值"语义需要应用层约定

### 3.5 TDengine IDMP — ⭐⭐⭐（条件性）

**定位**：工业本体的开源实现，适合工业品/设备边界品类。

**适配说明**：

| docs3/4 概念 | TDengine IDMP 对位 | 适配说明 |
|-------------|-------------------|---------|
| SpecDefinition | Element Attribute | 原生支持 Element + Attribute |
| SpecValue | Element Instance Attribute Values | 完整支持 |
| ProductClass 带规格值 | Element 自身属性 | 符合 Element Template 设计 |
| Parameter | 可配置字段 | 通过应用层实现 |
| offersPart 边属性 | Element Reference 或 Relation | 需要自定义 |
| 版本 | Element 自带 version | 通过 Element ID 维护 |

**关键优势**：
- Element Template 直接对位 docs3 的 PartClassType / ProductClassType
- 内置 MCP server，接入 Claude/Cursor 零成本
- 完全开源免费
- 适合工业品/设备/IoT 边界品类

**关键短板**：
- 电商场景下 LinkType 边属性弱，offersPart 裁剪需要大量自定义
- 非原生 RDF/SPARQL，语义推理能力有限

---

## 四、同台能力对比

评分说明：⭐⭐⭐⭐⭐ 完全支持｜⭐⭐⭐⭐ 强支持｜⭐⭐⭐ 部分支持｜⭐⭐ 弱支持｜⭐ 不支持

| 能力诉求 | Stardog | Fabric IQ | Neo4j Aura | AbutionGraph | TDengine IDMP |
|---------|---------|-----------|-----------|--------------|---------------|
| **SpecDefinition 类型定义** | ⭐⭐⭐⭐⭐ SHACL | ⭐⭐⭐⭐ Entity Property | ⭐⭐⭐⭐ Node Property | ⭐⭐⭐⭐ T/P | ⭐⭐⭐⭐ Element Attribute |
| **SpecValue 存储** | ⭐⭐⭐⭐⭐ RDF Triple | ⭐⭐⭐⭐⭐ Entity Instance | ⭐⭐⭐⭐⭐ Node Property | ⭐⭐⭐⭐⭐ Entity | ⭐⭐⭐⭐⭐ Element Attribute |
| **ProductClass 自身规格** | ⭐⭐⭐⭐⭐ Class Individual | ⭐⭐⭐⭐ Entity | ⭐⭐⭐⭐⭐ Node | ⭐⭐⭐⭐⭐ Entity | ⭐⭐⭐⭐⭐ Element |
| **Parameter 定义** | ⭐⭐⭐⭐ SHACL Param | ⭐⭐⭐ Configurable | ⭐⭐⭐⭐ Query Param | ⭐⭐⭐⭐⭐ Rule Param | ⭐⭐⭐ App Layer |
| **Part/SKU 无 Parameter 值** | ⭐⭐⭐⭐⭐ 语义一致 | ⭐⭐⭐⭐ 语义一致 | ⭐⭐⭐⭐ 语义一致 | ⭐⭐⭐⭐ 语义一致 | ⭐⭐⭐ 需约定 |
| **offersPart 边属性** | ⭐⭐⭐ Named Graph | ⭐⭐⭐⭐ Relationship+Mapping | ⭐⭐⭐⭐⭐ **原生一等公民** | ⭐⭐⭐⭐⭐ **原生一等公民** | ⭐⭐ 需自定义 |
| **realizes 关系** | ⭐⭐⭐⭐⭐ ObjectProperty | ⭐⭐⭐⭐⭐ Relationship | ⭐⭐⭐⭐⭐ Relationship | ⭐⭐⭐⭐⭐ Relationship | ⭐⭐⭐ Element Reference |
| **parentOf 自连接** | ⭐⭐⭐⭐⭐ rdfs:subClassOf | ⭐⭐⭐⭐⭐ Self-Relationship | ⭐⭐⭐⭐⭐ Self-Relationship | ⭐⭐⭐⭐ Self-Relationship | ⭐⭐⭐ Tree Relation |
| **版本管理** | ⭐⭐⭐⭐⭐ Named Graph | ⭐⭐⭐⭐ Entity Version | ⭐⭐⭐ Node Version | ⭐⭐⭐⭐⭐ 内置 | ⭐⭐⭐⭐ Element ID |
| **Agent / GraphRAG** | ⭐⭐⭐⭐ Voicebox+MCP | ⭐⭐⭐⭐⭐ Data Agent+Ops Agent | ⭐⭐⭐⭐⭐ Aura Agent | ⭐⭐⭐⭐⭐ OntoFlow | ⭐⭐⭐⭐⭐ 内置 MCP+TDgpt |
| **国产/成本** | ⭐⭐ 商业 $50K+/yr | ⭐⭐⭐ 绑 Microsoft 云 | ⭐⭐⭐⭐ 社区大 | ⭐⭐⭐⭐⭐ **国产开源** | ⭐⭐⭐⭐⭐ **完全免费** |

---

## 五、不推荐作为主方案的方案

| 产品 | 不推荐原因 |
|------|----------|
| **Amazon Neptune** | 没有一等公民 Schema 引擎；LinkType 边属性弱 |
| **TigerGraph** | GSQL 强但生态小；SHACL 等价物缺失 |
| **GraphDB (Ontotext)** | RDF 推理强但 Agent/Action 落后 |
| **Databricks Genie** | 自动抽取偏描述性，不是 actionable ontology |

---

## 六、决策矩阵

| 你的核心诉求 | 首选 | 次选 | 备选 |
|------------|------|------|------|
| 严肃复刻 docs3 语义模型 + W3C 标准 | **Stardog** | Fabric IQ | AbutionGraph |
| 已在 Microsoft 云栈 | **Fabric IQ** | Stardog | Neo4j Aura |
| offersPart 边属性原生支持 | **Neo4j Aura** | AbutionGraph | Stardog |
| 国产化部署（信创） | **AbutionGraph** | Stardog | - |
| 工业品/设备/IoT 品类 | **TDengine IDMP** | AbutionGraph | - |
| 快速验证 PoC + 最低成本 | **Neo4j Aura** | TDengine IDMP | AbutionGraph |
| 完整 Action/Parameter 驱动求解 | **AbutionGraph** | Stardog | Fabric IQ |

---

## 七、参考来源

- `docs3/复杂产品配置器的数据模型.md`
- `docs4/Palantir范式电商语义建模方案.md`
- `docs/图业界Ontology产品调研与Palantir电商适配分析.md`（v1.3）
- `docs/Microsoft Fabric IQ 电商语义建模验证操作指南.md`（v2.0）
- [Microsoft Fabric IQ Ontology Overview](https://learn.microsoft.com/en-us/fabric/iq/ontology/overview)
- [Stardog Integrity Constraint Validation](https://docs.stardog.com/data-quality-constraints)
- [Neo4j Aura Agent GA](https://neo4j.com/blog/agentic-ai/neo4j-launches-aura-agent/)
- [AbutionGraph 官网](http://www.thutmose.cn/#/)
- [TDengine IDMP 文档](https://idmpdocs.taosdata.com/)

---

*文档结束*
