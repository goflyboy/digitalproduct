# Microsoft Fabric IQ 复杂产品配置器语义建模验证操作指南

> **用途**：在 Microsoft Fabric IQ 中，对 [`复杂产品配置器的数据模型.md`](./复杂产品配置器的数据模型.md) 和 [`Palantir范式复杂产品配置器语义建模方案.md`](./Palantir范式复杂产品配置器语义建模方案.md) 做一套可重复的 PoC 验证。
>
> **适用版本**：Microsoft Fabric IQ / Ontology（当前官方文档仍标注为 Preview；界面和能力可能变化）。
>
> **文档版本**：v1.0
>
> **编写日期**：2026-07-28
>
> **验证方式**：OneLake Lakehouse + Ontology（Preview）+ Fabric Graph + Fabric Data Agent；配置约束扩展使用 Fabric Activator / Operations Agent。

---

## 1. 先看结论：这次验证要证明什么

原方案不是一份可以直接导入 Fabric IQ 的 JSON Schema。它是一套 Palantir 风格的**业务语义设计**，需要先转换为 Fabric IQ 能消费的三类资源：

1. **OneLake 中的托管表**：承载对象实例和关系映射数据。
2. **Ontology item**：承载 Entity Type、Property、Entity Type Key、Relationship Type 和数据绑定。
3. **Graph / Agent / Activator**：分别验证多跳关系，自然语言查询和配置约束触发。

本指南的最终验收结果不是"画出一张图"，而是下面 8 个能力都能用样例数据复现：

|| 验收编号 | 原方案能力 | Fabric IQ 验证结果 |
|---|---|---|
| A1 | ObjectType 一等公民 | Ontology 中存在 ProductClass、PartClass、Part、ProductInstance、Configuration 等 Entity Type，并能看到实例 |
| A2 | LinkType 一等公民 | Ontology 中存在方向明确的 Relationship Type，并能在 Graph 中遍历；特别是 `OFFERS_PART` 边属性（enabled/disabled/minQty/maxQty） |
| A3 | 三层业务模型 | L1元模型（ProductClassType/PartClassType/SpecDefinition/Parameter）、L2业务对象（ProductClass/PartClass/Part/ProductInstance）、L3配置运行（Configuration/ConfiguredPart）均有可查询实体 |
| A4 | Backing Datasource | Entity Type 和 Relationship Type 均能追溯到 OneLake Lakehouse 表 |
| A5 | SpecDefinition + SpecValue 规格体系 | 产品/部件的固有规格定义与持有值分离；Part 持有 SpecValue |
| A6 | offersPart 裁剪语义 | 能从 ProductInstance 查询到 Part，并验证 enabled/disabled/minQty/maxQty 裁剪属性 |
| A7 | Agent 消费 | Fabric Data Agent 能用业务术语回答产品配置、价格查询问题，并引用 Ontology 中的实体关系 |
| A8 | Action / Operationalization | Activator 或 Operations Agent 能检测配置约束冲突并发出通知；不把它误认为完整的 Palantir Action Type 注册中心 |

### 1.1 推荐验证顺序

不要一开始就创建全部实体和关系。建议按以下闸门推进：

```text
数据准备 → Ontology 骨架 → 核心实体 → 静态绑定 → 核心关系
    → Graph 单跳/多跳 → 扩展实体 → Agent → Activator → 权限与成本检查
```

- **MVP 闸门**：ProductClass、PartClass、Part、ProductInstance、SpecDefinition、SpecValue 加载成功，Graph 能完成一条完整产品配置链路。
- **完整闸门**：再加入 Parameter、Configuration、ConfiguredPart、ConfiguredValue 和 offersPart/SpecOverride 关系。
- **Agent 闸门**：先验证只读问答，再验证配置约束告警；不要在 PoC 第一轮直接开放写操作。

### 1.2 本指南的关键建模取舍

原方案中的某些概念不能原样当作 Fabric IQ 的原生能力：

|| 原方案概念 | 本指南的 Fabric IQ 落地方式 | 验证边界 |
|---|---|---|
| ObjectType | Entity Type | 直接支持 |
| Object Instance | Entity Instance | 绑定静态表后支持 |
| LinkType | Relationship Type | 方向和两端键通过映射表定义 |
| offersPart 边属性 | 沉淀为 `ProductInstancePartOffer` 桥接实体的属性 | enabled/disabled/minQty/maxQty/fixed 承载在桥接表列 |
| SpecDefinition + SpecValue | `SpecDefinition` Entity + `SpecValue` Entity + `PartHasSpecValue` 关系 | Part 持有 SpecValue |
| Parameter | `Parameter` Entity + `PartClassHasParameter` 关系 | 参数定义在 PartClass 上 |
| SpecOverride | `SpecOverride` Entity + `ProductInstanceOverridesSpec` 关系 | ProductInstance 覆盖基线规格 |
| Configuration | `Configuration` Entity + `selectsPart` / `hasConfiguredValue` 关系 | 配置方案驱动求解 |
| Backing Datasource | OneLake managed Lakehouse 表绑定 | 不是任意外部数据库联邦 |
| Graph | Ontology 自动创建的 managed Graph，以及独立 Graph item | Fabric Graph 当前是 labeled property graph（LPG） |
| Action Type | Activator rule、Operations Agent recommendation、Power Automate 或 Fabric item | 这是动作编排，不等同于完整的 Action Type schema 治理 |

> **务必先读这一节。** 如果把原文中的概念直接复制到 Fabric UI，通常会遇到类型、字段名、查询语言或权限模型不匹配的问题。

---

## 2. 前置条件与环境检查

### 2.1 必备资源与角色

|| 资源 | 是否必须 | 说明 |
|---|---|---|
| Microsoft Fabric 租户 | 是 | 需要 Fabric-enabled capacity（如 F2 或更高）。试用版可在 `https://app.fabric.microsoft.com` 申请 |
| Workspace（不是 *My workspace*） | 是 | 所有 Ontology 资源必须放在普通 Workspace；`My workspace` 不支持生成或绑定 |
| Capacity | 是 | Fabric（Trial/Pay-as-you-go/Reserved）均可，建议 PoC 用 F2/F4 |
| Tenant 设置 | 是 | 由 Fabric 管理员在 Admin Portal 中开启 |
| 数据源 | 是 | OneLake managed Lakehouse 表（managed、不带 OneLake Security、不带 column mapping） |

Tenant 设置必须开启以下几项（在 Admin Portal → Tenant settings）：

1. **Enable Ontology item (preview)** —— 创建 Ontology item 的前置项。
2. **Users can use Copilot and other features powered by Azure OpenAI** —— Data Agent 必需。
3. **Data sent to Azure OpenAI can be processed outside your capacity's geographic region** —— 跨区域使用 Data Agent 时需要。
4. **Data sent to Azure OpenAI can be stored outside your capacity's geographic region** —— 同上。
5. **Operations agent tenant settings**（可选）—— 若要使用 Operations Agent 验证 §6 的配置约束告警。

Workspace 角色要求：

|| 角色 | 工作内容 |
|---|
| Workspace Admin | 第一次引导时一次性配置 |
| Contributor | 创建 Ontology、Lakehouse、Graph、Agent、Activator |
| Viewer | 验证只读结果，做第 7 章的角色测试 |
| Source 数据读权限 | 绑定 Lakehouse 时需要 `ReadAll`；Lakehouse 不能开 OneLake Security，否则不能绑定 |

### 2.2 浏览器与客户端

- Fabric Portal 在 Edge 或 Chrome 下稳定。
- Ontology Graph view、Query builder、Code editor 都在 Web 上。
- Data Agent 调试在 Web 的 Chat pane；Foundry IQ 和 Copilot Studio 集成使用相应 Web 控制台。

### 2.3 容量与计费的几个提示

- Ontology item 本身按 CUD（Create/Update/Delete）操作以 30 分钟粒度计费，单价很低；但其**自动创建的 Graph item 会随绑定数据量计费**。
- Graph refresh 是高耗时操作：单次刷新超过 20 分钟会超时（官方说明）。不要把 Graph 刷新周期设得过短。
- 试用 capacity 在一段时间后会过期或降速；生产 PoC 建议至少升级到 F2。

### 2.4 一次性环境就绪清单

```text
[ ] 1. 拿到 Fabric 租户管理员，开通 §2.1 的 5 个 Tenant 设置
[ ] 2. 在 Fabric Portal 创建一个普通 Workspace（不是 My workspace），绑定到 Fabric capacity
[ ] 3. 在 Workspace 中新建一个 Lakehouse，命名：ConfiguratorOntologyLH
[ ] 4. 在 Lakehouse 中创建一个 schema，命名：ontology
[ ] 5. 准备一个 Notebook，命名：ConfiguratorOntologyBootstrap，用于创建所有 OneLake 表
[ ] 6. 在 Workspace 中创建 Ontology (preview) item，命名：ConfiguratorOntology
[ ] 7. 记录 Ontology item 的 Workspace ID 和 Ontology ID（后面 §6 的 Copilot Studio / Foundry IQ 集成要用）
[ ] 8. 在 Workspace 中创建 Graph item，命名：ConfiguratorGraph（可选；Ontology 自带 managed Graph，独立的 Graph 用于手工建模）
```

---

## 3. 把复杂产品配置器设计转换为 OneLake 表

Fabric IQ 的 Ontology 只能绑定 OneLake 中的表。第一步就是按 Entity Type 与 Relationship Type 的语义，在 Lakehouse 中建立**扁平关系型 schema**。所有映射字段必须遵循 Fabric 限制：列名以字母数字开头并结束，仅含 `A-Z`、`a-z`、`0-9`、`-`、`_`；不出现 `,`、`;`、`{}`、`()`、空格、`=`、换行等触发 column mapping 的字符。

### 3.1 表清单与命名映射

下表把原方案中的核心 ObjectType 映射到 OneLake 表：

|| 表名 | 对应原方案 | OneLake schema | 用途 |
|---|---|---|---|
| `product_class_type` | OT_PRODUCT_CLASS_TYPE | ontology | 产品类类型定义 |
| `part_class_type` | OT_PART_CLASS_TYPE | ontology | 部件类类型定义 |
| `spec_definition` | OT_SPEC_DEFINITION | ontology | 规格定义 |
| `parameter` | OT_PARAMETER | ontology | 参数定义 |
| `product_class` | OT_PRODUCT_CLASS | ontology | 产品类实例（含 version） |
| `part_class` | OT_PART_CLASS | ontology | 部件分类实例 |
| `part` | OT_PART | ontology | 部件实例 |
| `spec_value` | OT_SPEC_VALUE | ontology | 规格值（挂在 ProductClass 或 Part 上） |
| `product_instance` | OT_PRODUCT_INSTANCE | ontology | 可售产品实例 |
| `product_instance_part_offer` | OFFERS_PART 边属性 | ontology | 产品实例裁剪部件（桥接表，含 enabled/disabled/minQty/maxQty/fixed） |
| `spec_override` | OT_SPEC_OVERRIDE | ontology | 规格覆盖 |
| `configuration` | OT_CONFIGURATION | ontology | 配置方案 |
| `configured_part` | OT_CONFIGURED_PART | ontology | 已选部件 |
| `configured_value` | OT_CONFIGURED_VALUE | ontology | 已选参数值 |

> **关键设计**：`offersPart` 的边属性（enabled/disabled/minQty/maxQty/fixed）不直接挂在边上，而是沉淀到 `product_instance_part_offer` 桥接表。这是复杂产品配置器在 Fabric IQ 中的核心适配点。

### 3.2 表结构（DDL）与列约定

下面给出 Lakehouse Spark SQL 表结构。所有主键字段都用 `STRING`，符合 Entity Type Key 当前仅支持 `string` / `integer` 的限制。所有时间戳列用 `TIMESTAMP`。所有金额用 `DECIMAL(18,2)`。删除原方案中容易触发表名/列名限制的字符。

```sql
CREATE SCHEMA IF NOT EXISTS ontology;
USE SCHEMA ontology;

-- 产品类类型
CREATE TABLE IF NOT EXISTS product_class_type (
    type_code          STRING  NOT NULL,
    type_name          STRING  NOT NULL,
    domain             STRING,
    modeling_policy    STRING,
    description        STRING,
    PRIMARY KEY (type_code) DISABLE NOVALIDATE
) USING DELTA;

-- 部件类类型
CREATE TABLE IF NOT EXISTS part_class_type (
    type_code          STRING  NOT NULL,
    type_name          STRING  NOT NULL,
    part_kind          STRING,
    selection_policy   STRING,
    min_cardinality    INT,
    max_cardinality    INT,
    multi_instance     BOOLEAN,
    PRIMARY KEY (type_code) DISABLE NOVALIDATE
) USING DELTA;

-- 规格定义
CREATE TABLE IF NOT EXISTS spec_definition (
    spec_code          STRING  NOT NULL,
    spec_name          STRING  NOT NULL,
    defined_on_type    STRING,  -- PRODUCT_CLASS_TYPE / PART_CLASS_TYPE
    data_type          STRING  NOT NULL,
    unit               STRING,
    value_domain       STRING,  -- JSON array: ["1U","2U","4U"]
    required           BOOLEAN,
    PRIMARY KEY (spec_code) DISABLE NOVALIDATE
) USING DELTA;

-- 参数定义
CREATE TABLE IF NOT EXISTS parameter (
    param_code         STRING  NOT NULL,
    param_name         STRING  NOT NULL,
    defined_on_type    STRING,  -- PART_CLASS_TYPE
    data_type          STRING  NOT NULL,
    unit               STRING,
    assign_type        STRING,  -- INPUT / COMPUTED / SUMMARY
    min_value          DECIMAL,
    max_value          DECIMAL,
    default_value      STRING,
    description        STRING,
    PRIMARY KEY (param_code) DISABLE NOVALIDATE
) USING DELTA;

-- 产品类
CREATE TABLE IF NOT EXISTS product_class (
    id                 STRING  NOT NULL,
    code               STRING  NOT NULL,
    name               STRING  NOT NULL,
    version            STRING  NOT NULL,
    status             STRING,
    effective_from     TIMESTAMP,
    effective_to       TIMESTAMP,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 部件分类
CREATE TABLE IF NOT EXISTS part_class (
    id                 STRING  NOT NULL,
    code               STRING  NOT NULL,
    name               STRING  NOT NULL,
    product_class_id   STRING,
    selection_policy    STRING,
    min_qty             INT,
    max_qty             INT,
    multi_instance      BOOLEAN,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 部件
CREATE TABLE IF NOT EXISTS part (
    id                 STRING  NOT NULL,
    code               STRING  NOT NULL,
    name               STRING  NOT NULL,
    part_class_id      STRING,
    status             STRING,
    price              DECIMAL(18,2),
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 规格值
CREATE TABLE IF NOT EXISTS spec_value (
    id                 STRING  NOT NULL,
    owner_type         STRING,  -- PRODUCT_CLASS / PART
    owner_id           STRING,
    spec_code          STRING,
    value              STRING,
    unit               STRING,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 产品实例
CREATE TABLE IF NOT EXISTS product_instance (
    id                 STRING  NOT NULL,
    code               STRING  NOT NULL,
    name               STRING  NOT NULL,
    version            STRING  NOT NULL,
    realizes_product_class_id STRING,
    market             STRING,
    positioning        STRING,
    status             STRING,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 产品实例裁剪部件（OFFERS_PART 边属性沉淀）
CREATE TABLE IF NOT EXISTS product_instance_part_offer (
    product_instance_id STRING  NOT NULL,
    part_id            STRING  NOT NULL,
    enabled            BOOLEAN,
    disabled           BOOLEAN,
    default_selected    BOOLEAN,
    min_qty            INT,
    max_qty            INT,
    fixed              BOOLEAN,
    PRIMARY KEY (product_instance_id, part_id) DISABLE NOVALIDATE
) USING DELTA;

-- 规格覆盖
CREATE TABLE IF NOT EXISTS spec_override (
    id                 STRING  NOT NULL,
    product_instance_id STRING,
    spec_code          STRING,
    override_value     STRING,
    reason             STRING,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 配置方案
CREATE TABLE IF NOT EXISTS configuration (
    id                 STRING  NOT NULL,
    product_instance_id STRING,
    model_snapshot      STRING,
    status             STRING,
    customer_context   STRING,  -- JSON
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 已选部件
CREATE TABLE IF NOT EXISTS configured_part (
    id                 STRING  NOT NULL,
    configuration_id   STRING,
    part_id            STRING,
    instance_no        INT,
    quantity           INT,
    selected           BOOLEAN,
    reason             STRING,
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;

-- 已选参数值
CREATE TABLE IF NOT EXISTS configured_value (
    id                 STRING  NOT NULL,
    configuration_id   STRING,
    parameter_code     STRING,
    part_class         STRING,
    value              STRING,
    filter             STRING,
    source             STRING,  -- USER_INPUT / DEFAULT / COMPUTED
    PRIMARY KEY (id) DISABLE NOVALIDATE
) USING DELTA;
```

### 3.3 样例数据：用一份能复现的最小数据集

下面给出一份完整的样例数据（对应原方案 §2 的服务器配置案例）。把下面这段 Spark SQL 在 Notebook 中跑一遍，即可作为整套验证的基线。

```sql
-- 产品类类型
INSERT INTO product_class_type VALUES
('SERVER_X86', 'X86服务器平台', 'IT硬件', 'PLATFORM_STANDARDIZATION', '面向研发和后端复用的通用服务器平台');

-- 部件类类型
INSERT INTO part_class_type VALUES
('cpu',      'CPU',       'COMPONENT', 'REQUIRED', 1, 2, false),
('drive',     '硬盘',      'STORAGE',   'OPTIONAL', 0, 8, true),
('memory',   '内存',      'COMPONENT', 'REQUIRED', 1, 16, true),
('software', '配套软件',   'SERVICE',   'OPTIONAL', 0, 10, false);

-- 规格定义
INSERT INTO spec_definition VALUES
('FormFactor',  '外形规格', 'PRODUCT_CLASS_TYPE', 'STRING', 'U', '["1U","2U","4U"]', true),
('PowerSupply', '电源类型', 'PRODUCT_CLASS_TYPE', 'STRING', '-', '["SINGLE","DUAL"]', true),
('CoreNum',     '核心数',   'PART_CLASS_TYPE',   'INTEGER', 'core', '[2,4,8,18]', true),
('Memory',      '内存容量',  'PART_CLASS_TYPE',   'INTEGER', 'GB', '[123,256,512,1024]', true),
('ConfigType',  '配置类型',  'PART_CLASS_TYPE',   'INTEGER', '配置', '[2,5]', true),
('Speed',       '转速',     'PART_CLASS_TYPE',   'STRING', 'rpm', '[3000,5400,7200,9000]', true),
('Capacity',    '容量',     'PART_CLASS_TYPE',   'INTEGER', 'TB', '[1,2,3,6,9]', true),
('Type',        '类型',     'PART_CLASS_TYPE',   'STRING', '-', '["sd","md"]', true);

-- 参数定义
INSERT INTO parameter VALUES
('Sum_Capacity', '硬盘总容量需求', 'PART_CLASS_TYPE', 'INTEGER', 'TB', 'INPUT', NULL, NULL, NULL, '客户要求的硬盘总容量下限'),
('Sum_Memory',   'CPU总内存需求', 'PART_CLASS_TYPE', 'INTEGER', 'GB', 'INPUT', NULL, NULL, NULL, '客户要求的某型号CPU总内存下限'),
('Quantity',     '硬盘数量需求',   'PART_CLASS_TYPE', 'INTEGER', '块', 'INPUT', NULL, NULL, NULL, '客户要求的硬盘总数量');

-- 产品类
INSERT INTO product_class VALUES
('PC-001', 'SERVER_X86', 'X86服务器平台', '1.0.0', 'PUBLISHED', TIMESTAMP '2026-07-01', NULL);

-- 部件分类
INSERT INTO part_class VALUES
('PCL-cpu',     'cpu',     'CPU',      'PC-001', 'REQUIRED', 1, 2, false),
('PCL-drive',   'drive',   '硬盘',     'PC-001', 'OPTIONAL', 0, 8, true),
('PCL-memory',  'memory',  '内存',     'PC-001', 'REQUIRED', 1, 16, true),
('PCL-software','software','配套软件', 'PC-001', 'OPTIONAL', 0, 10, false);

-- 部件
INSERT INTO part VALUES
('P-cpu1', 'cpu1', 'CPU 2核 123GB',  'PCL-cpu',    'ACTIVE', 100),
('P-cpu2', 'cpu2', 'CPU 4核 256GB',  'PCL-cpu',    'ACTIVE', 200),
('P-cpu3', 'cpu3', 'CPU 8核 512GB',  'PCL-cpu',    'ACTIVE', 400),
('P-cpu4', 'cpu4', 'CPU 18核 1024GB', 'PCL-cpu',   'ACTIVE', 800),
('P-sd1',  'sd1',  '固态硬盘 5400rpm 3TB', 'PCL-drive', 'ACTIVE', 50),
('P-sd2',  'sd2',  '固态硬盘 7200rpm 6TB', 'PCL-drive', 'ACTIVE', 80),
('P-sd3',  'sd3',  '固态硬盘 9000rpm 9TB', 'PCL-drive', 'ACTIVE', 90),
('P-md1',  'md1',  '机械硬盘 5400rpm 1TB', 'PCL-drive', 'ACTIVE', 30),
('P-md2',  'md2',  '机械硬盘 7200rpm 2TB', 'PCL-drive', 'ACTIVE', 40),
('P-md3',  'md3',  '机械硬盘 9000rpm 3TB', 'PCL-drive', 'ACTIVE', 60);

-- 规格值（Part 持有）
INSERT INTO spec_value VALUES
('SV-cpu1-CoreNum',    'PART', 'P-cpu1', 'CoreNum',    '2',    'core'),
('SV-cpu1-Memory',     'PART', 'P-cpu1', 'Memory',     '123',   'GB'),
('SV-cpu1-ConfigType', 'PART', 'P-cpu1', 'ConfigType', '2',    '配置'),
('SV-cpu2-CoreNum',    'PART', 'P-cpu2', 'CoreNum',    '4',    'core'),
('SV-cpu2-Memory',     'PART', 'P-cpu2', 'Memory',     '256',   'GB'),
('SV-cpu2-ConfigType', 'PART', 'P-cpu2', 'ConfigType', '2',    '配置'),
('SV-cpu3-CoreNum',    'PART', 'P-cpu3', 'CoreNum',    '8',    'core'),
('SV-cpu3-Memory',     'PART', 'P-cpu3', 'Memory',     '512',   'GB'),
('SV-cpu3-ConfigType', 'PART', 'P-cpu3', 'ConfigType', '5',   '配置'),
('SV-cpu4-CoreNum',    'PART', 'P-cpu4', 'CoreNum',    '18',   'core'),
('SV-cpu4-Memory',     'PART', 'P-cpu4', 'Memory',     '1024',  'GB'),
('SV-cpu4-ConfigType', 'PART', 'P-cpu4', 'ConfigType', '5',   '配置'),
('SV-sd1-Speed',       'PART', 'P-sd1',  'Speed',      '5400', 'rpm'),
('SV-sd1-Capacity',    'PART', 'P-sd1',  'Capacity',   '3',    'TB'),
('SV-sd1-Type',        'PART', 'P-sd1',  'Type',       'sd',   '-'),
('SV-sd2-Speed',       'PART', 'P-sd2',  'Speed',      '7200', 'rpm'),
('SV-sd2-Capacity',    'PART', 'P-sd2',  'Capacity',   '6',    'TB'),
('SV-sd2-Type',        'PART', 'P-sd2',  'Type',       'sd',   '-'),
('SV-md1-Speed',       'PART', 'P-md1',  'Speed',      '5400', 'rpm'),
('SV-md1-Capacity',     'PART', 'P-md1',  'Capacity',   '1',    'TB'),
('SV-md1-Type',        'PART', 'P-md1',  'Type',       'md',   '-');

-- 规格值（ProductClass 持有）
INSERT INTO spec_value VALUES
('SV-PC-FormFactor',   'PRODUCT_CLASS', 'PC-001', 'FormFactor',  '2U',  'U'),
('SV-PC-PowerSupply',  'PRODUCT_CLASS', 'PC-001', 'PowerSupply', 'DUAL', '-');

-- 产品实例
INSERT INTO product_instance VALUES
('PI-S1110', 'S1110', 'X86服务器S1110低端型', '1.0.0', 'PC-001', 'CN', '低端通用场景', 'PUBLISHED'),
('PI-S22',   'S22',   'X86服务器S22高端型', '1.0.0', 'PC-001', 'CN/Global', '高端计算存储', 'PUBLISHED');

-- OFFERS_PART 裁剪（S1110）
INSERT INTO product_instance_part_offer VALUES
('PI-S1110', 'P-cpu1', true,  false, true,  1, 1, false),  -- 默认选中
('PI-S1110', 'P-cpu2', true,  false, false, 0, 2, false),
('PI-S1110', 'P-cpu3', false, true,  false, 0, 0, false),  -- 禁用
('PI-S1110', 'P-cpu4', false, true,  false, 0, 0, false),  -- 禁用
('PI-S1110', 'P-sd1',  true,  false, false, 0, 2, false),
('PI-S1110', 'P-sd2',  false, true,  false, 0, 0, false),  -- 禁用
('PI-S1110', 'P-sd3',  false, true,  false, 0, 0, false),  -- 禁用
('PI-S1110', 'P-md1',  true,  false, true,  1, 8, false),  -- 默认选中
('PI-S1110', 'P-md2',  true,  false, false, 0, 8, false),
('PI-S1110', 'P-md3',  false, true,  false, 0, 0, false);  -- 禁用

-- OFFERS_PART 裁剪（S22）
INSERT INTO product_instance_part_offer VALUES
('PI-S22',   'P-cpu1', false, true,  false, 0, 0, false),  -- 禁用
('PI-S22',   'P-cpu2', true,  false, false, 0, 2, false),
('PI-S22',   'P-cpu3', true,  false, true,  1, 1, false),  -- 默认选中
('PI-S22',   'P-cpu4', true,  false, false, 0, 2, false),
('PI-S22',   'P-sd1',  false, true,  false, 0, 0, false),  -- 禁用
('PI-S22',   'P-sd2',  true,  false, false, 0, 2, false),
('PI-S22',   'P-sd3',  true,  false, false, 0, 2, false),
('PI-S22',   'P-md1',  false, true,  false, 0, 0, false),  -- 禁用
('PI-S22',   'P-md2',  true,  false, false, 0, 8, false),
('PI-S22',   'P-md3',  true,  false, false, 0, 8, false);

-- 规格覆盖（S22 强制 FormFactor=4U）
INSERT INTO spec_override VALUES
('SO-S22-FormFactor', 'PI-S22', 'FormFactor', '4U', '高端型号强制4U外形');

-- 配置方案
INSERT INTO configuration VALUES
('CFG-001', 'PI-S1110', 'SERVER_X86:1.0.0 / S1110:1.0.0', 'COMPLETED', '{"customer_id":"CUST-001"}');

-- 已选部件
INSERT INTO configured_part VALUES
('CP-001', 'CFG-001', 'P-cpu2', 1, 2, true, '满足4核CPU内存>=512G需求'),
('CP-002', 'CFG-001', 'P-md1',  1, 5, true, '5400rpm机械硬盘，满足5T容量需求');

-- 已选参数值
INSERT INTO configured_value VALUES
('CV-001', 'CFG-001', 'Sum_Capacity', 'drive', '5', 'Speed=5400', 'USER_INPUT'),
('CV-002', 'CFG-001', 'Sum_Memory',   'cpu',   '512', 'CoreNum=4', 'USER_INPUT');
```

> **注意**：`PRIMARY KEY (xxx) DISABLE NOVALIDATE` 在 Lakehouse Delta 中不强制唯一性，仅用于在 Lakehouse 中表达意图；Fabric IQ 端的实体键校验在绑定阶段由 UI 完成。

### 3.4 一致性与质量检查（建议在创建 Ontology 之前执行）

在创建 Ontology 前，对源数据做一次全表校验：

```sql
-- Part 必须指向一个存在的 PartClass
SELECT p.part_id
FROM ontology.part p
LEFT JOIN ontology.part_class pc ON p.part_class_id = pc.id
WHERE pc.id IS NULL;

-- ProductInstance 必须指向一个存在的 ProductClass
SELECT pi.id
FROM ontology.product_instance pi
LEFT JOIN ontology.product_class pc ON pi.realizes_product_class_id = pc.id
WHERE pc.id IS NULL;

-- OFFERS_PART 的 Part 必须存在
SELECT pip.product_instance_id, pip.part_id
FROM ontology.product_instance_part_offer pip
LEFT JOIN ontology.part p ON pip.part_id = p.id
WHERE p.id IS NULL;

-- SpecValue 的 owner_id 必须存在
SELECT sv.id
FROM ontology.spec_value sv
WHERE sv.owner_type = 'PART' 
  AND sv.owner_id NOT IN (SELECT id FROM ontology.part)
   OR sv.owner_type = 'PRODUCT_CLASS'
  AND sv.owner_id NOT IN (SELECT id FROM ontology.product_class);
```

如果任何一条返回非空集，回到表里修复后再继续。

---

## 4. 创建 Ontology（Entity Type + Property）

Entity Type 的创建流程是统一的：在 Home configuration canvas → Add entity type → 输入名字 → 进入 Configure 页 → Add properties → Bind data。所有 Entity Type 必须有至少一个属性后才能在 Graph 中出现实例（Entity Type Key 是用 string 或 integer 属性做的）。

### 4.1 命名规则（Fabric IQ 强制）

- Entity Type 名：`1–26` 字符，只能含字母数字、下划线、连字符；首尾必须是字母数字。
- 自定义 Property 名：同样 `1–26` 字符；**Property 名在整个 Ontology 内必须唯一**（即便跨不同 Entity Type）。
- Entity Type Key：必须是 string 或 integer 属性。
- 推荐使用业务可读名 `ProductClass` / `PartClass` / `Part` 等，让 Data Agent 回答时更自然。

### 4.2 一次性创建核心 Entity Type

按以下顺序操作，每一步都在 Ontology item 中点 Add entity type → 输入名字 → Add Entity Type → 进入 Configure 页。

|| # | Entity Type 名 | Entity Type Key | 主要 Property | 绑定 OneLake 表 |
|---|---|---|---|---|
| 1 | `ProductClassType` | `typeCode` (string) | `typeCode`, `typeName`, `domain`, `modelingPolicy` | `ontology.product_class_type` |
| 2 | `PartClassType` | `typeCode` (string) | `typeCode`, `typeName`, `partKind`, `selectionPolicy`, `minCardinality`, `maxCardinality` | `ontology.part_class_type` |
| 3 | `SpecDefinition` | `specCode` (string) | `specCode`, `specName`, `definedOnType`, `dataType`, `unit`, `valueDomain` | `ontology.spec_definition` |
| 4 | `Parameter` | `paramCode` (string) | `paramCode`, `paramName`, `definedOnType`, `dataType`, `unit`, `assignType` | `ontology.parameter` |
| 5 | `ProductClass` | `id` (string) | `id`, `code`, `name`, `version`, `status` | `ontology.product_class` |
| 6 | `PartClass` | `id` (string) | `id`, `code`, `name`, `productClassId`, `selectionPolicy`, `minQty`, `maxQty` | `ontology.part_class` |
| 7 | `Part` | `id` (string) | `id`, `code`, `name`, `partClassId`, `status`, `price` | `ontology.part` |
| 8 | `SpecValue` | `id` (string) | `id`, `ownerType`, `ownerId`, `specCode`, `value`, `unit` | `ontology.spec_value` |
| 9 | `ProductInstance` | `id` (string) | `id`, `code`, `name`, `version`, `realizesProductClassId`, `market`, `positioning`, `status` | `ontology.product_instance` |
| 10 | `ProductInstancePartOffer` | `productInstanceId` (string) | `productInstanceId`, `partId`, `enabled`, `disabled`, `defaultSelected`, `minQty`, `maxQty`, `fixed` | `ontology.product_instance_part_offer` |
| 11 | `SpecOverride` | `id` (string) | `id`, `productInstanceId`, `specCode`, `overrideValue`, `reason` | `ontology.spec_override` |
| 12 | `Configuration` | `id` (string) | `id`, `productInstanceId`, `modelSnapshot`, `status` | `ontology.configuration` |
| 13 | `ConfiguredPart` | `id` (string) | `id`, `configurationId`, `partId`, `instanceNo`, `quantity`, `selected`, `reason` | `ontology.configured_part` |
| 14 | `ConfiguredValue` | `id` (string) | `id`, `configurationId`, `parameterCode`, `partClass`, `value`, `filter`, `source` | `ontology.configured_value` |

完整步骤示例（以 `ProductClass` 为例）：

1. 在 Home configuration canvas 顶部点 **Add entity type** → 输入 `ProductClass` → **Add Entity Type**。
2. 选中新卡片 → 顶部 **View entity type details** → 进入 Configure 页。
3. **Manage property bindings → Add properties**，依次按上表新增属性，把类型选成 `string` / `integer` / `decimal` / `boolean` / `datetime`。
4. **Define entity type key**：`id`，属性类型必须为 string。
5. **Add data binding → Lakehouse table** → 选 `ConfiguratorOntologyLH` → `ontology.product_class` → 在 Entity type key mapping 里把 `id` 指向 `id` 列；在 Properties 区域确认每列都映射好 → **Save**。
6. 完成后在 Configure 页把 `code` 标为 **display name property**。

> **陷阱**：如果 Lakehouse 表里有 OneLake Security 或 column mapping（特殊字符列名），binding 列表里就看不到该 Lakehouse。

把以上 14 行重复 14 遍。MVP 阶段（§1.1）可以只做 5-9（核心业务对象），完整闸门再补齐。

---

## 5. 创建 Relationship Type（对应 LinkType）

Fabric IQ 的 Relationship Type 与 Entity Type 平级，必须单独创建并显式绑定映射表（mapping table）。

### 5.1 关系清单与映射

|| # | Relationship 名 | Origin | Target | Mapping Table | Matched Origin | Matched Target |
|---|---|---|---|---|---|
| 1 | `ProductClassContainsPartClass` | `ProductClass` | `PartClass` | `ontology.part_class` | `product_class_id` | `id` |
| 2 | `PartClassHasSpecDefinition` | `PartClass` | `SpecDefinition` | `ontology.spec_definition` | `defined_on_type` → `type_code` | `spec_code` |
| 3 | `PartClassDefinesParameter` | `PartClass` | `Parameter` | `ontology.parameter` | `defined_on_type` → `type_code` | `param_code` |
| 4 | `PartClassHasPart` | `PartClass` | `Part` | `ontology.part` | `part_class_id` | `id` |
| 5 | `PartHasSpecValue` | `Part` | `SpecValue` | `ontology.spec_value` | `owner_id` | `id` |
| 6 | `ProductClassHasSpecValue` | `ProductClass` | `SpecValue` | `ontology.spec_value` | `owner_id` | `id` |
| 7 | `ProductInstanceRealizesProductClass` | `ProductInstance` | `ProductClass` | `ontology.product_instance` | `realizes_product_class_id` | `id` |
| 8 | `ProductInstanceOffersPart` | `ProductInstance` | `ProductInstancePartOffer` | `ontology.product_instance_part_offer` | `product_instance_id` | `product_instance_id` |
| 9 | `PartOfferedByProductInstance` | `Part` | `ProductInstancePartOffer` | `ontology.product_instance_part_offer` | `part_id` | `part_id` |
| 10 | `ProductInstanceOverridesSpec` | `ProductInstance` | `SpecOverride` | `ontology.spec_override` | `product_instance_id` | `id` |
| 11 | `ConfigurationSelectsPart` | `Configuration` | `ConfiguredPart` | `ontology.configured_part` | `configuration_id` | `id` |
| 12 | `ConfiguredPartReferencesPart` | `ConfiguredPart` | `Part` | `ontology.configured_part` | `part_id` | `id` |
| 13 | `ConfigurationHasConfiguredValue` | `Configuration` | `ConfiguredValue` | `ontology.configured_value` | `configuration_id` | `id` |

> **关键设计**：`OFFERS_PART` 边属性（enabled/disabled/minQty/maxQty/fixed）通过 `ProductInstancePartOffer` 桥接实体承载。Relationship #8 和 #9 分别从 ProductInstance 和 Part 两侧指向这个桥接实体。

### 5.2 一次性创建所有 Relationship Type

在 Ontology item 的 Home configuration canvas 中，对每一条 Relationship：

1. **Add relationship**（顶部 ribbon / Explorer / 卡片）→ 弹窗填写：
   - Relationship type name：上表 #1 的英文驼峰名
   - Origin entity type：上表 #3
   - Target entity type：上表 #4
   - Create
2. 在画布上点这条关系 → 打开 Configure 页：
   - **Browse available sources** → 选 Mapping table
   - Matched <Origin entity type>: <Origin key column>
   - Matched <Target entity type>: <Target key column>
3. **Save**。

### 5.3 常见错误的处理

|| 报错 | 排查 |
|---|
| Save 后红字：No matching key column | 检查 mapping table 是否有 origin 或 target 的 Entity Type Key 列 |
| Save 后红字：origin/target entity type not bound | 一定是 origin 或 target 实体还没绑表，回 §4 绑定 |
| Edge 类型看不到实例 | Mapping table 中存在空值，导致实例被过滤；先回 §3.4 的检查 |
| Relationship 实例数量多于预期 | 多对多自连接会出现重复 row，可以用 `MATCH DISTINCT` 或用 `DISTINCT origin/target` 处理 |

### 5.4 刷新 Ontology Graph

刷新方式：

1. 进入 Ontology item → 任一 Entity Type → Configure → Overview 标签 → 任意一张 tile → 顶部点 **Expand** 打开 Graph view → 直接做查询。
2. 等价方式：在 Workspace 中找到自动生成的 Graph item（命名形如 `ConfiguratorOntology` 的 Graph child item）→ **... → Schedule → Refresh now**。

```text
[ ] 在 Ontology Item → Configure → Overview → Graph tile → Expand，确认出现节点
[ ] 在自动生成的 Graph item 中 Schedule → Refresh now，记录刷新耗时
[ ] 检查错误：若刷新 > 20 分钟且失败，按官方建议缩减节点类型或调整映射
```

---

## 6. 在 Fabric Graph 中验证多跳关系

Fabric Graph 当前是 labeled property graph（LPG），使用 GQL（ISO/IEC 39075）。

> **GQL vs Cypher 关键差异**：GQL 用 `FILTER` 替代 `WHERE`；节点标签是 `n:Label` 而非 `(n:Label)`；变量要显式 `LET`；`OPTIONAL MATCH` 是关键字；边属性用 `[e:EdgeType WHERE e.foo = 1]` 内联表达。

### 6.1 进入 Graph 视图

1. Ontology item → Configure → 任一 Entity Type details → Overview → 找到 **Fabric graph** tile → **Expand**。
2. 顶部 ribbon 切到 **Query** 模式 → 选 **Code editor**。

### 6.2 关键验证查询（GQL）

#### Q1：ProductInstance 的 offersPart 裁剪

验证 S1110 启用了哪些 Part，禁用了哪些：

```gql
MATCH (pi:ProductInstance WHERE pi.code = 'S1110')
MATCH (pi)-[:ProductInstanceOffersPart]->(offer:ProductInstancePartOffer)
MATCH (offer)-[:PartOfferedByProductInstance]->(p:Part)
WHERE offer.enabled = true
RETURN p.code AS part_code, 
       offer.default_selected AS default_selected,
       offer.min_qty AS min_qty,
       offer.max_qty AS max_qty
ORDER BY p.code
```

预期返回：cpu1(默认选中), cpu2(可选), sd1(可选), md1(默认选中), md2(可选)

#### Q2：Part 的规格值查询

验证 cpu2 的规格值：

```gql
MATCH (p:Part WHERE p.code = 'cpu2')
MATCH (p)-[:PartHasSpecValue]->(sv:SpecValue)
RETURN sv.spec_code AS spec,
       sv.value AS value,
       sv.unit AS unit
```

预期返回：CoreNum=4, Memory=256, ConfigType=2

#### Q3：ProductInstance 的 SpecOverride

验证 S22 覆盖了哪些规格：

```gql
MATCH (pi:ProductInstance WHERE pi.code = 'S22')
MATCH (pi)-[:ProductInstanceOverridesSpec]->(so:SpecOverride)
RETURN so.spec_code AS spec,
       so.override_value AS override_value,
       so.reason AS reason
```

预期返回：FormFactor=4U（高端型号强制4U外形）

#### Q4：从 ProductInstance 到 Part 的完整链路

验证 S1110 配置链路：

```gql
MATCH (pi:ProductInstance WHERE pi.code = 'S1110')
MATCH (pi)-[:ProductInstanceRealizesProductClass]->(pc:ProductClass)
MATCH (pc)-[:ProductClassContainsPartClass]->(pcl:PartClass)
MATCH (pcl)-[:PartClassHasPart]->(p:Part)
MATCH (offer:ProductInstancePartOffer WHERE offer.product_instance_id = pi.id AND offer.part_id = p.id)
WHERE offer.enabled = true
RETURN pi.code AS product_instance,
       pc.code AS product_class,
       pcl.code AS part_class,
       collect(p.code) AS enabled_parts
```

#### Q5：Configuration 配置求解结果

验证配置方案 CFG-001 的求解结果：

```gql
MATCH (cfg:Configuration WHERE cfg.id = 'CFG-001')
MATCH (cfg)-[:ConfigurationSelectsPart]->(cp:ConfiguredPart)
MATCH (cp)-[:ConfiguredPartReferencesPart]->(p:Part)
WHERE cp.selected = true
RETURN p.code AS part_code,
       cp.quantity AS quantity,
       cp.reason AS reason
```

预期返回：cpu2 x2, md1 x5

#### Q6：基于 Parameter 的 Part 筛选

验证 Sum_Capacity >= 5 的 Part（5400rpm 硬盘）：

```gql
MATCH (p:Part WHERE p.code IN ['sd1', 'md1', 'md2'])
MATCH (p)-[:PartHasSpecValue]->(svSpeed:SpecValue WHERE svSpeed.spec_code = 'Speed')
MATCH (p)-[:PartHasSpecValue]->(svCap:SpecValue WHERE svCap.spec_code = 'Capacity')
FILTER svSpeed.value = '5400'
RETURN p.code AS part_code,
       svCap.value AS capacity,
       p.price AS price
ORDER BY CAST(svCap.value AS INTEGER) DESC
```

预期返回：sd1(3TB), md1(1TB)

### 6.3 验收清单（Graph）

```text
[ ] Q1 返回 S1110 启用的 Part：cpu1, cpu2, sd1, md1, md2
[ ] Q2 返回 cpu2 的规格值：CoreNum=4, Memory=256, ConfigType=2
[ ] Q3 返回 S22 的 SpecOverride：FormFactor=4U
[ ] Q4 返回完整链路：S1110 → SERVER_X86 → PartClass → Part
[ ] Q5 返回配置结果：cpu2 x2, md1 x5
[ ] Q6 返回筛选结果：sd1, md1
```

---

## 7. 用 Fabric Data Agent 验证自然语言消费

Fabric IQ 的 Ontology 可以作为 Data Agent 的数据源，让用户用业务术语提问、Agent 自动用 Ontology 实体回答。

### 7.1 创建 Data Agent 并绑定 Ontology

1. Workspace 中点 **+ New item** → 选 **Data agent (preview)** → 命名 `ConfiguratorOntologyAgent` → Create。
2. 在 Data agent 中点 **Add a data source** → 搜索 `ConfiguratorOntology` → Add。
3. 在左侧 Explorer 中能看到所有 Entity Type 自动出现。
4. **Agent instructions** → 在输入框末尾添加：`Support group by in GQL`。
5. 选保存。

### 7.2 验收对话样本（复制即可发送）

|| # | 用户问题 | 期望 Agent 行为 |
|---|---|---|
| N1 | `列出 S1110 服务器可以选哪些 CPU` | 引用 `ProductInstance` 与 `Part`，输出至少 cpu1, cpu2 |
| N2 | `S1110 禁用了哪些硬盘型号` | 引用 `ProductInstancePartOffer`，输出 disabled=true 的 Part |
| N3 | `cpu2 的规格是什么？列出核心数和内存容量` | 引用 `Part` 与 `SpecValue`，输出 CoreNum=4, Memory=256 |
| N4 | `S22 和 S1110 有什么配置差异？` | 引用 `SpecOverride`，输出 FormFactor 的差异（S22=4U, S1110=2U） |
| N5 | `满足 5400rpm 转速的硬盘有哪些？` | 引用 `Part` 与 `SpecValue`，筛选 Speed=5400 |
| N6 | `最近一次配置方案选择了哪些部件？` | 引用 `Configuration` 与 `ConfiguredPart`，输出 cpu2 x2, md1 x5 |
| N7 | `解释一下 SpecDefinition 和 Parameter 的区别` | 引用 `SpecDefinition` 与 `Parameter` Entity Type 描述，输出业务语义区分 |

### 7.3 调试 Agent 的常用动作

- 如果回答中带有错误的实体名，回到 Ontology 中确认 Entity Type 名是否符合 §4.1 的命名规则。
- 如果回答中数据有缺失，到 Graph item 中手动 Schedule → Refresh now，让 Graph 子项同步上游数据。
- 如果 Agent 提示 "no data"，等待 5–10 分钟初始化后重试。
- 如果多轮上下文导致混淆，把 Agent instructions 中加入一句：`Only use entities defined in ConfiguratorOntology; do not infer new entities.`

### 7.4 集成到 Foundry IQ / Copilot Studio（可选）

参考电商方案 §7.4 / §7.5，步骤类似，只是数据源换成 `ConfiguratorOntology`。

---

## 8. Operationalization：配置约束告警与 Action

原方案中的"Action Type"（配置约束触发、规格覆盖生效）在 Fabric IQ 当前 Preview 中没有一等公民。PoC 用 **Fabric Activator** 和 **Fabric Operations Agent** 来近似。

### 8.1 用 Activator 给 `configuredPart.quantity > maxQty` 配规则

1. Ontology item → 顶部 ribbon → **Add and view rules → View rules**。
2. 在 Rules 面板里点 **New rule** → 选 entity type `ConfiguredPart` → Activator 设计器打开。
3. 配置触发条件：`configuredPart.quantity > configuredPart.maxQty`（假设有这个属性）或用 `ConfiguredPart.quantity > ProductInstancePartOffer.maxQty` 的跨实体条件。
4. 选择动作：
   - 发送 Teams 通知（推荐 PoC 默认）
   - 触发 Fabric item：启动 Pipeline、Notebook
5. 保存 → Rules 自动生成一个同名 Fabric Activator item。

### 8.2 用 Operations Agent 把业务目标固化为 Playbook

1. Workspace 中新建 **Operations agent (preview)** item → 命名 `ConfiguratorOpsAgent`。
2. 填写：
   - Business goals：`Detect invalid part configurations and alert sales team.`
   - Instructions：`When configured part quantity exceeds the maxQty threshold from ProductInstancePartOffer, recommend AlertSales with parameters partId, quantity, maxQty.`
   - Knowledge source：`ConfiguratorOntology`
3. 保存 → **Generate playbook** → 复核 playbook 中提到的 entity type 是否为 `ConfiguredPart`、`Part`。

### 8.3 验证 A8 动作能力

|| 检查 | 期望 |
|---|
| Activator 规则触发后 Teams 收到消息 | 是 |
| Operations Agent playbook 中能列出 `ConfiguredPart` / `Part` / `ProductInstancePartOffer` 三种实体 | 是 |
| 推荐动作中包含明确的 Action 名和参数 | 是 |

---

## 9. 角色视图与权限验证

原方案中角色的数据视图在 Fabric IQ 当前 Preview 中没有完整 ABAC。本节给出 PoC 阶段可行的近似做法。

### 9.1 用 Workspace 角色做粗粒度视图

|| 角色 | Workspace 角色 | 能看什么 | 不能做什么 |
|---|---|---|
| 平台架构师 | Workspace Admin | 所有 Ontology、Lakehouse、Graph、Agent、Activator | — |
| 产品数据架构师 | Workspace Contributor | 所有 Ontology + Graph，能修改本域数据 | 不能修改 Workspace 设置 |
| 产品数据工程师 | Workspace Contributor | ProductInstance、ProductInstancePartOffer；用 OneLake 数据权限缩窄源表可见性 | 不能修改 ProductClassType |
| 销售/客户 | Workspace Viewer | Configuration、ConfiguredPart、ConfiguredValue；用 Lakehouse Row-Level Security 缩窄可见集 | 不能写入 |
| Agent | 通过专用 service principal | 只读 Graph | 写权限单独审批 |

### 9.2 给销售实施 Lakehouse RLS

为 `configuration`、`configured_part`、`configured_value` 创建视图并加 RLS 函数：

```sql
CREATE OR REPLACE VIEW ontology.v_configuration AS
SELECT * FROM ontology.configuration
WHERE customer_context LIKE '%' || currentUser() || '%';

ALTER VIEW ontology.v_configuration
SET ROW FILTER ontology.fn_current_user_filter ON;
```

---

## 10. 端到端验收清单

把下面 8 项当作正式 PoC 的"放行条件"。每完成一项在对应行打钩，并把验证截图 / 输出留到 `docs/verifications/`。

|| 编号 | 验收点 | 通过标准 | 负责人 |
|---|---|---|
| A1 | Ontology 中存在 14 个 Entity Type | 14 个 Entity Type 全部显示在 Home configuration canvas | |
| A1 | Entity Type 都能在 Instances 标签下看到实例 | 实例数量 = 源表行数 | |
| A2 | 13 个 Relationship Type 全部创建成功 | 配置 canvas 全部出现，无红字警告 | |
| A2 | Graph tile 中看到节点和边 | 至少 5 个节点类型可见 | |
| A3 | 三层业务模型显式可见 | L1（ProductClassType/PartClassType）、L2（ProductClass/Part）、L3（Configuration）均有 | |
| A4 | 每张源表都被绑定到至少一个 Entity / Relationship | binding 列表中无 unbound warning | |
| A5 | SpecDefinition + SpecValue 规格体系可查询 | Q2 返回 Part 的规格值 | |
| A6 | offersPart 裁剪语义可查询 | Q1 返回 ProductInstance 启用的 Part | |
| A7 | Data Agent 答对 N1–N7 中至少 6 题 | 引用 Ontology 实体名 | |
| A8 | Activator 规则触发 Teams 通知 | 收到包含 part_id / qty 的告警 | |

### 10.1 失败兜底

|| 现象 | 兜底动作 |
|---|
| Entity Type Key mapping 红字 | 检查 mapping table 是否同时含有 origin 和 target 主键 |
| Graph 刷新超时（>20 分钟） | 缩减 mapping table 的列数；删掉示例数据；分批绑定 |
| Agent 答非所问 | 把系统提示语加入 "Only use ConfiguratorOntology entities" |
| Activator 收不到通知 | 确认 Teams channel 或 Webhook URL 仍有效 |

### 10.2 与原方案的 8 条能力诉求对账

|| 原方案能力诉求 | 落地路径 | 验收编号 |
|---|---|---|
| A1 ObjectType 一等公民 | Ontology Entity Type | A1 |
| A2 LinkType 一等公民 + 边属性 | Relationship Type + ProductInstancePartOffer 沉淀 linkProperties | A2 |
| A3 三层业务模型 | ProductClassType → ProductClass → Part → ProductInstance → Configuration | A3 |
| A4 Backing Datasource | OneLake Lakehouse 表绑定 | A4 |
| A5 SpecDefinition + SpecValue | SpecDefinition Entity + SpecValue Entity + PartHasSpecValue 关系 | A5 |
| A6 offersPart 裁剪语义 | ProductInstancePartOffer 桥接实体 + enabled/disabled/minQty/maxQty | A6 |
| A7 Agent / GraphRAG | Fabric Data Agent | A7 |
| A8 Action / Operationalization | Activator + Operations Agent | A8 |

---

## 附录 A. 一图看懂 PoC 资源依赖

```text
                  ┌──────────────────────────────────────┐
                  │  Workspace (Fabric capacity)         │
                  │  ──────────────────────────────────  │
                  │   Lakehouse   ConfiguratorOntologyLH   │
                  │   Notebook    ConfiguratorOntology…    │
                  │   Ontology    ConfiguratorOntology      │
                  │      └── managed Graph item (auto)   │
                  │   Graph item  ConfiguratorGraph         │
                  │   Data agent ConfiguratorOntologyAgent  │
                  │   Ops agent   ConfiguratorOpsAgent      │
                  │   Activator   ConfiguratorLowStock      │
                  └──────────────────────────────────────┘
```

## 附录 B. 原方案 LinkType → Fabric IQ Relationship Type 的对照清单

|| 原方案 LinkType | Fabric IQ 落地 | 关系属性如何承载 |
|---|---|---|
| COMPOSED_OF | `ProductClassContainsPartClass` | 直接关系；selection_policy 在 PartClass 上 |
| HAS_SPEC | `PartClassHasSpecDefinition` | 直接关系 |
| SPEC_VALUE | `PartHasSpecValue` / `ProductClassHasSpecValue` | Part 或 ProductClass 持有 SpecValue |
| DEFINES_PARAMETER | `PartClassDefinesParameter` | 直接关系 |
| REALIZES | `ProductInstanceRealizesProductClass` | 直接关系 |
| OFFERS_PART | `ProductInstanceOffersPart` + `PartOfferedByProductInstance` | linkProperties 沉淀到 ProductInstancePartOffer（enabled/disabled/minQty/maxQty/fixed） |
| OVERRIDES_SPEC | `ProductInstanceOverridesSpec` | SpecOverride 实体承载 override_value |
| SELECTS_PART | `ConfigurationSelectsPart` + `ConfiguredPartReferencesPart` | 配置方案选择部件 |
| HAS_CONFIGURED_VALUE | `ConfigurationHasConfiguredValue` | 直接关系 |

## 附录 C. 异常情况的诊断路径

1. **看不到 Ontology item**：检查 §2.1 的 Tenant 设置。
2. **看不到 Graph item**：刷新 Graph：Workspace → 自动生成的 Graph 子项 → **... → Schedule → Refresh now**。
3. **Data Agent 答错**：在 Data Agent 顶部点 **Agent instructions** 把系统提示改写。
4. **Activator 规则触发后没动作**：先确认 Teams channel 或 Webhook URL 仍有效。

## 附录 D. 参考资料

|| 资源 | 链接 |
|---|
| What is Fabric IQ? | https://learn.microsoft.com/en-us/fabric/iq/overview |
| What is ontology (preview)? | https://learn.microsoft.com/en-us/fabric/iq/ontology/overview |
| Create entity types | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-entity-types |
| Bind data | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-bind-data |
| Add relationship types | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-relationship-types |
| GQL language guide for graph in Microsoft Fabric | https://learn.microsoft.com/en-us/fabric/graph/gql-language-guide |
| Add rules (Fabric Activator) | https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction |
| 原方案：复杂产品配置器的数据模型详解 | `./复杂产品配置器的数据模型详解.md` |
| 原方案：Palantir范式复杂产品配置器语义建模方案 | `./Palantir范式复杂产品配置器语义建模方案.md` |

## 附录 E. 变更记录

|| 版本 | 日期 | 主要变更 |
|---|---|---|
| v1.0 | 2026-07-28 | 初始版本：参考电商方案结构，适配复杂产品配置器场景（offersPart裁剪、SpecOverride覆盖、Parameter参数体系、Configuration配置求解） |

---

*文档结束*
