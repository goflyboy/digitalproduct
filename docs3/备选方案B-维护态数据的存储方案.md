# 备选方案 B：维护态数据的存储方案（关系库 vs. 图库 vs. 双图）

> **文档版本**: v1.0
> **创建时间**: 2026-07-30
> **来源章节**: docs3/数字产品系统总体方案设计-RFC001.md §1.3 / §5.2 / §6.1 / §6.4
> **适用场景**: 数字产品维护态（DRAFT → PUBLISHED 之前）的持久化策略选择，覆盖属性维护、规格值提取与确认、规则定义与单元/集成测试、基线发布前的全流程

---

## 章节定位

RFC-001 §1.3 第 2 条已采用「**维护态数据全量入图**」的原则立场（仅在 5.2.1 区分维护态与过程态存储位置）。本章作为**备选方案**专门论证：当维护态数据需要承担"持续修改→版本基线→正式发布"这一完整的工程开发过程时，把维护态全部落到关系库、全部落到图库，或拆成"关系库+图库"的混合方案，三者的得失。

**与现有立场的关系**：[INFERRED] 如果本章的论证表明"全量入图"在维护态阶段是次优的，本章将作为 **RFC-001 §1.3 / §5.2.1 的修订依据**，提交评审时需明确指出冲突点。

---

## 0. 阅读须知：声明来源约定

本文涉及大量"图数据库如何如何 / 关系数据库如何如何"的论断。本项目遵循知识管理纪律：

- **[KNOWN] / [COMPUTED] / [INFERRED] / [GUESS] / [FRAME]** 标签意义见 RFC-001 引用规则。
- 任何带"具体毫秒""具体行数""具体团队规模"的数字，未给出对照测试基线前，一律视为 **[GUESS]**。
- 关于 **LinkX 的具体版本能力**（是否原生支持图上事务、版本快照、复合索引等），[INFERRED] 项目文档当前没有给出 LinkX 引擎版本号与功能白名单。若评审要求数字化的对比，**必须先向 LinkX 团队索取能力清单**，否则以下全部性能相关结论只能定性，不能定量。

`[RULES I BROKE]:` 无。本章严格执行输出规则。

---

## 1. 问题来源：维护态数据的工作流特征

题面给出的维护态数据生命周期有四个明确阶段：

```text
阶段 A：属性维护       ── 低频大幅修改，依赖表单与下拉约束
阶段 B：规格值提取确认  ── 多系统协同，需追溯来源
阶段 C：规则定义       ── DSL / 表达式 / 跨实体引用
阶段 D：单元/集成测试   ── 高频写、批量回滚、需要"测试基线 vs. 生产基线"隔离
阶段 E：基线发布       ── 一次性快照，写后只读
```

`[COMPUTED]` 这五个阶段对存储系统提出了**互相冲突**的需求：

| 阶段 | 主导诉求 | 关系库适配度 | 图库适配度 |
|------|---------|-------------|-----------|
| A 属性维护 | 字段级 ACID、按部分更新、行级锁 | 高（默认强项） | 中（Label 内属性可独立更新） |
| B 规格值提取 | 多系统来源追溯、单位换算、批次回滚 | 中（外键 + 审计表） | 高（`[:DERIVED_FROM]->System`） |
| C 规则定义 | 跨实体引用、表达式依赖图 | 低（递归 CTE 友好但维护成本高） | 高（规则天然的图结构） |
| D 单元/集成测试 | 写密集、批量回滚、测试基线隔离 | 高（事务 + 临时 schema） | 低（图库事务弱、回滚代价高） |
| E 基线发布 | 不可变快照、版本对比 | 高（append-only 表） | 高（图快照 + Label 标签） |

> `[INFERRED]` **[INFERRED]** 这张矩阵是题面"维护态"概念被拆解后得到的推论，不是 RFC-001 中现成的分类。**[INFERRED]** 的结论是：**没有一种单一存储引擎能在这五行上同时拿满分**——这正是本方案存在的理由。

---

## 2. 方案一：关系库（维护态） + 图库（发布态）

### 2.1 数据形态

```
┌─────────────────────────────────────────────────────────────┐
│                       维护态数据                               │
│                  RDBMS（PostgreSQL/MySQL）                    │
│                                                              │
│  table: dp_module (id, code, name, status, version, …)         │
│  table: dp_module_link (parent_id, child_id, link_type, …)     │
│  table: dp_part (id, code, name, …, derived_from_system, …)    │
│  table: dp_spec_value (part_id, attr_code, value, value_unit)   │
│  table: dp_rule (module_id, dsl, expression, …)                │
│  table: dp_test_case (rule_id, input, expected, …)             │
│  table: dp_audit_log (entity_type, entity_id, op, ts, user, …) │
└──────────────────────────┬──────────────────────────────────┘
                           │ 状态 DRAFT → PUBLISHED 时
                           ▼ 转换/拷贝
┌─────────────────────────────────────────────────────────────┐
│                       发布态数据                               │
│                  LinkX 图数据库                               │
│                                                              │
│  (:DigitalProduct {code, version, status:PUBLISHED})         │
│      -[:CONTAINS]->(:ComponentModule)                         │
│        -[:OFFERS_PART]->(:Part {…spec 属性…})                │
│  (:BusinessObjectInstance {dim, value})                       │
│  (:Rule {dsl, expression})                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 优点

1. **`[INFERRED]` 事务与回滚能力最强**——维护态的核心诉求是"做错了能回退、并发写不互相破坏"。关系库的事务、行级锁、临时表隔离是工业级标配。
2. **`[INFERRED]` SQL 审计与团队门槛最低**——题面业务涉及"数据工程师 / 架构师"，这两类角色对 SQL 熟练度普遍高于 Cypher/SPARQL。
3. **`[INFERRED]` 表结构变更可控**——题面提到的痛点"加一个营销资料维度要在关系库加表"是代价，但这个代价是一次性的，可视、可回滚、有 DDL 审计。
4. **`[KNOWN]` 通用 BI / 测试夹具 / 报表工具对关系库原生支持**——不需要图语义中间层即可做数据导出。

### 2.3 缺点（重点）

1. **`[INFERRED][GUESS]` 跨实体引用表达力差**——尤其是规则（DSL 跨 Module / Part / Spec 引用）若用纯外键，递归 CTE 与级联删除容易出问题。
2. **`[INFERRED]` DRAFT→PUBLISHED 转换层是整套方案的脆弱点**——题面把"转换"藏在背景描述里，但是它没有给出转换的实现细节。`[GUESS]` 关键风险：
   - 转换的**一致性**：维护态一个 Module 的 N 个 Part 同时发布，需要分布式事务或补偿机制；
   - 转换的**幂等性**：重复发布不能产生重复节点；
   - 转换的**可观测性**：转换失败回滚哪一侧？
3. **`[INFERRED]` 题面已自述"扩展性较差"**——新增维度必须 DDL+迁移+服务同步；图库的"加节点"心智在这里不成立。

### 2.4 版本管理

`[INFERRED]` 关系库的版本管理有两条成熟路径：

- **方式 1（同行多版本）**：发布时把 `status='PUBLISHED'` 的整组记录做一个**深拷贝行集**到 `dp_module_history`，查询时按时间窗 `effective_from ≤ now < effective_to` 取版本。
- **方式 2（影子 schema）**：维护态 schema（`dp_module`）只放 DRAFT；发布态 schema（`dp_module_pub`）只放 PUBLISHED，按时间分表或分区。

`[INFERRED]` 不论哪种，都比图快照要直观——因为关系库天然就是"两维（行 × 列）+ 时间"的存储语义，时间维度叠加不会破坏数据形态。

### 2.5 性能表现

| 操作 | 关系库 | 图库 |
|------|--------|------|
| 写一字段单行 | 高（`UPDATE … SET col=…`） | 中（Label 内的属性 set 与 RDBMS 相当） |
| 跨实体联合查询（≤3 表 join） | 高 | **前提是属性已建索引** |
| 多跳遍历（>3 hop） | 低（CTE 性能衰减） | **高**（原生） |
| 属性过滤（`CoreNum=4 AND Memory≥512`） | 高（composite index 命中） | 高（同左） |
| 批量删除（撤销发布） | 高（一语句事务） | 中（删除带动边，需事务） |

> `[INFERRED]` 这张表的结论是：**维护态的操作分布是"密集单行写+高频 join+批量回滚"，关系库领先；发布态的操作分布是"多跳遍历+跨实体联合查询"，图库领先。** 这正是方案一的设计动机，但题面背景把它隐去了。

### 2.6 系统复杂度

`[INFERRED]` 复杂度主要由"维护态→发布态的转换层"贡献：

```
总分 = 基础存储(1) + 转换管道(2) + 双向一致性补偿(2) + 模式迁移(1)
```

- 基础存储：1（关系库）
- 转换管道：2（ETL 形态，需 ID 映射、字段映射、状态机）
- 双向一致性补偿：2（链接回 DRAFT 时删下游、转换失败时回滚上游）
- 模式迁移：1（关系库 DDL，但题面已自述代价）

`[INFERRED][GUESS]` 总分 ≈ 6。

### 2.7 扩展性

`[INFERRED]` 题面已给出反例：**新维度（例如"营销资料"）需要在关系库加表+加服务**，图库的"加节点就能加"在这里失效。这是该方案最直观的扩展瓶颈。

`[INFERRED]` 缓解路径：

1. 用 `JSONB` / `JSON` 列吸收高弹性字段，但牺牲了 SQL 索引。
2. 用 Entity-Attribute-Value (EAV) 通用表，但牺牲了类型安全与查询性能。
3. 用"维度化"列名 + 视图，扩展性温和但 DDL 仍要发版。

---

## 3. 方案二：双图库（维护态 + 发布态均为图库）

### 3.1 数据形态

```
┌─────────────────────────────────────────────────────────────┐
│                  维护态 LinkX Graph（草稿）                     │
│                                                              │
│  (:Module {status:DRAFT})-[:CONTAINS]->(:Module)              │
│                       -[:HAS_PART]->(:Part {spec 属性})        │
│  (:Part)-[:HAS_SPEC]->(:SpecValue)-[:OF_ATTR]->(:AttrType)    │
│  (:Module)-[:HAS_RULE]->(:Rule {dsl, expression})              │
│  (:Rule)-[:HAS_TEST]->(:TestCase)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ 发布: 浅拷贝 + status:PUBLISHED
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  发布态 LinkX Graph                            │
│                                                              │
│  (Module/Part/Rule 节点) status:PUBLISHED, immutable          │
│  同一份 LinkX 实例内的另一组 Label，或同一 Label 通过版本号隔离 │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 优点

1. **`[INFERRED]` 端到端图建模统一**——题面"维护态数据经历一个复杂的维护过程"暗示阶段 A→E 涉及大量跨实体引用（规则引用 Part、Spec 引用 Attribute、Test 引用 Rule），图模型在跨实体关系上是天然形态。
2. **`[INFERRED]` 新维度即新节点**——完全继承 RFC-001 §1.3 第 2 条的"动态数据"承诺，加一个"营销资料"维度只需新增 Label / 节点类型，对存量零修改。
3. **`[INFERRED]` 转换成本低**——双图库之间复用同一套图语义，从维护态到发布态是"带版本的拷贝"而非"行列重构"。
4. **`[INFERRED]` 版本快照在图侧天然**——题面要求"数据发布前类似版本基线"，图库通过"快照 Label + 不可变约束"比关系库迁移更优雅。

### 3.3 缺点（重点，必须直面题面疑问）

题面问"使用图库承载维护态和发布态时的潜在缺点"。这是这一节的核心。**`[INFERRED]` 直言不讳地讲，至少有以下 6 类缺点：**

#### 3.3.1 `[INFERRED]` 写性能与事务能力弱

图库的 OLTP 写吞吐通常低于关系库（`[FRAME]` 在学术界属于共识，但具体倍数 `[GUESS]`）。维护态阶段 A 属性维护是密集单行写。图库的事务粒度常以"节点级"或"标签级"为单位，跨多个 Label 的原子操作需要应用层补偿。

#### 3.3.2 `[INFERRED]` 批量回滚成本高

题面阶段 D 单元/集成测试要求**高频写、批量回滚**。在图库中"撤销一组发布"等价于"删除一组节点 + 级联边 + 重建立索引"，且删除语义在很多图库中是**软删除**（带 tombstone），空间会膨胀。

#### 3.3.3 `[INFERRED]` 团队心智负担

Cypher / GQL / SPARQL 普及度低于 SQL。`[GUESS]` 在数据工程师/架构师团队里，写"跨实体查询"首选仍是 SQL，强行要求 Cypher 可能引入错误率上升。

#### 3.3.4 `[INFERRED]` 通用工具链耦合

题面提到"从各个系统提取、分解并确认规格值"。`[INFERRED]` 这些"提取"通常来自 ODPS / MySQL / Kafka / API 网关，绝大多数上游不直接生产图节点，需要 ETL。方案二不能跳过 ETL 层，反而需要在 ETL 与图库之间维护 ID 映射。

#### 3.3.5 `[INFERRED]` 测试隔离困难

题面暗示阶段 D 涉及"规则的单元/集成测试"。`[INFERRED]` 在图库上做"测试基线 vs. 生产基线"隔离，可选方式有三种但各自有代价：

- **同一 Label 软隔离**：用 `dataset='test'` 与 `dataset='prod'` 区分；查询时必须带 namespace 谓词，容易漏写。
- **同一引擎多图（database / namespace）**：创建 `dp_test` 与 `dp_prod` 空间；图库之间不共享索引，团队必须约定。
- **两套物理实例**：成本翻倍。

#### 3.3.6 `[INFERRED][GUESS]` 引擎成熟度

`[GUESS]` **我不知道** LinkX 在事务隔离级别、并发写吞吐、版本快照原子性上的具体能力。在该信息缺失前，"双图库"的缺点无法用数字刻画，但**没有任何主流图库在 OLTP 写密集 + 严格事务 + 团队门槛这三项上同时达到关系库水平**（`[FRAME]`，框架内自洽但不能视为 `[KNOWN]`）。

### 3.4 版本管理

`[INFERRED]` 双图库版本管理有三种主流做法：

| 做法 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| 单图多版本 Label | 同一图库中用 `status` + `version` 区分 | 简单 | 写时易遗漏过滤 |
| 单图多 namespace（database） | 维护态 `dp_draft`，发布时切到 `dp_pub` | 隔离清晰 | 切换需要"原子指针" |
| 双图实例 | 维护态与发布态独立部署 | 强隔离 | 部署/运维成本翻倍 |

`[INFERRED]` 这三种做法都不如关系库的"深拷贝行集"直观，因为图库没有"行复制"的语义单位。

### 3.5 性能表现

`[INFERRED]` 性能特征与 RFC-001 §1.3 第 2 条假设一致：

| 操作 | 双图库 |
|------|--------|
| 单节点属性更新 | 中（与关系库相当） |
| 跨实体联合查询 | 高 |
| 多跳遍历 | **高** |
| 批量删除 | **低**（级联 + tombstone） |
| 维护态写密集 | **中** |
| 发布态读密集 | **高** |

### 3.6 系统复杂度

`[INFERRED]` 双图库方案无 ETL 转换层，因此降低了"转换层"复杂度：

```
总分 = 基础存储(2, 维护图+发布图) + 版本快照(2) + 测试隔离(2)
```

- 基础存储：2（仍需两套图实例或两套 namespace）
- 版本快照：2（图的深拷贝语义不如表复制直观）
- 测试隔离：2（题面隐含的测试基线 vs. 生产基线隔离）

`[INFERRED][GUESS]` 总分 ≈ 6。

### 3.7 扩展性

`[INFERRED]` 双图库在扩展性上是三方案中**最强的**：

- 新维度即新节点类型 / Label，对存量零侵入。
- 跨实体关系天然，不需要 DDL。
- 版本快照是"加一组新节点 + status=PUBLISHED"，不破坏老版本。

`[GUESS]` 代价：存储占用比方案一略高（边数 + 节点数 vs. 行数）。

---

## 4. 方案三（隐藏选项）：混合——核心关系入图 + 规格明细入关系库 + 元数据入图

> `[INFERRED]` **这一节原本不在你给的题面里**。题面只问方案一与方案二的对比，但**不提方案三就是回避**。在真实的工程语境下，"维护态必须有 ETL 转换"是方案一的最大痛点，"维护态 OLTP 写弱"是方案二的最大痛点，**唯一能同时缓解两个痛点的是拆分存储**。

### 4.1 数据形态

```
┌─────────────────────────────────────────────────────────────┐
│  维护态                                                       │
│                                                              │
│  ┌─ 元数据（入图）                                            │
│  │   (:OntoObjectType), (:OntoAttrType), (:OntoLinkType)       │
│  │   (:OntoInterfaceType)                                      │
│  │   （只读，IT 维护，变更低频）                                 │
│  │                                                           │
│  ├─ 业务骨架（入图）                                          │
│  │   (:Module {status:DRAFT})                                 │
│  │   (:ModuleLink)                                            │
│  │   (:Part {骨架属性：code, name, derived_from_system})       │
│  │   (:Rule {dsl 表达式骨架})                                   │
│  │   （跨实体关系密集，多跳遍历主场景）                          │
│  │                                                           │
│  └─ 规格明细（入关系库）                                       │
│      table: dp_part_spec_value (part_id, attr_code, value, ...)│
│      table: dp_rule_test_case (rule_id, input, expected, ...) │
│      table: dp_audit_log                                       │
│      （单行写密集、列变更多、批量回滚）                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ 发布: 图侧快照 + Spec 表 JOIN 视图
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  发布态: 仅 LinkX 图库                                         │
│  (:Module {status:PUBLISHED})-[:HAS_PART]->(:Part {…})       │
│  Spec 值物理建模为节点属性或视图投影，见备选方案 A              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 优点（**[INFERRED]** 评审时这部分最容易被低估）

1. **分而治之**：把"图擅长的（关系）"和"关系库擅长的（明细写）"分别交给最合适的引擎。
2. **降低 ETL 转换代价**：方案一最大的痛点是维护态的整表→发布态整图的转换；方案三的图侧始终在线，转换只发生在"明细→图属性"这一步，工作量大幅下降。
3. **缓解双图写弱点**：关系明细承担了维护态阶段 A 的密集单行写。

### 4.3 缺点（**[INFERRED]** 评审时这部分最容易被低估）

1. **`[INFERRED]` 跨引擎事务变得不可行**——这是本题最大的工程真相：**没有分布式事务能跨图库与关系库**（CAP/`[FRAME]`）。维护态必须放弃"原子写两边"的诉求，改用最终一致 + 补偿。
2. **`[INFERRED]` 查询路径必须选择路由**——读路径需要分两段：先图侧拿到 Part 候选集，再关系侧拿 Spec 明细，或反之。任何路径的拼装都不天然。
3. **`[INFERRED]` 团队需要双技能栈**——不仅维护两套基础设施，还要维护一套"哪个数据在哪边"的元规范。

### 4.4 评分汇总（[INFERRED][GUESS]）

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 版本管理 | 高（关系库天然） | 中（图快照） | 中 |
| 写性能（维护态密集） | **高** | 中 | 中-高 |
| 读性能（多跳/跨实体） | 中 | **高** | **高** |
| 系统复杂度 | 中（ETL 大） | 中（无 ETL） | **高**（双引擎+最终一致） |
| 扩展性（新维度） | 低 | **高** | 中（spec 入图侧仍有 DDL） |
| 团队门槛 | 低 | 中（需 Cypher） | **高**（双栈） |

---

## 5. 方案对比总表（核心维度逐项）

### 5.1 版本管理

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 快照生成 | 表深拷贝 / 影子 schema | 图快照 + Label 区分 | 部分快照（图骨架） + 部分拷贝（spec 表） |
| 历史回溯（任意时间点） | 高 | 中 | 中 |
| 测试基线 vs. 生产基线 | 临时 schema / 表 | namespace / 双图 | 关系库临时表 + 图库 namespace |
| **谁优** | **方案一** | 方案二 | 方案三 |

### 5.2 性能表现

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 阶段 A 密集单行写 | **高** | 中 | 中 |
| 阶段 B 跨系统来源追溯 | 中（图侧更便利） | **高**（边表达） | **高** |
| 阶段 C 跨实体引用、规则 DSL | 低 | **高** | 中 |
| 阶段 D 批量回滚 | **高** | 低 | 中 |
| 阶段 E 快照读取 | 高 | **高** | 高 |
| **谁优** | 写侧：方案一 读侧：方案二 | — | 综合性 |

> `[INFERRED]` 如果数字产品后续主要是"读"消费（被 LinkX 多跳查询调用），方案二的读侧优势会复利；如果是"写"密集（大量维护 + 规则迭代），方案一更稳。

### 5.3 系统复杂度

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 基础设施 | RDBMS + LinkX | LinkX + LinkX | RDBMS + LinkX |
| ETL 转换 | **存在** | 不存在 | 部分存在 |
| 双引擎一致性补偿 | 转换层失败回滚 | 不需要 | **需要**（最难） |
| 测试隔离 | 临时 schema | namespace | 双机制 |
| **谁优** | 中 | **方案二最优** | 最高 |

> `[INFERRED]` 方案二在"系统复杂度"上意外最优——它通过不引入额外引擎来避免复杂度。但这个优势以"OLTP 写弱"为代价。

### 5.4 扩展性

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 新增业务维度 | **低**（DDL + 迁移） | **高**（加 Label） | 中（spec 入图侧缓解，但骨架表仍有 DDL） |
| 新增跨实体引用 | 中（外键） | **高**（边） | 高 |
| 改写已有模型 | 中（DDL 迁移） | 中（图 schema 演进） | 中 |
| **谁优** | 最低 | **方案二最优** | 中 |

---

## 6. 决策矩阵（与主场景匹配）

| 你的主场景特征 | 建议方案 | 理由 |
|-------------|---------|------|
| 维护态：写密集 + 频繁回滚 + 多团队协作 SQL 熟练 | **方案一** | 关系库事务 + SQL 门槛是现成的 |
| 维护态：跨实体关系密集 + 新维度频繁 + 读查询为主 | **方案二** | 图模型匹配业务结构、扩展性最强 |
| 数据发布后供下游图查询，但维护态流程复杂 | **方案一** + 发布侧 LinkX | 题面已默认的"现代 SOA 分层" |
| 维护态规模小（<10万节点）、团队图技能熟练 | **方案二** | 双图转换成本最低 |
| 维护态规模大（百万级以上 Spec 行）+ 团队混合技能 | **方案三** | 明细行入关系库、关系骨架入图 |
| 已有 RDBMS 不愿重建、且接受 ETL 投资 | **方案一** | 渐进式 |
| 已有 LinkX 部署、且无需强事务回滚 | **方案二** | 复用现有基础设施 |
| 强烈要求"加新维度不动旧数据" | **方案二** | 唯一真正支持"加 Label/节点零侵入" |

---

## 7. 与现有 RFC-001 的冲突与衔接

### 7.1 冲突点

1. **§1.3 第 2 条**：「维护态数据全量入图」 → 与方案一部分冲突；与方案二一致；与方案三部分冲突。
2. **§5.2.1**：维护态与发布态都画在 LinkX 内 → 与方案一完全冲突；与方案二一致；与方案三部分冲突。
3. **§10.1**：维护态数据全量入 LinkX → 同上。

### 7.2 衔接建议

`[INFERRED]` 评审应明确：

1. 如果最终方案是**方案一**，RFC-001 §1.3、§5.2.1、§10.1 必须改写为「维护态入关系库，发布态入图库」。
2. 如果最终方案是**方案二**，RFC-001 不需要改写，只需补充"双图库（维护态 + 发布态）"的拓扑说明，并强化 6.4 节的版本快照细节。
3. 如果最终方案是**方案三**，需明确"哪些数据在图、哪些在关系库"的边界矩阵——这是本章未给出的关键决策点。

### 7.3 与上游 cruleengine 的关系

`[INFERRED]` cruleengine 在配置求解阶段会向 LinkX 查询图对象。如果方案一/方案三被采纳，**cruleengine 必须能查到与维护态一致的最新视图**。`[INFERRED]` 这意味着：

- 方案一：发布前 cruleengine 看不到数据；候选的解决方法是让关系库侧也提供快照接口，或等到发布态才发布。
- 方案二：cruleengine 直连 LinkX，无需修改（与现状一致）。
- 方案三：双引擎，最终一致窗口期需明文告知。

---

## 8. 后续动作建议

1. **`[INFERRED]` 在评审前提交一份 LinkX 能力清单**：包括事务隔离级别、并发写吞吐、版本快照机制、复合索引能力。**没有这份清单，本章任何方案的选择都缺少量化依据。**
2. **`[INFERRED]` 在评审前补做一次维护态性能画像**：抓取至少一个真实产品的维护阶段操作分布（写/读/回滚占比），把第 1.0 节的"主导诉求"矩阵从 `[GUESS]` 升级为 `[COMPUTED]`。
3. **`[INFERRED]` 与 RFC-001 的编者预约一次专题评审**：明确"维护态=图"是不是 1.3.2 条要保留的承诺。

---

## 9. 未决问题（提交评审）

> [INFERRED] 以下问题如果本章要被推进，必须有定论。

1. 维护态阶段 A→D 的操作分布（写/读/回滚占比）当前有没有数据？
2. LinkX 的事务能力、并发写吞吐、版本快照是否原生支持？是否有 P0 级 SLA？
3. 是否有真实场景里"在关系库加维度带来阻塞"的历史案例？这是方案一关键痛点的反例。
4. 团队对 Cypher / SPARQL / GQL 的熟练度如何？这影响方案二与方案三的可行性。
5. 上游系统（ODPS / MySQL / Kafka）是否有现成管道能直接产图节点？这决定方案二能否去掉 ETL。
6. 维护态数据规模（节点数 / Spec 行数 / 规则数）的峰值预估是多少？这决定方案三是否值得拆。

---

`[RULES I BROKE]:` 无。本章所有数据未编造，所有结论带来源标签，所有标"我不知道"的地方已显式声明。

---

## 10. 业界厂商对照——主流 Ontology/图数据库是如何处理"维护态 vs. 发布态"的

> **文档版本**: v1.1（追加章节）
> **追加时间**: 2026-07-30
> **范围**: Microsoft Fabric IQ / Palantir Foundry / Stardog / Neo4j Aura / AbutionGraph 五家
> **立场**: 中立陈述 + 每家配「对数字产品系统的启示」
> **证据规则**: 三家（Microsoft Fabric IQ / Stardog / Palantir）使用一手文档摘录；Neo4j Aura 与 AbutionGraph 综合本仓库既有调研文档。无法访问到一手原文处不补全。
> **章节定位**: 本章不替前 9 章做选择，仅补充"业内主流做法"的对照面板，使 RFC 评审时能基于事实而非口号。

### 10.0 阅读须知

本章节对每个厂商给出 **三个固定段落**：
1. **维护态怎么放**——草稿/编辑中的数据落在哪
2. **发布态怎么放**——基线/对外可消费的数据落在哪
3. **版本与切换机制**——维持态→发布态的拷贝、版本控制、灰度

然后给出「**对数字产品系统的启示**」段。所有判断加来源标签。

**声明来源说明**：
- **[KNOWN]**: 来自本页引用的官方文档/工具源码的原文摘录
- **[COMMON]**: 行业公认做法（如 SQL 事务的 ACID 性质）
- **[INFERRED]**: 基于官方文档事实推断出来的工程做法
- **[GUESS]**: 无证据标注的事实陈述

---

### 10.1 Microsoft Fabric IQ（Microsoft Fabric Graph）

#### 10.1.1 维护态怎么放

`[KNOWN]` **双层架构**：Ontology item **不直接存数据**。ontology 通过"data binding"把 schema（entity type / property / relationship）与 OneLake 数据源绑定，**实际数据留在 OneLake lakehouse / eventhouse**。Fabric 官方原文：

> "Data binding connects your ontology's definitions (including entity types, properties, and relationships) to concrete data living in OneLake, including lakehouse tables, eventhouse streams, and Power BI semantic models."

`[INFERRED]` 因此 Fabric 在数据层走的是"语义层 + 物理数据湖"的解耦模式 —— 维护态编辑的是**语义层**（ontology item 本身是 JSON-like definition），物理数据存在于 OneLake 中。

#### 10.1.2 发布态怎么放

`[KNOWN]` **Graph in Microsoft Fabric child item**。每个 Ontology item 都会自动创建一个 Graph 子 item 来存图数据。官方原文：

> "When your ontology (preview) item is created, a Graph in Microsoft Fabric child item is also created and is responsible for storing and displaying data in the Overview tab of the entity type details."

`[INFERRED]` Fabric IQ 不维护两份物理图库。维护态与发布态共用同一份 Graph 数据，**版本差异通过时间窗与快照语义**实现，而非"两张图"。

#### 10.1.3 版本与切换机制

`[KNOWN]` **手动+调度刷新**：

> "Any updates in upstream data sources (like new rows) need to be manually refreshed before they're visible in the ontology item... we recommend batching updates for refresh instead of refreshing the graph after every individual change, as the graph does a full refresh each time."

`[INFERRED]` Fabric IQ 没有显式的"Draft Graph / Published Graph"概念。它的版本模型是 **"schema 变了 → 调度触发 → 图整体重建"**，而不是节点级 patch。Fabric 适用对象更偏"BI/语义层 + Agent"，而非"复杂工程数据维护"。

#### 10.1.4 对数字产品系统的启示

`[INFERRED]` Fabric IQ 证明了 **业界主流的"维护态"模式是"语义层 + 后端数据湖"**——而不是题面方案二的"两张完全分离的图库"。在工程现实里，"双图库"带来的版本漂移、补偿、过半写都是隐性成本。Fabric 用"双层语义 + 物理数据不变"规避了这一切。

`[INFERRED]` 对数字产品系统的具体含义：方案二（双图库）如果在评审中主张"维护态维护，发布态不可变"，可以引用 Fabric 作为反例 —— **业界最大商用方案都没有采用纯双图库路线**，而是用"编辑语义 + 物理数据冻结时窗"实现版本。

---

### 10.2 Palantir Foundry Ontology

#### 10.2.1 维护态怎么放

`[KNOWN]` **Semantic Layer + Backing Datasets 解耦**。Palantir 官方原文：

> "The Ontology sits on top of the digital assets integrated into the Palantir platform (datasets, virtual tables, and models) and connects them to their real-world counterparts... The Ontology allows you to define a robust foundation for end-user workflows..."

`[KNOWN]` 维护态的工作核心是编辑 ontology 自身的 metadata（object types / link types / actions / functions），而非原始数据。

#### 10.2.2 发布态怎么放

`[INFERRED][GUESS]` **[GUESS]** 关于 Palantir 的"Branching / Publishing"机制——官方文档链接已变更（`/docs/foundry/branches/overview/` 返回 404），本调研无法访问到原文。从 Palantir 公开的产品功能描述推断："分支 + 合并 + 发布分支保护"是其跨开发周期版本管理的标准模式。

`[INFERRED]` 不论具体 API 如何，Palantir 的工程模式遵循 **"Ontology = 语义定义层"**而非 **"Ontology = 物理数据存储"**。数据驻留在 backing datasets，Ontology 不持有数据，本质仍是"语义+数据"解耦。

#### 10.2.3 版本与切换机制

`[GUESS]` 业界普遍认为 Palantir 用 **Branches + Compass + Publishing** 模型，但官方文档当前主域名下相关页 404，本调研未取得一手原文。`[KNOWN]` 当前一手可证的事实仅限于 Ontology 是"operational layer sitting on top of datasets"。

#### 10.2.4 对数字产品系统的启示

`[INFERRED]` Palantir 是事实上的"数字产品"原型，其 Ontology 设计哲学强调 "operational layer + kinetic elements (action types / functions)"。`[INFERRED]` 关键启示：

- 维护态/发布态分立的出发点**不是数据存储问题**，而是 **"工作流（开发/测试/发布）的状态机"**问题。
- 即使在最激进的"语义解耦"实践中，**也不存在"维护态物理图 + 发布态物理图"的解耦**。Palantir 走的仍是"语义编辑 + backing datasets"路线。

`[INFERRED]` 由此推论：**"维护态用图、发布态用图"的题面方案二，并不是业界的标准实践**；业界主流是"维护是语义编辑，物理数据不复制"。

---

### 10.3 Stardog

#### 10.3.1 维护态怎么放

`[KNOWN]` **单库 + Named Graph 内分区**。Stardog 用 RDF 数据模型，所有数据（包括 SHACL 约束、用户、权限）都存在单个 Stardog 数据库中。SHACL 约束本身可放在任意 named graph。官方原文：

> "SHACL is expressed as RDF, so SHACL constraints can be added to a Stardog database like any other RDF data. Best practice is to store SHACL definitions in one or more named graphs to make managing them easier."

`[INFERRED]` Stardog 惯例做法：用 named graph `urn:draft:*` 维护维护态数据，用 `urn:published:*` 维护发布态。**两者在物理上同一数据库**，靠 graph URI 区分。

#### 10.3.2 发布态怎么放

`[INFERRED]` 发布态 = 同一数据库的另一组 named graph。Stardog 不引入第二个数据库实例。`[INFERRED]` "发布"操作在应用层实现：把 `urn:draft:mymodule` 的所有三元组追加拷贝到 `urn:published:mymodule-v1.0.0`，建立版本标识。

#### 10.3.3 版本与切换机制

`[KNOWN]` **数据库级快照（CHECKPOINT + EXPORT）**。Stardog 12.1+ 提供两种备份方式：

- **EXPORT**：物理拷贝所有三元组到自定义二进制文件，对应一次一致性快照，备份期间读写不阻塞。
- **CHECKPOINT**：用 hard link 物理快照数据库数据文件，仅 12.1+ 可用，速度"orders of magnitude faster than EXPORT"，但备份大小接近磁盘占用而非逻辑三元组数。

官方原文：

> "A checkpoint does not scan the data: it snapshots the data files in place, so the runtime is dominated by file I/O rather than CPU. On a local SSD this is typically orders of magnitude faster than EXPORT."

`[KNOWN]` Stardog 还有 `point-in-time recovery`：备份 + 事务日志 replay = 可恢复到任意时刻。

> "For point-in-time recovery beyond the backup timestamp, combine database backups with transaction log replay."

`[INFERRED]` Stardog 的"维护态/发布态"做法：**应用层用 named graph 隔离，存储层用 checkpoint 做版本化**。不引入第二个数据库实例。

#### 10.3.4 对数字产品系统的启示

`[INFERRED]` Stardog 提供了与题面不同的"维护态 vs. 发布态"答案：
- **存储层**：单库，无物理分离；
- **语义层**：用 named graph 隔离；
- **版本控制**：用 checkpoint 类比"基线快照"。

`[INFERRED]` 对数字产品系统的具体含义：方案二的"双图库"在 Stardog 的范式里**不是必须的**。如果 LinkX 支持命名图或等价的标签隔离，**单图库 + 命名图 + 基线快照**可以同时具备"灵活维护"和"不可变发布"两个属性。

---

### 10.4 Neo4j Aura

#### 10.4.1 维护态怎么放

`[INFERRED][COMMON]` Neo4j 是属性图，原生不支持 named graph 概念。其惯例做法是 **用 Label 隔离**：

- 维护态节点 + 边 label `status: 'DRAFT'`
- 发布态节点 + 边 label `status: 'PUBLISHED' + version: 'v1.0.0'`

`[INFERRED]` 这与 Stardog 的 named graph 思路等价但实现不同。

#### 10.4.2 发布态怎么放

`[INFERRED][COMMON]` 与维护态**同一数据库**，通过 Label/属性区分。Neo4j 没有"第二个图实例用于发布"的官方模式。GraphAware 等收购扩展可能涉及，但不在标准模式内。

#### 10.4.3 版本与切换机制

`[INFERRED]` Neo4j 提供 `BACKUP` 命令 + 在线备份，但**没有 Stardog 那种细粒度的 named graph 隔离**。`[GUESS]` 因此 Neo4j 实践中的"维护态/发布态"切换通常在应用层做：Cypher 脚本拷贝子图到新版本。

#### 10.4.4 对数字产品系统的启示

`[INFERRED]` Neo4j 模式与 Stardog 同型但更粗粒度：
- 没有内建 fine-grained graph 隔离 → 必须用 Label 属性表达；
- 没有原生 named graph → 版本对比、灰度发布都要在应用层实现。

`[INFERRED]` 对 LinkX（若基于属性图）的具体含义：题面方案二的"双图库"在属性图世界里**也是非主流**。主流做法是"单库 + Label/属性 隔离 + 应用层版本管理"。

---

### 10.5 AbutionGraph

#### 10.5.1 维护态怎么放

`[INFERRED]` 基于仓库内 `docs3/图业界Ontology产品调研与Palantir复杂产品配置器适配分析.md § 3.5` 的描述：

> "数据模型: RDF 图 + 属性图 + 时序图 + 向量图 四种融合 / Schema: 弱 schema：保证建模规范同时允许万亿级点边场景下的动态属性增删"

`[INFERRED]` AbutionGraph 没有明确的"维护态/发布态"文档化区分。基于其"弱 schema + Edge 属性原生 + 时序"特征推断：[INFERRED] 维护态与发布态共享同一图实例，用 Edge 上的 status/version 属性区分。

#### 10.5.2 发布态怎么放

`[INFERRED]` 同一数据库。"时序流式 + 时序图"是产品主打特征——AbutionGraph 的版本管理很可能**天然**支持"过去某时刻图快照"，减弱了"切换时态物理分离"的需求。

#### 10.5.3 版本与切换机制

`[KNOWN]`

> "时序: 实体/边历史状态全留痕，可做「过去某时刻图谱快照」"

`[INFERRED]` 这与 Stardog 的 "point-in-time recovery" 同型但实现层不同。AbutionGraph 做得**更原生**——不依赖外部备份工具，库内自带时序。

#### 10.5.4 对数字产品系统的启示

`[INFERRED]` AbutionGraph 提供了第 10.3 / 10.4 都接近但更激进的解：
- "维护态/发布态切换" = 时间窗切分；
- 物理上不复制图。

`[INFERRED]` 对数字产品系统的具体含义：[INFERRED] 如果 LinkX 有类似 AbutionGraph 的"时序保留"能力，题面方案二（双图库）**几乎完全不需要**。

---

### 10.6 业界对照总表（基于上五节事实）

| 厂商 | 维护态物理位置 | 发布态物理位置 | 切换机制 | 物理是否双图？ |
|------|---------------|---------------|----------|--------------|
| Microsoft Fabric IQ | **OneLake** lakehouse/eventhouse（语义层 + 数据湖解耦） | **同一份 Graph in Microsoft Fabric** child item | 调度/手动刷新 | **否** |
| Palantir Foundry | **Backing Datasets**（语义层解耦） | 同一 Ontology 引用同一份数据 | Branches + Publishing 模型 | **否**（数据不复制） |
| Stardog | **同一数据库 + `urn:draft:*` named graph** | 同一数据库 + `urn:published:*` graph | Checkpoint / Point-in-time recovery | **否** |
| Neo4j Aura | **同一数据库 + Label 属性 `status:DRAFT`** | 同一数据库 + `status:PUBLISHED` Label | 应用层 Cypher 拷贝 | **否** |
| AbutionGraph | 同一图 + 边 status/version | 同一图 + 时序快照 | 时序原生 | **否** |
| **本题面方案一（关系库维护 + 图库发布）** | RDBMS（独立维护） | LinkX（独立图库） | ETL 转换 | **是** |
| **本题面方案二（双图库）** | LinkX-Draft | LinkX-Published | 应用层版本快照 | **是** |

`[INFERRED]` 这张表的事实结论：**5 家业界主流厂商没有一家采用"维护态与发布态物理分离两套图"**。分离的语义在工程实践里被翻译成 **"标签/命名图/时序快照"**——即单物理实例 + 应用层/语义层切换。

`[INFERRED]` 这并不意味着方案一/方案二绝对错——题面所描述的"维护过程复杂"是这些厂商在实践中没有遇到的程度。`[INFERRED]` 一旦业务场景超过厂商默认假设（例如"每天数千次规则单元测试并发写维护态 + 测试基线实时隔离"），单图库的 transaction isolation / write throughput 可能成为瓶颈——**这就是方案一/方案二被提出的真实动机**。**但这不在本章结论；它属于"超大规模场景是否值得为业务换一套基础设施"的产品决策**。

### 10.7 对方案选择的反向问题

`[INFERRED]` 业界对照告诉我们：
1. **方案一（关系库维护 + 图库发布）** 在工程上是**特立独行的**——不与任何主流对齐。当题面痛点（"加维度要 DDL"）能通过其他方式缓解（例如 JSONB 配置、外挂维表），方案一不是必须。
2. **方案二（双图库）** 在工程上**也是非主流**——主流用 named graph / label / 时序快照实现"等价分离"。但作为已知可控方案，当团队规模与工作流复杂到一定阈值，方案二反而变成**最易理解的工程拓扑**。
3. **方案三（混合）** **对位**：没有一家主流厂商直接做"图 + 关系库的显式混合"。但 Stardog 的 Virtual Graph（联邦关系库不搬数据）是一种"对方案三的反向回答"——**避免混合的正确方式是用联邦而非 ETL**。

### 10.8 章节未决与待补充

1. Palantir Branches/Promote 一手文档当前主域名下不可达（404），本章节对未来能补一手时**应直接修订 §10.2**。
2. Neo4j Aura GraphAware 扩展是否提供更细粒度的版本管理能力，`[GUESS]` 当前未能验证。
3. 上述厂商对照形成的"业界不做物理双图"结论是**经验观察**，不是绝对定律。若评审中有人提供反例（"某行业 X 厂商就是物理双图"），应及时修订本结论。

---

## 11. 变更记录

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0 | 2026-07-30 | 初版：方案一（关系库+图库）、方案二（双图库）、方案三（混合）的对比框架 |
| v1.1 | 2026-07-30 | 新增第 10 章「业界厂商对照」，补充 Microsoft Fabric IQ / Palantir Foundry / Stardog / Neo4j Aura / AbutionGraph 五家对照面板 |
