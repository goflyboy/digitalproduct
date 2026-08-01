# 图业界 Ontology 类产品调研与 Palantir 复杂产品配置器适配分析

> **文档版本**: v1.1
> **创建时间**: 2026-07-28
> **更新说明**: v1.1 适配数据模型 v1.4——去掉 ProductClassType/PartClassType，从三层业务模型简化为两层
> **核心主题**: 商用/开源 Ontology 类产品调研 + Palantir 复杂产品配置器建模方案的适配对比
> **关联文档**:
> - [Palantir范式复杂产品配置器语义建模方案.md](./Palantir范式复杂产品配置器语义建模方案.md)（v1.1）
> - [复杂产品配置器的数据模型详解.md](./复杂产品配置器的数据模型.md)（v1.4）
> - [Microsoft Fabric IQ 复杂产品配置器语义建模验证操作指南.md](./Microsoft%20Fabric%20IQ%20复杂产品配置器语义建模验证操作指南.md)（v1.1）

---

## 一、核心结论

针对「两层业务模型（业务建模层 + 产品实例化层）+ LinkType一等公民 + 配置约束求解 + Agent消费」的 Palantir 范式复杂产品配置器建模方案（v1.4），**主适配排序为：Stardog > Microsoft Fabric IQ > Neo4j Aura**。

**v1.4 简化说明**：去掉了 ProductClassType/PartClassType 元模型层，从三层（L1元模型/L2业务对象/L3配置运行）简化为两层（L1业务建模/L2产品实例化/L3配置运行仍在）。

如果业务包含「工业设备 / PLC 配置器 / IoT 装备耗材」等边界品类，**TDengine + IDMP 作为「子本体挂载」是强候选**。

如果业务对**国产化部署**或**完全沿用 Palantir 路线**有强诉求，**AbutionGraph 是"路线对位型"候选**。

| 排名 | 产品 | 适配评分 | 一句话定位 |
|------|------|---------|-----------|
| 1 | **Stardog** | ⭐⭐⭐⭐⭐ | 与 Palantir 哲学最接近的 RDF/OWL 知识图谱，LinkType 天然一等公民，配置约束 SHACL 校验 |
| 2 | **Microsoft Fabric IQ** | ⭐⭐⭐⭐ | 2026 GA 的 Ontology+Activator 全家桶，最像 Foundry 的"复制品"，Activator 适合规则引擎 |
| 3 | **Neo4j Aura + Aura Agent** | ⭐⭐⭐⭐ | 属性图原生 + 最短 path to Agent demo，offersPart 边属性原生支持，但缺 LinkType schema 治理 |
| 4 | **TDengine + IDMP** | ⭐⭐⭐（条件性） | 工业本体的开源免费实现，Element 模板对位 PartClass，Event 对位配置事件告警 |
| 5 | **AbutionGraph** | ⭐⭐⭐⭐（条件性） | 国内首款"明确对标 Palantir 路线"的原生本体数据库，Action/Function 是核心卖点，适合约束触发 |

---

## 二、Palantir 范式复杂产品配置器方案的核心能力诉求

**v1.4 变更说明**：去掉了 ProductClassType/PartClassType 元模型层，ObjectType 从 13 个简化为 11 个。

约束方案落地的关键能力（按重要性排序）：

| # | 能力诉求 | 在方案中的体现 | v1.4 变更 | 难度 |
|---|---------|---------------|---------|------|
| **A1** | **ObjectType 一等公民**（实体类型可注册、版本化） | OT_PRODUCT_CLASS / OT_PART_CLASS / OT_PART 等 **11 个类型** | 从 13 简化为 11（去掉 Type 层） | 中 |
| **A2** | **LinkType 一等公民 + 边属性** | `OFFERS_PART` 带 `enabled/disabled/minQty/maxQty/fixed` 裁剪属性；`COMPOSED_OF` 带 `selection_policy/min_qty/max_qty/multi_instance` | **不变** | **高** |
| **A3** | **两层业务模型**（L1业务建模/L2产品实例化/L3配置运行） | ProductClass → PartClass → Part → ProductInstance → Configuration | 从"三层元模型"简化为"两层业务模型" | 高 |
| **A4** | **Backing Datasource 解耦** | 部件主数据、规则引擎、定价域分离 | **不变** | 中 |
| **A5** | **SpecDefinition + SpecValue 规格体系** | 产品/部件的固有规格定义与持有值分离；ProductClass 可持有 SpecValue | v1.4 新增 ProductClass 持有 SpecValue | 中 |
| **A6** | **Parameter 参数体系** | 用户可配置的需求输入（Sum_Capacity、Sum_Memory）；定义在 ProductClass 或 PartClass 上 | v1.4 definedOn 从 TYPE 改为 CLASS | 中 |
| **A7** | **offersPart 裁剪语义** | ProductInstance 到 Part 的裁剪边，enabled/defaultSelected/minQty/maxQty/fixed | **不变** | **高** |
| **A8** | **SpecOverride 覆盖语义** | ProductInstance 覆盖基线规格（S22 强制 FormFactor=4U） | **不变** | 中 |
| **A9** | **Configuration + ConfiguredPart 配置求解** | 配置方案 → 约束求解 → BOM/报价/交付规格 | **不变** | 高 |
| **A10** | **细粒度权限与角色视图** | 产品数据架构师/产品数据工程师/销售/客户 | 去掉"平台架构师"角色（不再管理 Type 层） | 中 |
| **A11** | **Agent / GraphRAG 消费** | 配置助手、价格查询、规则推理 | **不变** | 中 |

> 复杂产品配置器方案的特色能力：offersPart 裁剪语义（LinkType 边属性）、SpecOverride 覆盖语义、SpecDefinition 与 Parameter 的区分、Configuration 约束求解。这些能力对 Ontology 产品的 LinkType 边属性和约束校验能力提出了更高要求。

---

## 三、Top 5 候选产品

### 3.1 Stardog — RDF 知识图谱平台

**定位**：企业级知识图谱，RDF + SPARQL + OWL 推理 + SHACL 校验 + 虚拟图谱。

**关键技术特征**：

| 维度 | 实现 |
|------|------|
| 数据模型 | RDF 三元组；关系是 `owl:ObjectProperty`（一等公民） |
| 边属性 | 用 named graph + reification 落地，对应 `OFFERS_PART` 的 `enabled/disabled/minQty/maxQty/fixed` |
| Schema 校验 | **SHACL**（Stardog ICV）—— 直接对应配置约束硬校验 |
| Backing 联邦 | **Virtual Graph**（R2RML 映射）—— SPARQL 直接联邦 MySQL/MongoDB/S3，**不搬数据** |
| 写回 | ACID 事务（`begin/add/commit`），SPARQL Update |
| Agent | **Stardog Voicebox**（LLM 辅助建模） + MCP（Claude/Cursor 直连） |
| 价格 | 商业版 $50K+/yr，可选 Stardog Cloud 托管 |

**对位复杂产品配置器优势**：
- LinkType 清单（`COMPOSED_OF`、`OFFERS_PART`、`REALIZES` 等 10 个）可直接写成 OWL ObjectProperty
- `OFFERS_PART` 的边属性（enabled/disabled/minQty/maxQty/fixed）用 SHACL PropertyShape 表达
- `SPEC_OVERRIDE` 覆盖语义用 SPARQL Update 实现
- SHACL 校验表达配置约束（数量边界、兼容规则、依赖规则）
- Virtual Graph 联邦部件主数据、定价域，不搬数据

### 3.2 Microsoft Fabric IQ（Ontology item）

**定位**：GA 于 2026 年 6 月（Ontology 仍 preview），是 Microsoft 对标 Foundry 的核心武器。

**关键技术特征**：

| 维度 | 实现 |
|------|------|
| Entity Type | 与 Palantir ObjectType 几乎一一对应 |
| Relationship | 可挂属性（distance、confidence、effectiveAt）+ 基数约束 |
| Action | **Fabric Activator** 内置 condition→action 规则引擎，适合配置约束触发 |
| Agent | **Operations Agent** + **Data Agent**（GA）+ **NL2Ontology** |
| Graph | **Graph item** 内嵌做 path/centrality |
| Backing | 绑定 OneLake（lakehouse / eventhouse） |
| MCP | 支持 Copilot / Foundry / 自建 agent |

**短板**：
- Ontology 仍 preview，企业级 reasoning/SHACL 等价物不如 Stardog 深
- 必须绑定 Microsoft Fabric 数据栈

### 3.3 Neo4j Aura + Aura Agent — 属性图标杆

**定位**：全球装机量最大的原生属性图数据库；2026 年初 GA 的 **Aura Agent** 是首个把"图 → Agent"做成一键产品的商用方案。

**关键技术特征**：

| 维度 | 实现 |
|------|------|
| 数据模型 | 属性图（Property Graph） |
| 边属性 | `(:ProductInstance)-[:OFFERS_PART {enabled: true, minQty: 1, maxQty: 2}]->(:Part)` 原生支持 |
| Agent | **Aura Agent** 从图 schema 自动生成 draft agent，含 GraphRAG 工具链（向量 + 参数化模板 + text2Cypher） |
| 部署 | 一键部署为 OAuth 保护的 **MCP server** |
| GDS | Graph Data Science 库（路径、社群、相似度） |
| 向量 | AuraDB Vector Index 让图库本身兼任向量库 |

**对位复杂产品配置器优势**：
- `OFFERS_PART` 边属性原生支持，enabled/disabled/minQty/maxQty/fixed 直接作为边属性
- `COMPOSED_OF` 递归结构用 Cypher 路径表达
- `REALIZES` 关系原生支持
- Configuration → ConfiguredPart 配置求解结果可直接落图

**短板**：
- 没有原生 "ObjectType / LinkType schema 引擎"，schema 校验要靠 Cypher 约束或外层代码
- LinkType 版本化要自建
- OWL 形式化推理需要外接 reasoner

### 3.4 TDengine + IDMP — 工业本体的开源免费实现

**定位**：涛思数据（taosdata）出品 = **TDengine TSDB**（高性能时序数据库）+ **TDengine IDMP**（AI 原生工业数据管理平台）。IDMP 是国内首个把"工业本体"作为架构核心的工业互联网平台，TDengine OSS 版完全免费开放完整能力。

**关键技术特征**：

| 维度 | 实现 |
|------|------|
| 数据模型 | **树 + 网络两层结构**（与 Palantir Ontology 哲学高度同构） |
| 工业本体三件套 | **元素（Element）** + **属性（Attribute）** + **事件（Event）** |
| 模板 | **元素模板（Element Template）** 原生支持，对位 OT_PART_CLASS |
| 跨树引用 | **Element Reference** 让一个资产可属于多棵树（多视角） |
| Backing | 元素属性绑定到 TSDB 子表的 metric / tag，无需 ETL |
| Action | **事件告警**（阈值触发）+ **内置 MCP 写操作**（add/delete/modify） |
| Agent | **内置 MCP server（Streamable HTTP）** + **AI Chat** + **TDgpt** 异常检测/预测/根因分析 |
| 权限 | RBAC + 用户 Token 控制 MCP 边界 |
| 价格 | **TDengine OSS 完全免费**，IDMP 企业版按需授权 |

**对位复杂产品配置器优势**：
- 元素模板直接对位 OT_PART_CLASS：PartClass(cpu/drive/memory) = Element Template
- Element 实例对位 OT_PART：Part(cpu1/cpu2) = Element Instance
- `COMPOSED_OF` 递归组成用树结构天然表达
- Event 对位配置事件告警（约束冲突时触发）
- 内置 TDgpt 异常检测，可用于配置方案健康度分析

**短板（对复杂产品配置器场景的核心障碍）**：
- **场景原生是工业**：元素/属性/事件原语偏"设备/传感器/能耗"，套到"产品类/部件类/规格/参数"需要大量自定义
- **数据模型偏树非图**：树+网络结构不擅长多级部件继承的图遍历
- **LinkType 边属性弱**：跨树引用没有 schema 化的边属性，`OFFERS_PART` 的 minQty/maxQty 套起来别扭
- **W3C 标准需 Ontop 桥接**：原生 RDF/SPARQL/OWL 推理不是一等公民

### 3.5 AbutionGraph — 中国版 Palantir 路线的原生本体数据库

**定位**：北京图特摩斯科技自主研发（2019 年首发，曾开源 2 年）的国产**原生本体数据库** + 实时图数仓。明确对标 Palantir Foundry/Ontology/AIP，自称"中国版本体智能方案"。

**核心哲学（与 Palantir 最像的地方）**：

> "真正的本体智能（Ontology Intelligence），不只是 Entity + Relation，而是：Object + Function + Action"——闭雨哲

**T/P/F/Agg/Action 五位一体建模**（直接对位 Palantir 概念）：

| AbutionGraph 概念 | Palantir 对位 | 复杂产品配置器对应 |
|-----------------|--------------|-----------------|
| **T（Type）** | ObjectType | OT_PRODUCT_CLASS / OT_PART_CLASS 等 **11 个类型**（v1.4 去掉 Type 层） |
| **P（Predicate）** | PropertyType / LinkType | PropertyType + LinkType 边属性（offersPart/minQty/maxQty） |
| **F（Function）** | Function | 派生属性、计算字段（Sum_Capacity 汇总） |
| **Agg（Aggregate）** | Function / Metric | 统计聚合、指标计算（BOM 汇总价格） |
| **Action** | Action Type | 配置约束触发、规格覆盖生效 |
| **R（Role）** | Markings / 权限 | 产品数据架构师/产品数据工程师/销售角色 |

**关键技术特征**：

| 维度 | 实现 |
|------|------|
| 数据模型 | **RDF 图 + 属性图 + 时序图 + 向量图** 四种融合 |
| Schema | **弱 schema**：保证建模规范同时允许万亿级点边场景下的动态属性增删 |
| 边属性 | **Edge 原生带属性**（如 `OFFERS_PART {enabled: true, minQty: 1}`） |
| 边聚合 | 同一对节点间多次写入**自动聚合成一条边** |
| Action | **ActionFunction**（含 condition + apply），schema 里直接绑定，状态变更自动触发 |
| Function 类型 | TransformFunction / AggregateFunction / PredictFunction / ActionFunction / CodeFunction |
| 时序 | 实体/边历史状态全留痕，可做"过去某时刻图谱快照" |
| 权限 | **行级子图隔离**（按用户自动子图隔离） |
| AI 集成 | 通过 **OntoFlow 平台层**支持：MCP 一键发布、Tool/Skill/Memory/Harness、Agent 工作流 |
| 查询语言 | 自研 **AbutionQL** + Cypher / Gremlin / GraphQL / SPARQL |
| 国产信创 | 全面适配，图标签等支持中文 |

**对位复杂产品配置器优势**：
- **offersPart 边属性**直接对位 Edge + Predicate + property，比 Neo4j 更原生
- **Action Type 写回**是核心卖点——ActionFunction 是 schema 一等公民，状态变更自动触发，适合配置约束触发
- **SpecOverride 覆盖语义**通过 Action 函数条件判断实现
- **Parameter 汇总计算**（Sum_Capacity、Sum_Memory）通过 Agg 函数内置 Sum/Max/Count
- **Configuration 配置求解**结果通过边聚合自动累计
- **行级子图隔离**天然适配角色视图
- **OntoFlow 平台层** MCP 一键发布、Tool/Skill/Memory 完整覆盖 Agent 消费

**短板（对复杂产品配置器场景的关键风险）**：
- **主动放弃 OWL/RDF**：意味着 SHACL 强校验、跨系统互操作要自建
- **生态规模小**：GitHub 36 stars、Gitee 7xx stars，生产案例少
- **核心优势是时序流式**：复杂产品配置器是"业务实体 + 配置约束"，不是高频流式数据
- **商业支持依赖单一作者公司**：长期支持存在风险

---

## 四、Top 5 同台对比

**v1.4 变更说明**：A1 ObjectType 从 13 个简化为 11 个（去掉 ProductClassType/PartClassType）。

评分说明：⭐⭐⭐⭐⭐ 完全支持｜⭐⭐⭐⭐ 强支持｜⭐⭐⭐ 部分支持｜⭐⭐ 弱支持｜⭐ 不支持

| 能力诉求 | Stardog | Microsoft Fabric IQ | Neo4j Aura | TDengine IDMP | AbutionGraph |
|---------|---------|--------------------|-----------|---------------|--------------|
| **A1 ObjectType 一等公民**（v1.4: 11个） | ⭐⭐⭐⭐⭐ OWL Class | ⭐⭐⭐⭐⭐ Entity Type | ⭐⭐⭐ Label 是"半 schema" | ⭐⭐⭐⭐⭐ Element 模板原生 | ⭐⭐⭐⭐⭐ Type + Dimension 原生 |
| **A2 LinkType + 边属性** | ⭐⭐⭐⭐⭐ ObjectProperty + reification | ⭐⭐⭐⭐⭐ Relationship 可挂属性 | ⭐⭐⭐⭐⭐ 属性图原生一等公民 | ⭐⭐⭐ Element Reference 无 schema 化 | ⭐⭐⭐⭐⭐ Edge 属性原生 + 边聚合独占 |
| **A3 两层业务模型**（v1.4 简化） | ⭐⭐⭐⭐ OWL + SHACL 分层 | ⭐⭐⭐⭐ Semantic Model 引导生成 | ⭐⭐⭐ 自建"模板"层 | ⭐⭐⭐⭐ 树+网分层 | ⭐⭐⭐⭐ 弱 schema + 灵活分层 |
| **A4 SpecDefinition + SpecValue** | ⭐⭐⭐⭐⭐ OWL DatatypeProperty | ⭐⭐⭐⭐ Property + Entity | ⭐⭐⭐ 属性图原生 | ⭐⭐⭐⭐ Attribute 原生 | ⭐⭐⭐⭐ Property 原生 |
| **A5 Parameter 参数体系**（v1.4: CLASS） | ⭐⭐⭐⭐ SPARQL 查询变量 | ⭐⭐⭐⭐ Query Parameter | ⭐⭐⭐ Cypher 参数 | ⭐⭐⭐⭐ Attribute 扩展 | ⭐⭐⭐⭐ Function 参数 |
| **A6 offersPart 裁剪语义** | ⭐⭐⭐⭐⭐ SHACL + Virtual Graph | ⭐⭐⭐⭐ Semantic Model 约束 | ⭐⭐⭐⭐⭐ 属性图边属性原生 | ⭐⭐⭐ Element Reference 弱 | ⭐⭐⭐⭐⭐ Edge 属性原生 |
| **A7 SpecOverride 覆盖语义** | ⭐⭐⭐⭐ SPARQL Update | ⭐⭐⭐⭐⭐ Activator 触发 | ⭐⭐⭐ Cypher 写事务 | ⭐⭐⭐ Event 触发 | ⭐⭐⭐⭐⭐ ActionFunction 原生 |
| **A8 Configuration 配置求解** | ⭐⭐⭐⭐ SPARQL + 外层求解器 | ⭐⭐⭐⭐⭐ Activator 规则引擎 | ⭐⭐⭐ 外层 Cypher 查询 | ⭐⭐⭐⭐ Event + MCP | ⭐⭐⭐⭐ Function + Action |
| **A9 Backing Datasource 解耦** | ⭐⭐⭐⭐⭐ Virtual Graph，**不搬数据** | ⭐⭐⭐ 必须搬 OneLake | ⭐⭐⭐ 必须 ETL | ⭐⭐⭐⭐ TSDB + 关系库桥接 | ⭐⭐⭐ TSDB/Hadoop/S3/Kafka 桥接 |
| **A10 细粒度权限与角色视图**（v1.4: 去掉Type角色） | ⭐⭐⭐⭐ RBAC + Named Graph | ⭐⭐⭐⭐⭐ Fabric Workspace 权限集成 | ⭐⭐⭐⭐⭐ RBAC + sub-graph | ⭐⭐⭐⭐ RBAC + Token | ⭐⭐⭐⭐⭐ **行级子图隔离**（强项）|
| **A11 Agent / GraphRAG** | ⭐⭐⭐⭐ Voicebox + MCP | ⭐⭐⭐⭐⭐ Operations + Data Agent GA | ⭐⭐⭐⭐⭐ Aura Agent 一键 MCP | ⭐⭐⭐⭐⭐ 内置 MCP + AI Chat + TDgpt | ⭐⭐⭐⭐⭐ OntoFlow MCP + Tool/Skill/Memory |
| **W3C 标准原生** | ⭐⭐⭐⭐⭐ RDF/SPARQL/OWL/SHACL | ⭐⭐ DAX/SQL | ⭐⭐ Cypher | ⭐⭐ 靠 Ontop 桥接 | ⭐⭐ **主动放弃** OWL/RDF |
| **复杂产品配置器场景适用度** | ⭐⭐⭐⭐⭐ 约束校验 + 联邦 + 推理 | ⭐⭐⭐⭐ 规则引擎 + Agent | ⭐⭐⭐⭐ 已写 Cypher，迁移成本最低 | ⭐⭐⭐ 原生工业场景 | ⭐⭐⭐⭐ 通用本体，工业/装备都能套 |
| **Palantir 路线对位度** | ⭐⭐⭐⭐ 形式化推理 | ⭐⭐⭐⭐⭐ 完整同构 | ⭐⭐⭐ 标签化 | ⭐⭐⭐⭐ 树+网 + 元素模板 | ⭐⭐⭐⭐⭐ **明确对标 + T/P/F/Agg/Action 直接对位** |
| **工程化与生态** | ⭐⭐⭐⭐ JVM 运维复杂 | ⭐⭐⭐⭐ 绑定 Fabric 生态 | ⭐⭐⭐⭐⭐ 社区最大，AuraDB 托管省运维 | ⭐⭐⭐⭐ **TDengine OSS 完全免费** | ⭐⭐⭐ 单一作者公司，生态规模小 |
| **国产 / 成本 / 运维** | ⭐⭐ 商业 $50K+/yr | ⭐⭐⭐ 绑 Microsoft 云 | ⭐⭐⭐⭐ 社区大 | ⭐⭐⭐⭐⭐ **国产开源免费，运维轻** | ⭐⭐⭐⭐ **国产，2019 首发曾开源 2 年** |

---

## 五、不推荐作为 Ontology 引擎的方案

| 产品 | 不推荐原因 |
|------|----------|
| **Amazon Neptune** | 没有一等公民 Ontology item；Query Language 杂；边属性支持弱 |
| **TigerGraph** | GSQL 强但生态小，无 SHACL 等价物；配置约束校验能力弱 |
| **Graphwise GraphDB (Ontotext)** | RDF 推理强，但写回/Action/Agent/MCP 落后于 Stardog |
| **Databricks Genie Ontology** | 自动抽取偏描述性，**不是 actionable ontology**；配置约束能力弱 |
| **Dgraph / Memgraph** | 纯图库，无 schema 治理层；offersPart 边属性需要外层代码实现 |
| **JanusGraph** | 分布式图数据库，无 Ontology 层；配置模型需要自建 |

---

## 六、下一步建议

### 6.1 PoC 优先级

**主方案 PoC**：用 ProductClass/PartClass/Part/ProductInstance 关系图，分别在 **Stardog（首选）** 和 **Neo4j Aura Agent（备选）** 搭最小 demo，跑通：

1. **offersPart 边属性** + **SHACL 校验** + **MCP Agent 调用** 三件套
2. **SpecOverride 覆盖语义**（S22 强制 FormFactor=4U）
3. **Configuration 配置求解**（Sum_Capacity >= 5 约束）
4. **两层业务模型**（L1业务建模/L2产品实例化/L3配置运行）的 Graph 表达（v1.4 简化）

**边界场景 PoC**：如果业务含"工业设备 / PLC 配置器 / IoT 装备耗材"品类，加做 **TDengine IDMP 子本体** PoC：

1. 用元素模板定义"PLC 模块 / 传感器 / 执行器"三类 Element
2. 用 Element Reference 把设备同时挂到"产品平台树"和"工厂资产树"
3. 启用 IDMP 内置 MCP server，让配置 Agent 直接调设备工况
4. 用 TDgpt 跑一次"某型号近 30 天异常配置率"分析

### 6.2 配置约束（Action Type v2）实施路径

| 选型 | 配置约束实现 |
|------|------------|
| Stardog | SPARQL Update + SHACL 校验触发 |
| Fabric IQ | 直接接 Activator 规则引擎 |
| Neo4j | 自建 Action 调度层 + Cypher 事务 |
| **TDengine IDMP** | **内置 MCP 写操作**（add/delete/modify）+ **事件告警**驱动 |
| **AbutionGraph** | **ActionFunction 原生一等公民**，schema 直接绑定，配置变更自动触发 |

### 6.3 数据不动原则

部件主数据、定价域大概率在 MySQL/MongoDB：

- **Stardog**：Virtual Graph 联邦查询，**不搬数据**
- **Fabric IQ**：必须经 OneLake
- **Neo4j**：必须 ETL
- **TDengine**：工业侧时序数据直接落 TSDB，业务侧通过 JDBC/Ontop 桥接

### 6.4 Agent 工具集

MCP 是当下标配，五家都支持：

- **Aura Agent**：一键部署体验最好
- **TDengine IDMP**：**内置 MCP server**，对接 Claude / Cursor 零成本，且自带 TDgpt 异常检测/预测
- **Stardog**：需更多手工配置，但语义推理更强
- **Fabric IQ**：与 Copilot/Foundry 天然集成
- **AbutionGraph**：通过 **OntoFlow 平台层**支持 MCP 一键发布 + Tool/Skill/Memory + harness 完整覆盖

### 6.5 混合架构建议（复杂产品配置 + 工业设备边界场景）

```
┌────────────────────────────────────────────────┐
│  业务侧主本体（Stardog / Fabric IQ / Neo4j）    │
│  - OT_PRODUCT_CLASS / OT_PART_CLASS / OT_PART  │
│  - 部件组成、规格定义、参数体系、配置约束         │
└──────────┬─────────────────────────────────────┘
           │ JDBC / Ontop 桥接
           ▼
┌────────────────────────────────────────────────┐
│  工业侧子本体（TDengine IDMP）                  │
│  - Element: PLC模块 / 传感器 / 执行器            │
│  - Attribute: 温度 / 压力 / 转速              │
│  - Event: 配置告警 / 维护事件                   │
│  - MCP server 暴露给配置 Agent                 │
└────────────────────────────────────────────────┘
```

**组合价值**：
- 配置助手的"设备类 SKU 实时工况"由 TDengine MCP 直接接管
- 跨品类联想可包含"配套设备 / 耗材推荐"
- TDengine 完全免费开源，部署成本几乎为零

### 6.6 国产化 / 信创要求下的主方案建议

如果业务**必须国产化部署**（信创，政府、国企客户）或**明确要求沿 Palantir 路线**：

```
┌────────────────────────────────────────────────────────┐
│  国产主方案：AbutionGraph + OntoFlow                    │
│  - T/P/F/Agg/Action 直接对位 Palantir Ontology 概念    │
│  - 行级子图隔离 + Action 触发 = 角色视图 + 配置约束     │
│  - OntoFlow MCP 一键发布，对接 Claude / Cursor          │
│  - 边缘计算 + 存算分离，部署成本低                    │
└────────────────────────────────────────────────────────┘
```

**风险提示**：
- 主动放弃 OWL/RDF，意味着 SHACL 强校验、跨系统互操作要自建
- 单一作者公司，长期支持存在风险，建议合同锁定 SLA
- 生态规模小，案例少，**强烈建议先做小型 PoC 验证**

### 6.7 决策矩阵（最终版）

| 你的核心诉求 | 首选 | 次选 | 备选 |
|------------|------|------|------|
| 严肃复刻 Palantir + W3C 标准 | **Stardog** | Fabric IQ | AbutionGraph |
| 已在 Microsoft 云栈 | **Fabric IQ** | Stardog | Neo4j Aura |
| 已有 Cypher + 快速 demo | **Neo4j Aura** | Stardog | - |
| 必须国产化部署（信创） | **AbutionGraph** | TDengine IDMP | - |
| 工业设备 / PLC / IoT 品类 | **TDengine IDMP** | AbutionGraph | - |
| 实时流式 / 时序计算为核心 | **AbutionGraph** | TDengine IDMP | - |
| 完全沿用 Palantir 路线（不论代价） | **AbutionGraph** | Stardog | Fabric IQ |
| **配置约束校验为核心** | **Stardog** | AbutionGraph | Neo4j Aura |

---

## 七、复杂产品配置器场景的特殊适配考量

### 7.1 offersPart 边属性的 Schema 表达

`OFFERS_PART` 是复杂产品配置器的核心 LinkType，其边属性（enabled/disabled/minQty/maxQty/fixed）对 Ontology 产品提出特殊要求：

| 边属性 | 语义 | Stardog 表达 | Neo4j 表达 | AbutionGraph 表达 |
|-------|------|-------------|-----------|------------------|
| `enabled` | 是否启用该 Part | SHACL `minCount` | 边属性 `enabled` | Edge 属性 `enabled` |
| `disabled` | 是否禁用该 Part | SHACL `maxCount=0` | 边属性 `disabled` | Edge 属性 `disabled` |
| `minQty` | 最小数量 | SHACL `minCount` | 边属性 `minQty` | Edge 属性 `minQty` |
| `maxQty` | 最大数量 | SHACL `maxCount` | 边属性 `maxQty` | Edge 属性 `maxQty` |
| `fixed` | 是否固定不可改 | SHACL 约束 | 边属性 `fixed` | Edge 属性 `fixed` |
| `defaultSelected` | 是否默认选中 | SPARQL 查询 | 边属性 `defaultSelected` | Edge 属性 `defaultSelected` |

### 7.2 SpecDefinition 与 Parameter 的区分（v1.4 更新）

**v1.4 变更**：definedOn 从 TYPE 改为 CLASS（PRODUCT_CLASS / PART_CLASS）。

复杂产品配置器要求 Ontology 产品支持**规格（Spec）**与**参数（Parameter）**的语义区分：

| 维度 | 规格（SpecDefinition） | 参数（Parameter） |
|------|----------------------|-----------------|
| 定义位置（v1.4） | **PRODUCT_CLASS / PART_CLASS**（从 TYPE 简化） | **PRODUCT_CLASS / PART_CLASS**（从 TYPE 简化） |
| 持有值 | SpecValue（挂在 ProductClass 或 Part 上） | 无对应值，在 Configuration 中由用户输入 |
| 语义 | 产品/部件固有的物理特性 | 用户可配置的需求输入 |
| Stardog 表达 | OWL DatatypeProperty + 实例 | SPARQL 查询变量 |
| Neo4j 表达 | Node 属性 | Cypher 参数 |

### 7.3 ProductClass 规格值（v1.4 新增）

**v1.4 变更**：ProductClass 可持有 SpecValue（如 FormFactor=2U、PowerSupply=DUAL），这是产品层固有的物理属性。

| 场景 | 示例 | 说明 |
|------|------|------|
| 产品类规格 | SERVER_X86.FormFactor=2U | 外形规格是服务器平台固有的 |
| 产品类规格 | SERVER_X86.PowerSupply=DUAL | 电源类型是服务器平台固有的 |
| 部件规格 | cpu1.CoreNum=2 | 核心数是 CPU 部件固有的 |
| 部件规格 | sd1.Capacity=3 | 容量是硬盘部件固有的 |

### 7.4 Configuration 配置求解的 Graph 表达

Configuration → ConfiguredPart → BOM/报价/交付规格的链路在 Graph 中的表达：

```
Configuration (CFG-001)
    │
    ├── HAS_CONFIGURED_VALUE ──→ ConfiguredValue (Sum_Capacity=5, filter=Speed=5400)
    │
    └── SELECTS_PART ──→ ConfiguredPart (cpu2 x2, md1 x5)
                              │
                              └── produces ──→ BOM (cpu2x2 + md1x5 = ¥550)
```

---

## 八、参考来源

- [The State of Enterprise Semantic Layers: A 2026 Market Overview — Valliance](https://valliance.ai/what-we-think/content/the-state-of-enterprise-semantic-layers-a-2026-market-overview/valliance-content)
- [Ontology Everywhere! — Hands-On Data](https://handsondata.substack.com/p/ontology-everywhere)
- [Context layer comparison: Fabric IQ, Cortex Sense & more — Peliqan](https://peliqan.io/blog/context-layer-comparison/)
- [Microsoft vs Palantir: Two Paths to Enterprise Ontology — Towards AI](https://pub.towardsai.net/microsoft-vs-palantir-two-paths-to-enterprise-ontology-and-why-microsofts-bet-on-semantic-6e72265dce21)
- [Knowledge Graph Tools Compared — Atlan](https://atlan.com/know/ai-agent/knowledge-graph/knowledge-graph-tools-compared/)
- [Stardog vs Neo4j: Key Differences — PuppyGraph](https://www.puppygraph.com/blog/stardog-vs-neo4j)
- [8 Best Knowledge Graph Databases in 2026 — KnodeGraph](https://knodegraph.com/blog/best-knowledge-graph-database-2026)
- [Best Enterprise Knowledge Graph Platforms 2026 — Fluree](https://flur.ee/blog/enterprise-kg-buyers-guide-2026)
- [What is Fabric IQ? — Microsoft Learn](https://learn.microsoft.com/en-ca/fabric/iq/overview)
- [Fabric IQ Ontology Overview — Microsoft Learn](https://learn.microsoft.com/en-us/fabric/iq/ontology/overview)
- [Neo4j Aura Agent GA — Neo4j Blog](https://neo4j.com/blog/agentic-ai/neo4j-launches-aura-agent/)
- [Neo4j Aura Agent Product Page](https://neo4j.com/product/aura-agent/)
- [Stardog Integrity Constraint Validation — Docs](https://docs.stardog.com/data-quality-constraints)

### TDengine / IDMP 相关

- [工业数据建模 — TDengine IDMP 文档](https://idmpdocs.taosdata.com/data-modeling/)
- [数据关联与工业本体 — TDengine IDMP 文档](https://idmpdocs.taosdata.com/data-modeling/relationships-and-ontology/)
- [数据情景化（Element/Attribute/Event 三件套）— TDengine IDMP 文档](https://idmpdocs.taosdata.com/data-modeling/data-contextualization/)
- [元素模板 — TDengine IDMP 文档](https://idmpdocs.taosdata.com/advanced/element-template/)
- [TDengine 免费版说明 — 涛思数据](https://www.taosdata.com/tdengine-free-edition)
- [TDengine IDMP 设计理念拆解：让数据"有名有姓"的三步法](https://www.taosdata.com/tdengine-engineering/32415.html)
- [TDengine IDMP MCP 接口 — 官方文档](https://idmpdocs.taosdata.com/en/integrating-with-other-systems/mcp-interface/)

### AbutionGraph / OntoFlow 相关

- [AbutionGraph GitHub 仓库 — ThutmoseAI](https://github.com/ThutmoseAI/AbutionGraph)
- [AbutionGraph 官网 — 图特摩斯科技](http://www.thutmose.cn/#/)
- [OntoFlow 本体智能平台 GitHub](https://github.com/ThutmoseAI/OntoFlow)
- [不用 OWL/RDF！Function 和 Action 在本体智能平台中的重要性体现](https://jishuzhan.net/article/2054382429599272961)
- [原生本体数据库 AbutionGraph，世界模型/本体智能应用底座](https://jishuzhan.net/article/2060174340167118849)
- [OntoFlow 本体智能平台上新：与 Palantir Foundry/Ontology/AIP 三大平台能力对比 — CSDN](https://blog.csdn.net/lovebyz/article/details/159287989)

---

## 九、修订记录

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| V1.0 | 2026-07-28 | 初始版本：参考电商方案结构，适配复杂产品配置器场景（offersPart裁剪、SpecOverride覆盖、Parameter参数体系、Configuration配置求解） |
| V1.1 | 2026-07-29 | 适配数据模型 v1.4：去掉 ProductClassType/PartClassType；ObjectType 从 13 简化为 11；definedOn 从 TYPE 改为 CLASS；ProductClass 可持有 SpecValue；更新能力诉求表和对比表格；更新角色设计（去掉平台架构师） |

---

*文档结束*
