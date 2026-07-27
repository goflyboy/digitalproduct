# 复杂产品配置器的数据模型详解

> **文档版本**: v1.0  
> **创建时间**: 2026-07-27  
> **适用场景**: 复杂产品本体建模、产品平台建模、可售产品实例化与产品配置  
> **参考资料**: docs/电商产品数据模型.md、MultiPCTest.java 及 cruleengine 现有模型

---

## 目录

1. 总体数据模型
2. 详细数据案例
3. 业务处理流程
4. 新模型与 cruleengine 现有模型的关系
5. 扩展性、版本与治理

---

## 一、总体数据模型（核心实体及关系）

### 1.1 建模边界与核心结论

复杂产品配置不能直接套用电商的 Category -> SPU -> SKU 模型。SPU/SKU 重点是交易与库存粒度；复杂产品还必须表达多级组成、部件候选集、规格、数量、兼容和依赖规则、计算参数、优选目标以及配置求解结果。

本文将数据分成四层：

| 层次 | 解决的问题 | 核心对象 | 典型责任人 |
| --- | --- | --- | --- |
| L0 平台基础元模型 | 平台能够定义什么类型的对象、属性和关系 | OntoObjectType、OntoAttrType、OntoLinkType | 平台架构师、IT、FDE |
| L1 业务元模型 | 产品领域允许定义哪些业务类型及语义 | ProductClassType、PartClassType、ProductInstanceType | IT 与公司级业务/行管人员 |
| L2 业务对象实例 | 某产品平台的骨架是什么，可售型号如何裁剪 | ProductClass、PartClass、Part、ProductInstance | 产品数据架构师、产品数据工程师 |
| L3 配置运行实例 | 客户本次选择什么，是否有效，输出什么 | Configuration、ConfiguredPart、ConstraintEvaluation | 销售、客户、配置引擎 |

“元模型 -> 实例”发生两次：

- L0 的实例是 L1 的产品领域类型定义。
- L1 的实例是 L2 的具体产品模型和可售产品实例。
- L3 是面向一次交易、报价或方案的运行数据，不等同于 L2 的可售产品实例。

### 1.2 四层概念架构图

~~~text
┌──────────────────────────────────────────────────────────────────────┐
│ L0 平台基础元模型                                                     │
│ OntoObjectType ──hasAttr──> OntoAttrType                              │
│ OntoObjectType ──from/to──> OntoLinkType <──from/to── OntoObjectType  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ instantiate
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L1 业务元模型                                                         │
│ ProductClassType ──composedOf──> PartClassType                        │
│ PartClassType ──hasSpec──> SpecDefinition                             │
│ ProductInstanceType ──realizes──> ProductClassType                    │
│ ExtensionSchema / LifecycleType                                       │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ instantiate
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L2 业务对象实例                                                       │
│ ProductClass(服务器平台) ──contains──> PartClass(CPU/硬盘/内存)         │
│ PartClass ──candidate──> Part(cpu1/cpu2/sd1/md1...)                   │
│ ProductClass ──constrainedBy──> ConstraintRule                        │
│ ProductInstance(S1110/S22) ──realizes/cuts──> ProductClass/Part       │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ configure
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L3 配置运行实例                                                       │
│ Configuration ──selects──> ConfiguredPart(code, quantity, values)     │
│ Configuration ──evaluatedBy──> ConstraintEvaluation                  │
│ Configuration ──produces──> BOM / Price / DeliverySpecification      │
└──────────────────────────────────────────────────────────────────────┘
~~~

### 1.3 L0：平台基础元模型

#### 1.3.1 定义类对象

| 实体 | 定义 | 关键字段 | 关系 |
| --- | --- | --- | --- |
| OntoObjectType | 可被实例化的对象类型 | id, code, name, version, abstract, parent_type_id, lifecycle_type_id | 1:N -> OntoAttrType；N:M -> OntoLinkType |
| OntoAttrType | 对象属性的类型、基数和值域定义 | id, code, data_type, cardinality, required, unit_type, value_domain, default_value | N:1 -> OntoObjectType |
| OntoLinkType | 对象之间的有向关系类型 | id, code, source_type_id, target_type_id, cardinality, inverse_code, composition | 关联源/目标 OntoObjectType |
| ExtensionSchema | 指定对象可挂载的扩展字段组 | id, code, applies_to_type, namespace, version, fields[] | N:M -> OntoObjectType |
| LifecycleType | 状态、迁移和发布门禁定义 | id, code, states[], transitions[] | 1:N -> OntoObjectType |

#### 1.3.2 实例类对象

| 实体 | 定义 | 关键字段 | 约束 |
| --- | --- | --- | --- |
| OntoObjectInst | OntoObjectType 的具体实例载体 | id, object_type_id, business_key, version, status, effective_from/to | business_key + version 唯一 |
| OntoAttrInst | 对象实例的属性值 | object_inst_id, attr_type_id, typed_value, unit, locale, source | 值符合 OntoAttrType |
| OntoLinkInst | 两个对象实例之间的关系 | link_type_id, source_inst_id, target_inst_id, qualifiers, sequence, effective_from/to | 两端类型符合 OntoLinkType；qualifiers 符合该 Link Type 的限定属性 Schema |

OntoAttrInst 应保存类型化的值，例如 string_value、decimal_value、date_value 或 json_value；不应把所有值无差别地存成字符串。

### 1.4 L1：业务元模型

L1 不是与 L0 平行的另一套底层机制，而是使用 L0 的 Object/Attr/Link Type 能力定义产品领域语义。

#### 1.4.1 产品模型元模型

| 业务类型 | 语义 | 主要属性 | 主要关系 |
| --- | --- | --- | --- |
| ProductClassType | 产品族或产品平台类型，承载平台化和标准化 | code, name, domain, modeling_policy | composedOf -> PartClassType |
| PartClassType | 可配置子模块的抽象，如 CPU、硬盘、显示器 | code, name, part_kind, selection_policy, min/max_cardinality, multi_instance | hasSpec -> SpecDefinition；contains -> PartClassType |
| SpecDefinition | 属性或规格定义 | code, name, data_type, unit, value_domain, required, instance_scope | definedOn -> ProductClassType/PartClassType |
| Part | PartClass 的具体实例，如一个明确编码的 CPU 或硬盘 | code, name, status | instanceOf -> PartClassType |

PartClass 是分类和候选集边界，Part 是 PartClass 的对象实例。用面向对象语言类比时，也不应让每个物料通过程序类继承 PartClass；否则新增物料会变成类结构变更。

> **TODO：配置规则元模型。** 兼容、依赖、数量、计算、优选、实例增量规则及表达式 Schema 后续单独设计。本版仅在样例数据和 cruleengine 映射章节使用 ConstraintRule 作为现有执行数据的统称，不将其纳入业务元模型。

#### 1.4.2 产品实例元模型

| 业务类型 | 语义 | 主要属性 | 主要关系 |
| --- | --- | --- | --- |
| ProductInstanceType | 可售产品定义，如 S1110、S22 | code, name, market, status, effective_period | realizes -> ProductClassType |
| SpecValueType | 将规格定义赋为具体值 | value, unit, source, override_reason | valueOf -> SpecDefinition |

ProductInstance 不宜使用程序类继承 ProductClass。它应通过 realizes 关系绑定一个已发布的 ProductClassVersion。ProductInstance 对 Part 的可用性和裁剪使用 offersPart Link Type 表示，其 OntoLinkInst 保存 enabled、default_selected、min/max_qty、fixed、sales_status 等边属性。

#### 1.4.3 ProductInstance 与 Part 为什么使用边

ProductInstance 与 Part 是 N:M 关系：同一个可售产品包含多个 Part，同一个 Part 也可被多个可售产品复用。因此直接采用 offersPart Link Type 和 OntoLinkInst 表示，不额外创建中间业务实体。

| Link Type | source | target | OntoLinkInst 上的限定属性 |
| --- | --- | --- | --- |
| offersPart | ProductInstance | Part | enabled, default_selected, fixed, min_qty, max_qty, sales_status, effective_from/to |

当这段关系只表达“某型号能否选择某 Part”时，边是最直接的模型。如果未来该关系自身需要独立编码、审批流程、负责人、生命周期，或被价格/合同等其他对象引用，再将其升级为关系实体；当前不预先实体化。

### 1.5 L2：业务对象实例

L1 定义“允许出现什么类型及关系”，L2 只保存这些类型的具体业务对象，不再重复定义一套实体结构。例如：

| L1 类型或关系 | L2 业务实例 |
| --- | --- |
| ProductClassType | ProductClass：SERVER_X86 |
| PartClassType | PartClass：cpu、drive、memory、software |
| Part | cpu1、cpu2、sd1、md1 |
| ProductInstanceType | ProductInstance：S1110、S22 |
| containsPartClass | SERVER_X86 -> cpu、SERVER_X86 -> drive |
| instanceOf | cpu1 -> cpu、sd1 -> drive |
| realizes | S1110 -> SERVER_X86@1.0.0 |
| offersPart | S1110 -> cpu1、S1110 -> md1，并在边上保存裁剪值 |

ProductClass 是产品族或平台的可复用骨架，ProductClassVersion 是不可变的发布基线。ProductInstance 是确定销售边界的可售产品，对标电商时更接近可配置 SPU，而不是最终库存 SKU。

裁剪只保存相对于 ProductClassVersion 的边差异，不复制完整 ProductClass。有效候选集由“ProductClassVersion 基线 + offersPart 边”得到。规格覆盖先保留 SpecOverride；规则覆盖归入规则元模型 TODO，本版不展开。

### 1.6 L3：配置运行实例

| 实体 | 定义 | 关键字段 |
| --- | --- | --- |
| Configuration | 一次客户配置方案 | id, product_instance_id, model_snapshot_id, status, customer_context, created_at |
| ConfiguredPart | 已选 Part、实例号和数量 | configuration_id, part_id, part_class_path, instance_no, quantity, selected, source |
| ConfiguredValue | 本次输入或属性值 | owner_type/id, spec_or_parameter_id, value, unit, source |
| ConstraintEvaluation | 规则评估结果 | rule_id, passed, severity, message, involved_objects[] |
| ConfigurationSolution | 引擎候选解或推荐解 | rank, objective_values, selected_parts[], explanation |
| ConfigurationArtifact | BOM、报价、销售或交付规格等产物 | artifact_type, uri/content, version |

model_snapshot_id 必须指向不可变的有效模型快照。否则模型升级后，历史报价和 BOM 无法复现。

### 1.7 核心 ER 关系

~~~text
OntoObjectType 1 ── N OntoAttrType
OntoObjectType 1 ── N OntoLinkType(source/target)
OntoObjectType 1 ── N OntoObjectInst
OntoObjectInst 1 ── N OntoAttrInst
OntoObjectInst N ── N OntoObjectInst (through OntoLinkInst)

ProductClass 1 ── N ProductClassVersion
ProductClassVersion 1 ── N PartClass
PartClass 1 ── N PartClass (recursive composition)
PartClass 1 ── N Part
PartClass 1 ── N SpecDefinition
Part 1 ── N SpecValue
ProductClassVersion 1 ── N ConstraintRule

ProductInstance N ── 1 ProductClassVersion
ProductInstance N ── N Part (through offersPart OntoLinkInst)
ProductInstance 1 ── N SpecOverride

Configuration N ── 1 ProductInstance
Configuration 1 ── N ConfiguredPart N ── 1 Part
Configuration 1 ── N ConstraintEvaluation / ConfigurationSolution
~~~

---

## 二、详细数据案例（以服务器产品为例）

### 2.1 L0 基础元模型数据

| object_type_id | code | name | abstract |
| --- | --- | --- | --- |
| OT001 | ProductClass | 产品类 | false |
| OT002 | PartClass | 部件分类 | false |
| OT003 | Part | 部件 | false |
| OT004 | ProductInstance | 可售产品实例 | false |
| OT005 | ConstraintRule | 约束规则 | false |

| id | owner/source | code | type/target | cardinality |
| --- | --- | --- | --- | --- |
| AT001 | PartClass | selectionPolicy | ENUM | 1 |
| AT002 | PartClass | supportMultiInstance | BOOLEAN | 1 |
| AT003 | Part | price | DECIMAL | 0..1 |
| LT001 | ProductClass | containsPartClass | PartClass | 1:N |
| LT002 | PartClass | containsPart | Part | 1:N |
| LT003 | ProductInstance | realizes | ProductClassVersion | N:1 |
| LT004 | ProductInstance | offersPart | Part | N:M |

### 2.2 产品模型数据

#### 产品模型与部件分类

| model_code | version | part_class_code | name | selection_policy | min_qty | max_qty | multi_instance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SERVER_X86 | 1.0.0 | cpu | CPU | REQUIRED | 1 | 2 | false |
| SERVER_X86 | 1.0.0 | drive | 硬盘 | OPTIONAL | 0 | 8 | true |
| SERVER_X86 | 1.0.0 | memory | 内存 | REQUIRED | 1 | 16 | true |
| SERVER_X86 | 1.0.0 | software | 配套软件 | OPTIONAL | 0 | 10 | false |

#### CPU 规格和 Part

| part_code | CoreNum | Memory | ConfigType | price |
| --- | ---: | ---: | ---: | ---: |
| cpu1 | 2 core | 123 GB | 2 | 100 |
| cpu2 | 4 core | 256 GB | 2 | 200 |
| cpu3 | 8 core | 512 GB | 5 | 400 |
| cpu4 | 18 core | 1024 GB | 5 | 800 |

#### 硬盘规格和 Part

| part_code | Speed | Capacity | Type | price |
| --- | ---: | ---: | --- | ---: |
| sd1 | 5400 rpm | 3 TB | sd | 50 |
| sd2 | 7200 rpm | 6 TB | sd | 80 |
| sd3 | 9000 rpm | 9 TB | sd | 90 |
| md1 | 5400 rpm | 1 TB | md | 30 |
| md2 | 7200 rpm | 2 TB | md | 40 |
| md3 | 9000 rpm | 3 TB | md | 60 |

#### 配置规则

| rule_code | rule_kind | scope | 自然语言 | 结构化语义 |
| --- | --- | --- | --- | --- |
| R_CPU_DRIVE_01 | INCOMPATIBLE | CROSS_CATEGORY | 4 核 CPU 不兼容固态硬盘 | cpu.CoreNum=4 => drive.Type!=sd |
| R_CPU_01 | CARDINALITY | cpu | 仅能使用一种 CPU | count(selected(cpu.Part))<=1 |
| R_DRIVE_01 | CARDINALITY | drive instance | 固态硬盘必须同一种且最多 2 块 | distinct(Type=sd)<=1 AND sumQty(Type=sd)<=2 |
| R_DRIVE_02 | PREFERENCE | drive | 满足容量时优先高容量、低超额、少部件 | 多目标加权优化 |

### 2.3 可售产品实例数据

| 字段 | S1110 低端服务器 | S22 高端服务器 |
| --- | --- | --- |
| model_version | SERVER_X86@1.0.0 | SERVER_X86@1.0.0 |
| market | CN | CN/Global |
| enabled_parts | cpu1, cpu2, md1, md2, sd1 | cpu2, cpu3, cpu4, sd2, sd3, md2, md3 |
| excluded_parts | cpu3, cpu4, sd2, sd3, md3 | cpu1, sd1, md1 |
| default_parts | cpu1 x1, md1 x1 | cpu3 x1, sd2 x1 |
| positioning | 低端通用 | 高端计算与存储 |

S1110 示例：

~~~json
{
  "code": "S1110",
  "realizes": {
    "productModelCode": "SERVER_X86",
    "version": "1.0.0"
  },
  "offersPartLinks": [
    {"partCode": "cpu1", "enabled": true, "defaultSelected": true, "minQty": 1, "maxQty": 1},
    {"partCode": "cpu2", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2},
    {"partCode": "cpu3", "enabled": false},
    {"partCode": "sd1", "enabled": true, "defaultSelected": false, "minQty": 0, "maxQty": 2},
    {"partCode": "md1", "enabled": true, "defaultSelected": true, "minQty": 1, "maxQty": 8}
  ],
  "extensions": {
    "sales": {
      "sellingPoints": ["紧凑型", "低成本"],
      "brochureAssetId": "ASSET-S1110-CN"
    },
    "delivery": {
      "leadTimeDays": 7,
      "packagingClass": "SERVER_STANDARD"
    }
  }
}
~~~

### 2.4 客户配置实例

客户要求：选择 S1110，5400 rpm 硬盘总容量至少 5 TB，4 核 CPU 总支持内存至少 512 GB。

~~~json
{
  "configurationId": "CFG-20260727-0001",
  "productInstanceCode": "S1110",
  "modelSnapshot": "SERVER_X86@1.0.0+S1110@1",
  "requirements": [
    "drive:Sum_Capacity >=5 where Speed=5400",
    "cpu:Sum_Memory >=512 where CoreNum=4"
  ],
  "solution": {
    "configuredParts": [
      {"partCode": "cpu2", "quantity": 2, "selected": true},
      {"partCode": "md1", "quantity": 5, "selected": true},
      {"partCode": "sd1", "quantity": 0, "selected": false}
    ],
    "constraintStatus": "VALID"
  }
}
~~~

该结果对应 MultiPCTest.mixInCompatibleLeftYRightY() 的核心场景：4 核 CPU 排除固态硬盘，因此 5400 rpm 容量需求由 md1 满足。

---

## 三、业务处理流程（以服务器从建模到配置为例）

### 3.1 流程总览

~~~text
平台本体建模       产品领域建模          产品模型设计
Object/Attr/Link -> Product/Part/Rule -> SERVER_X86 + CPU/drive
      │                  │                    │
      ▼                  ▼                    ▼
元模型发布          业务类型发布          模型版本发布
                                               │
                                               ▼
报价/BOM/交付 <- 配置求解与校验 <- S1110/S22 实例化裁剪
~~~

### 3.2 阶段 A：平台基础元模型

**责任人：** 平台架构师、IT、公司级业务专家或 FDE。

1. 定义 OntoObjectType、OntoAttrType、OntoLinkType 的通用规则。
2. 定义数据类型、基数、单位、值域、多语言和有效期能力。
3. 定义扩展 Schema、版本和生命周期机制。
4. 校验元模型自洽后发布；已发布版本不可就地修改。

### 3.3 阶段 B：业务元模型

**责任人：** IT 与公司级产品、研发、销售、供应行管人员。

1. 用 L0 创建 ProductClassType、PartClassType 和 ProductInstanceType；Part 直接作为 PartClass 的对象实例。
2. 明确组合、实例化、引用和裁剪关系。
3. 定义规格、规则、选择策略和多实例等共性结构。
4. 发布业务元模型版本，为各产品线提供统一模板。

### 3.4 阶段 C：产品模型设计

**责任人：** 产品线数据架构师，与产品设计、研发和工程人员协作。

1. 建立服务器模型及 CPU、内存、硬盘、软件等 PartClass。
2. 定义规格、值域、单位、必填性和实例范围。
3. 录入 cpu1、cpu2、sd1、md1 等 Part 及规格值。
4. 定义兼容、依赖、数量、计算和优选规则。
5. 完成结构、值域、规则可满足性和回归校验后发布模型版本。

### 3.5 阶段 D：可售产品实例化

**责任人：** 熟悉具体型号的产品数据工程师。

1. 选择已发布 ProductClassVersion 作为基线。
2. 创建 S1110/S22，填写型号、市场、渠道和有效期。
3. 通过 offersPart Link Inst 包含或排除 Part，并在边上设置默认、固定和数量边界。
4. 仅通过 SpecOverride 保存必要的规格差异；规则差异等待规则元模型设计完成后纳入。
5. 验证裁剪后仍至少存在一个可行配置，再发布产品实例。

### 3.6 阶段 E：客户配置和下游产物

1. 锁定 ProductInstance 和完整模型快照。
2. 将客户输入转换为结构化需求。
3. 执行候选 Part 过滤、硬约束校验和优选求解。
4. 返回可行解，并保存规则命中证据或不可行原因。
5. 生成 BOM、报价、销售规格和交付规格。

---

## 四、新模型与 cruleengine 现有模型的关系

### 4.1 定位

新模型是数字产品全生命周期的业务事实模型；cruleengine 主要是配置约束的声明和执行模型。二者是“业务事实源 -> 可执行投影”关系，不应强制共用同一套持久化类。

~~~text
数字产品模型                    cruleengine 执行模型
ProductClassVersion  ──compile──> Module
PartClass            ──compile──> PartCategory
Part + SpecValue     ──compile──> Part + dynAttr
InputParameter       ──compile──> Para
ConstraintRule       ──compile──> Rule / RuleSchema / algorithm
Configuration        <──result─── ModuleInst
ConfiguredPart       <──result─── PartInst / PartCategoryInst
~~~

### 4.2 概念映射

| 新建模概念 | cruleengine 概念 | 关系和差异 |
| --- | --- | --- |
| ProductClassVersion | Module | Module 含版本、PartCategory、Part、Para 和 Rule，是执行投影 |
| PartClass | PartCategory | 均表达候选分类；现有类已有 selectionPolicy、supportMultiInst 和递归结构 |
| Part | Part | 基本一致；业务层还需物料主数据、有效期、供应和销售状态 |
| SpecDefinition | DynamicAttribute | 均支持类型和选项；业务层还需单位、值域、治理和版本 |
| SpecOption | DynamicAttributerOption | 对应选项编码和值 |
| InputParameter | Para | 对应输入、计算和汇总参数 |
| ConstraintRule | Rule + RuleSchema | 业务规则编译为可执行 Schema 或算法 |
| ConfigurationSolution | ModuleInst | ModuleInst 承载数量、优先级值和分类实例 |
| ConfiguredPart | PartInst | 对应 quantity、selected、hidden 和选中属性 |
| ExtensionValue | Extensible.extSchema/extAttrs | 可作运行载体，但业务层仍需 Schema 注册和治理 |

### 4.3 MultiPCTest 样例映射

- drive 和 cpu 对应 PartClass。
- Speed、Capacity、Type、CoreNum、Memory、ConfigType 对应 SpecDefinition。
- sd1..sd3、md1..md3、cpu1..cpu4 对应 Part 及 SpecValue。
- logicAB1、logicA1、logicB1、logicB2 分别对应跨分类不兼容、选择基数、实例数量和优选规则。
- inferRecommendModule(...) 的输入对应 Configuration 的需求；ModuleInst 和断言结果对应 ConfigurationSolution。

### 4.4 需要保持的边界

1. cruleengine.Module 不应兼任产品主数据仓库；应由编译或适配层从已发布业务模型生成。
2. 现有 Part.price 只是单值，不足以承载币种、区域、渠道、阶梯和有效期定价；业务模型应引用独立定价域。
3. extAttrs 适合传递已知 Schema 的扩展值，不应替代属性定义、校验、索引、权限和版本管理。
4. ProductInstance 可编译成裁剪后的 Module，也可使用基础 Module 加候选集过滤输入；需通过性能和版本隔离测试选择。

---

## 五、扩展性、版本与治理

### 5.1 动态扩展模型

扩展采用“命名空间 + Schema + 类型化值”模式：

| 对象 | 扩展命名空间示例 | 内容 |
| --- | --- | --- |
| PartClass | sales.part-class.v1 | 销售名称、卖点、适用客群、资料关联 |
| PartClass | delivery.part-class.v1 | 交付方式、安装条件、交付周期 |
| Part | supply.part.v1 | 供应商、采购状态、替代料 |
| ProductInstance | channel.offering.v1 | 区域、渠道、上下架时间 |
| Configuration | delivery.result.v1 | 包装、物流、安装产物 |

~~~json
{
  "schema": "delivery.part-class.v1",
  "owner": {"type": "PartClass", "id": "drive"},
  "values": {
    "installationSkill": "L2",
    "leadTimeDays": 5,
    "deliveryDocumentIds": ["DOC-DRIVE-001"]
  }
}
~~~

扩展 Schema 必须声明适用对象、字段类型、必填性、版本、权限和索引策略。高频查询、规则引用或跨系统契约依赖的字段，应从扩展属性晋升为正式属性或独立对象。

### 5.2 属性值解析优先级

~~~text
本次配置输入
  > ProductInstance 的 SpecOverride
  > Part 的 SpecValue
  > ProductClass/PartClass 的默认值
  > 业务元模型的默认值
~~~

覆盖应记录 source、reason、operator 和 timestamp。

### 5.3 版本与发布

| 对象 | 版本策略 |
| --- | --- |
| L0 元模型 | 兼容变更升次版本，破坏性变更升主版本 |
| L1 业务元模型 | 显式绑定 L0 版本，发布前检查下游影响 |
| ProductClassVersion | DRAFT -> VALIDATED -> PUBLISHED -> RETIRED；PUBLISHED 不可变 |
| ProductInstance | 绑定确定的模型版本，升级通过迁移任务完成 |
| Configuration | 绑定完整快照，确保报价、BOM 和规则结果可复现 |

### 5.4 发布前校验

- 对象、属性、关系类型引用完整，不存在悬空引用。
- PartClass 的基数、单选/多选和多实例语义不冲突。
- Part 的必填规格已赋值，类型、单位和值域合法。
- 规则引用的分类、Part、属性和参数存在于同一快照。
- ProductInstance 裁剪后至少存在一个可行解。
- 扩展值通过对应 Schema 校验，未知命名空间不能进入发布数据。
- 对 MultiPCTest 类似场景执行回归，覆盖可行、不可行、数量边界和多目标优选。

### 5.5 数据权限和审计

| 角色 | 主要权限 |
| --- | --- |
| 平台架构师 | 维护 L0 元模型和扩展机制 |
| 公司级业务专家/FDE | 维护 L1 产品领域类型和共性规则 |
| 产品数据架构师 | 维护 ProductClass、PartClass 和 Spec；配置规则待后续元模型纳入 |
| 产品数据工程师 | 维护 Part、ProductInstance 和裁剪差异 |
| 销售/交付角色 | 在授权命名空间维护销售、渠道或交付扩展 |
| 配置用户 | 创建 Configuration，不修改已发布模型 |

所有发布、裁剪、覆盖、规则变更和扩展 Schema 变更都应写入审计日志，至少包含变更前后值、操作人、时间、原因和审批单。

### 5.6 分阶段实施建议

1. 先实现 L0 的类型注册、实例存储、Schema 校验和版本机制，再注册 L1 产品领域类型。
2. 以服务器 CPU + drive 为首个纵向切片，跑通 ProductClass、S1110 裁剪、配置求解和 BOM 输出。
3. 建立 ProductClassSnapshot 到 cruleengine.Module 的单向编译器，并保存源 ID 与执行 code 的映射。
4. 首期复用 MultiPCTest 已验证的 Part、属性和规则数据；销售、交付和资料先建扩展 Schema，不修改引擎核心类。
5. 建立快照回放测试，将“同一配置输入 + 同一快照 = 同一结果”作为基础验收条件。
