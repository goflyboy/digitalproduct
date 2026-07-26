# Microsoft Fabric IQ 电商语义建模验证操作指南

> **用途**：在 Microsoft Fabric IQ 中，对 [`Palantir范式电商语义建模方案.md`](./Palantir范式电商语义建模方案.md) 做一套可重复的 PoC 验证。
>
> **适用版本**：Microsoft Fabric IQ / Ontology（当前官方文档仍标注为 Preview；界面和能力可能变化）。
>
> **文档版本**：v2.0
>
> **编写日期**：2026-07-26
>
> **更新日期**：2026-07-27
>
> **同步更新说明**：v2.0 与上游 Palantir V4.1（路线 B）同步。主要变更：① 删除 `DECLARES_ATTRIBUTE` 相关设计（Fabric 中对应 `CategoryDeclaresAttribute` Relationship / `category_attribute` 表）；② `attribute` 表删除 `is_sales_attr` / `is_inheritable` 字段；③ `attribute_value` 表新增 `display_meta` 字段（color_hex / image_url / extra_data）；④ `CategoryDeclaresAttribute` Relationship 从 §5 关系清单中删除；⑤ 附录 B LinkType 对照表同步更新。
>
> **验证方式**：OneLake Lakehouse + Ontology（Preview）+ Fabric Graph + Fabric Data Agent；库存预警扩展使用 Fabric Activator / Operations Agent。

---

## 1. 先看结论：这次验证要证明什么

原方案不是一份可以直接导入 Fabric IQ 的 JSON Schema。它是一套 Palantir 风格的**业务语义设计**，需要先转换为 Fabric IQ 能消费的三类资源：

1. **OneLake 中的托管表**：承载对象实例和关系映射数据。
2. **Ontology item**：承载 Entity Type、Property、Entity Type Key、Relationship Type 和数据绑定。
3. **Graph / Agent / Activator**：分别验证多跳关系、自然语言查询和事件驱动动作。

本指南的最终验收结果不是“画出一张图”，而是下面 8 个能力都能用样例数据复现：

| 验收编号 | 原方案能力 | Fabric IQ 验证结果 |
|---|---|---|
| A1 | ObjectType 一等公民 | Ontology 中存在 Category、SPU、SKU、Merchant、MerchantSKU、Price、Inventory 等 Entity Type，并能看到实例 |
| A2 | LinkType 一等公民 | Ontology 中存在方向明确的 Relationship Type，并能在 Graph 中遍历 |
| A3 | Template → ObjectType → Instance 两层模型 | Template、Attribute、SPU、SKU 均有可查询实体；模板与实例之间的驱动关系显式可见 |
| A4 | Backing Datasource | Entity Type 和 Relationship Type 均能追溯到 OneLake Lakehouse 表 |
| A5 | 品类引用模板与属性声明 | Category 的 `spuTemplateId` 可查询；属性从 `CategoryUsesTemplate` → `SpuTemplateDefinesAttribute` 链路获取（V4 路线 B：不再有 `declares_attribute` 关系） |
| A6 | SKU → 商家 → 价格/库存多跳查询 | 能从一个 SKU 找到商家 SKU、商家、价格、库存和仓库 |
| A7 | Agent 消费 | Fabric Data Agent 能用业务术语回答商品搜索、比价和库存问题，并引用 Ontology 中的实体关系 |
| A8 | Action / Operationalization | Activator 或 Operations Agent 能检测低库存并发出通知或触发 Fabric item；不把它误认为完整的 Palantir Action Type 注册中心 |

### 1.1 推荐验证顺序

不要一开始就创建全部 13 个实体和 13 个关系。建议按以下闸门推进：

```text
数据准备 → Ontology 骨架 → 4 个核心实体 → 静态绑定 → 3 个核心关系
    → Graph 单跳/多跳 → 扩展实体 → Agent → Activator → 权限与成本检查
```

- **MVP 闸门**：Category、SPU、SKU、Merchant、MerchantSku、Price、Inventory、Warehouse 加载成功，Graph 能完成一条完整商品链路。
- **完整闸门**：再加入 Brand、Attribute、AttributeValue、SpuTemplate、SkuTemplate 和模板关系。
- **Agent 闸门**：先验证只读问答，再验证库存告警；不要在 PoC 第一轮直接开放写操作。

### 1.2 本指南的关键建模取舍

原方案中的某些概念不能原样当作 Fabric IQ 的原生能力：

| 原方案概念 | 本指南的 Fabric IQ 落地方式 | 验证边界 |
|---|---|---|
| ObjectType | Entity Type | 直接支持 |
| Object Instance | Entity Instance | 绑定静态表后支持 |
| LinkType | Relationship Type | 方向和两端键通过映射表定义 |
| Link properties | 优先沉淀为 `MerchantSku` 等桥接 Entity 的属性 | 关系属性能力和 UI 仍可能随 Preview 变化，不把它作为唯一验收路径 |
| SPU/SKU Template | `SpuTemplate`、`SkuTemplate` Entity + `defines_attribute` 等关系 | Fabric 不会因为模板实体自动生成动态列；规则校验需由 ETL、Notebook、Activator 或应用层完成 |
| 品类继承 | `parent_of` 自连接关系 + `category_level` / `category_path` 属性 | 不假设自动 OWL/RDFS 继承；V4 路线 B：`category_attribute` 表与 `CategoryDeclaresAttribute` Relationship 已删除，属性声明收敛在 `SpuTemplate → SpuTemplateDefinesAttribute` |
| Backing Datasource | OneLake managed Lakehouse 表绑定 | 不是任意外部数据库联邦；静态实体绑定有来源限制 |
| Graph | Ontology 自动创建的 managed Graph，以及独立 Graph item | Fabric Graph 当前是 labeled property graph（LPG），不是 RDF；查询使用 GQL，不是 Cypher |
| Action Type | Activator rule、Operations Agent recommendation、Power Automate 或 Fabric item | 这是动作编排，不等同于完整的 Action Type schema 治理 |
| 角色视图 | Workspace/item/source 权限，必要时加语义模型 RLS 或应用层过滤 | 不假设 Ontology Preview 自动提供每个实体实例的 Palantir 式 ABAC |

> **务必先读这一节。** 如果把原文中的 JSON、Cypher 或 `LinkType` 直接复制到 Fabric UI，通常会遇到类型、字段名、查询语言或权限模型不匹配的问题。

---

## 2. 前置条件与环境检查

### 2.1 必备资源与角色

| 资源 | 是否必须 | 说明 |
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
5. **Operations agent tenant settings**（可选）—— 若要使用 Operations Agent 验证 §6 的库存预警。

Workspace 角色要求：

| 角色 | 工作内容 |
|---|---|
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
[ ] 3. 在 Workspace 中新建一个 Lakehouse，命名：EcommerceOntologyLH
[ ] 4. 在 Lakehouse 中创建一个 schema，命名：ontology
[ ] 5. 准备一个 Notebook，命名：EcommerceOntologyBootstrap，用于创建所有 OneLake 表
[ ] 6. 在 Workspace 中创建 Ontology (preview) item，命名：EcommerceOntology
[ ] 7. 记录 Ontology item 的 Workspace ID 和 Ontology ID（后面 §6 的 Copilot Studio / Foundry IQ 集成要用）
[ ] 8. 在 Workspace 中创建 Graph item，命名：EcommerceGraph（可选；Ontology 自带 managed Graph，独立的 Graph 用于手工建模）
```

`<!-- APPEND-2 -->` 留位：详细步骤在 §3 与 §4 给出。

---

## 3. 把 Palantir 设计转换为 OneLake 表

Fabric IQ 的 Ontology 只能绑定 OneLake 中的表。第一步就是按 Entity Type 与 Relationship Type 的语义，在 Lakehouse 中建立**扁平关系型 schema**。所有映射字段必须遵循 Fabric 限制：列名以字母数字开头并结束，仅含 `A-Z`、`a-z`、`0-9`、`-`、`_`；不出现 `,`、`;`、`{}`、`()`、空格、`=`、换行等触发 column mapping 的字符。

### 3.1 表清单与命名映射

下表把原方案中的 13 个 ObjectType 折叠到 14 张 OneLake 表（Entity 表 + 若干桥接映射表）。注意两个关键折叠：

- **OT_MERCHANT_SKU** 用独立桥接实体表承载，原方案中由 SOLD_BY 的 linkProperties 沉淀而成。
- **SOLD_BY、SOLD_BY_DETAILS 等业务关系** 通过 `MerchantSku` 桥接表还原成可遍历的多跳关系。

| 表名 | 对应原方案 | OneLake schema | 用途 |
|---|---|---|---|
| `category` | OT_CATEGORY | ontology | 品类实例，含 `category_id`、`parent_id`、`path` |
| `brand` | OT_BRAND | ontology | 品牌 |
| `attribute` | OT_ATTRIBUTE | ontology | 属性定义 |
| `attribute_value` | OT_ATTRIBUTE_VALUE | ontology | 属性取值 |
| `spu_template` | OT_SPU_TEMPLATE | ontology | SPU 模板 |
| `sku_template` | OT_SKU_TEMPLATE | ontology | SKU 模板 |
| `spu` | OT_SPU | ontology | SPU 实例 |
| `sku` | OT_SKU | ontology | SKU 实例 |
| `sku_attribute_value` | §2.1.8 HAS_ATTR_VALUE | ontology | SKU ↔ AttributeValue 多对多映射 |
| `merchant` | OT_MERCHANT | ontology | 商家 |
| `warehouse` | OT_WAREHOUSE | ontology | 仓库 |
| `merchant_sku` | OT_MERCHANT_SKU | ontology | 商家 SKU（含 SOLD_BY 的 linkProperties 沉淀） |
| `price` | OT_PRICE | ontology | 商家 SKU 的多类型价格 |
| `inventory` | OT_INVENTORY | ontology | 商家 SKU 在各仓库的库存 |

> **V4 路线 B 重要变更**：原 `category_attribute` 表（对应 `DECLARES_ATTRIBUTE` LinkType）已在 Palantir V4 中删除。Fabric 中的 `CategoryDeclaresAttribute` Relationship 与对应表已从本指南 §3.1 / §3.2 / §5.1 中移除。属性声明的查询路径改为：`Category → USES_TEMPLATE → SpuTemplate → SpuTemplateDefinesAttribute → Attribute`。

> **关系映射表**在 Fabric IQ Ontology 中是“一等公民”，因此 `category`（自连接）、`sku_attribute_value`、`spu_template_attribute`、`sku_template_attribute`、`merchant_sku`、`price`、`inventory` 这几张表既是实体表，又会被复用为关系绑定表。

### 3.2 表结构（DDL）与列约定

下面给出 Lakehouse Spark SQL 表结构。所有主键字段都用 `STRING`，符合 Entity Type Key 当前仅支持 `string` / `integer` 的限制。所有时间戳列用 `TIMESTAMP`。所有金额用 `DECIMAL(18,2)`。删除原方案中容易触发表名/列名限制的字符。

```sql
CREATE SCHEMA IF NOT EXISTS ontology;
USE SCHEMA ontology;

-- 品类
CREATE TABLE IF NOT EXISTS category (
    category_id     STRING  NOT NULL,
    category_name   STRING  NOT NULL,
    parent_id       STRING,
    category_level  INT,
    category_path   STRING,
    spu_template_id STRING,
    status          STRING,
    PRIMARY KEY (category_id) DISABLE NOVALIDATE
) USING DELTA;

-- 品牌
CREATE TABLE IF NOT EXISTS brand (
    brand_id    STRING NOT NULL,
    brand_name  STRING NOT NULL,
    country     STRING,
    logo_url    STRING,
    status      STRING,
    PRIMARY KEY (brand_id) DISABLE NOVALIDATE
) USING DELTA;

-- 属性定义
CREATE TABLE IF NOT EXISTS attribute (
    attr_id           STRING NOT NULL,
    attr_name         STRING NOT NULL,
    data_type         STRING NOT NULL,
    validation_rules  STRING,
    default_value     STRING,
    PRIMARY KEY (attr_id) DISABLE NOVALIDATE
) USING DELTA;
-- 注意：V4 路线 B 已删除 is_sales_attr / is_inheritable 字段
-- 这些语义移至 SpuTemplate 的 SpuTemplateDefinesAttribute 关系（scope: required/optional/sales）

-- 属性取值
CREATE TABLE IF NOT EXISTS attribute_value (
    attr_value_id STRING NOT NULL,
    attr_id       STRING NOT NULL,
    value_text    STRING NOT NULL,
    alias         STRING,
    sort_order    INT,
    -- display_meta: 展示元数据，对应电商产品数据模型 v1.0
    -- JSON: {color_hex, image_url, size_guide, extra_data}
    display_meta  STRING,
    PRIMARY KEY (attr_value_id) DISABLE NOVALIDATE
) USING DELTA;

-- SPU 模板
CREATE TABLE IF NOT EXISTS spu_template (
    template_id            STRING NOT NULL,
    template_name          STRING NOT NULL,
    applicable_categories  STRING,
    PRIMARY KEY (template_id) DISABLE NOVALIDATE
) USING DELTA;

-- SKU 模板
CREATE TABLE IF NOT EXISTS sku_template (
    template_id             STRING NOT NULL,
    template_name           STRING NOT NULL,
    parent_spu_template_id  STRING,
    applicable_categories   STRING,
    sales_attribute_rules   STRING,
    auto_generate           BOOLEAN,
    PRIMARY KEY (template_id) DISABLE NOVALIDATE
) USING DELTA;

-- SPU 实例
CREATE TABLE IF NOT EXISTS spu (
    spu_id            STRING NOT NULL,
    spu_name          STRING NOT NULL,
    template_id       STRING,
    brand_id          STRING,
    primary_category_id STRING,
    description       STRING,
    specifications    STRING,
    images            STRING,
    status            STRING,
    created_at        TIMESTAMP,
    updated_at        TIMESTAMP,
    PRIMARY KEY (spu_id) DISABLE NOVALIDATE
) USING DELTA;

-- SKU 实例
CREATE TABLE IF NOT EXISTS sku (
    sku_id            STRING NOT NULL,
    sku_name          STRING NOT NULL,
    spu_id            STRING NOT NULL,
    sales_attrs_hash  STRING NOT NULL,
    status            STRING,
    created_at        TIMESTAMP,
    PRIMARY KEY (sku_id) DISABLE NOVALIDATE
) USING DELTA;

-- SKU ↔ AttributeValue 多对多
CREATE TABLE IF NOT EXISTS sku_attribute_value (
    sku_id          STRING NOT NULL,
    attr_value_id   STRING NOT NULL,
    attr_id         STRING,
    PRIMARY KEY (sku_id, attr_value_id) DISABLE NOVALIDATE
) USING DELTA;

-- 商家
CREATE TABLE IF NOT EXISTS merchant (
    merchant_id    STRING NOT NULL,
    merchant_name  STRING NOT NULL,
    merchant_type  STRING,
    contact_phone  STRING,
    status         STRING,
    created_at     TIMESTAMP,
    PRIMARY KEY (merchant_id) DISABLE NOVALIDATE
) USING DELTA;

-- 仓库
CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id    STRING NOT NULL,
    warehouse_name  STRING NOT NULL,
    location        STRING,
    warehouse_type  STRING,
    status          STRING,
    PRIMARY KEY (warehouse_id) DISABLE NOVALIDATE
) USING DELTA;

-- 商家 SKU（SOLD_BY 沉淀）
CREATE TABLE IF NOT EXISTS merchant_sku (
    merchant_sku_id STRING NOT NULL,
    sku_id          STRING NOT NULL,
    merchant_id     STRING NOT NULL,
    status          STRING,
    listing_time    TIMESTAMP,
    PRIMARY KEY (merchant_sku_id) DISABLE NOVALIDATE
) USING DELTA;

-- 价格
CREATE TABLE IF NOT EXISTS price (
    price_id          STRING NOT NULL,
    merchant_sku_id   STRING NOT NULL,
    price_type        STRING,
    amount            DECIMAL(18,2),
    currency          STRING,
    effective_from    TIMESTAMP,
    effective_to      TIMESTAMP,
    status            STRING,
    PRIMARY KEY (price_id) DISABLE NOVALIDATE
) USING DELTA;

-- 库存
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id       STRING NOT NULL,
    merchant_sku_id    STRING NOT NULL,
    warehouse_id       STRING NOT NULL,
    available          INT,
    reserved           INT,
    alert_threshold    INT,
    updated_at         TIMESTAMP,
    PRIMARY KEY (inventory_id) DISABLE NOVALIDATE
) USING DELTA;

-- V4 路线 B：已删除 category_attribute 表（原 DECLARES_ATTRIBUTE 关系映射）
-- 属性声明查询路径：Category → USES_TEMPLATE → SpuTemplate → SpuTemplateDefinesAttribute → Attribute
```

**为什么表里要有 `parent_id` 等“看上去多余”的字段？** Ontology 关系绑定只需要 `origin` 与 `target` 两列。但当前 UI 在创建 Relationship 时要求 mapping table 的每一行都已经对应 origin 与 target 的主键，并且会在 entity details 视图里出现重复信息。把 `category_path`/`parent_id` 物化到行里，能让 GQL 直接以 O(1) 查到继承链，不用每次做多次 traversal。

### 3.3 样例数据：用一份能复现的最小数据集

下面给出一份完整的样例数据。把下面这段 Spark SQL 在 Notebook 中跑一遍，即可作为整套验证的基线。所有 ID 都与原方案 §2.2 的实例一致。

```sql
-- 品类：ROOT → 手机数码 → 智能手机 → iPhone
INSERT INTO category VALUES
('ROOT',        '根品类',         NULL, 0, '/ROOT',          NULL,         'active'),
('CAT_PHONE',   '手机数码',       'ROOT', 1, '/ROOT/CAT_PHONE',     'TMPL_PHONE',  'active'),
('CAT_SMART',   '智能手机',       'CAT_PHONE', 2, '/ROOT/CAT_PHONE/CAT_SMART', 'TMPL_PHONE', 'active'),
('CAT_IPHONE',  'iPhone',         'CAT_SMART', 3, '/ROOT/CAT_PHONE/CAT_SMART/CAT_IPHONE', 'TMPL_IPHONE', 'active'),
('CAT_ACC',     '手机配件',       'CAT_PHONE', 2, '/ROOT/CAT_PHONE/CAT_ACC', 'TMPL_ACC',  'active');

-- 品牌
INSERT INTO brand VALUES
('BR_APPLE', 'Apple',  'US', 'https://cdn.example.com/apple.png', 'active'),
('BR_SAMSU', 'Samsung','KR', 'https://cdn.example.com/samsung.png','active');

-- 属性
INSERT INTO attribute VALUES
('ATTR_COLOR', '颜色',   'STRING', NULL, NULL),
('ATTR_CAP',   '容量',   'STRING', NULL, NULL),
('ATTR_NET',   '制式',   'STRING', NULL, NULL),
('ATTR_YEAR',  '上市年份','INT',   NULL, NULL);
-- V4: 已删除 is_sales_attr / is_inheritable / is_required 列
-- 这些语义通过 SpuTemplate 的 SpuTemplateDefinesAttribute 关系表达（scope: required/optional/sales）

-- 属性取值（含 display_meta，对应电商产品数据模型 v1.0）
INSERT INTO attribute_value VALUES
('AV_BLACK',    'ATTR_COLOR', '黑色',   NULL, 1, '{"color_hex":"#1C1C1E","image_url":"https://cdn.example.com/colors/iphone_black.png"}'),
('AV_WHITE',    'ATTR_COLOR', '白色',   NULL, 2, '{"color_hex":"#F5F5F7","image_url":"https://cdn.example.com/colors/iphone_white.png"}'),
('AV_TITANIUM', 'ATTR_COLOR', '钛色',   NULL, 3, '{"color_hex":"#8E8E93","image_url":"https://cdn.example.com/colors/iphone_titanium.png"}'),
('AV_128',      'ATTR_CAP',   '128GB',  NULL, 1, '{"extra_data":{"unit":"GB","numeric_value":128}}'),
('AV_256',      'ATTR_CAP',   '256GB',  NULL, 2, '{"extra_data":{"unit":"GB","numeric_value":256}}'),
('AV_512',      'ATTR_CAP',   '512GB',  NULL, 3, '{"extra_data":{"unit":"GB","numeric_value":512}}'),
('AV_PUBLIC',    'ATTR_NET',   '公开版',  NULL, 1, NULL),
('AV_TELECOM',  'ATTR_NET',   '电信版',  NULL, 2, NULL);

-- 模板
INSERT INTO spu_template VALUES
('TMPL_PHONE',  '通用手机模板', 'CAT_SMART,CAT_IPHONE'),
('TMPL_IPHONE', 'iPhone 专用模板', 'CAT_IPHONE'),
('TMPL_ACC',    '手机配件模板', 'CAT_ACC');

INSERT INTO sku_template VALUES
('TMPL_IPHONE_SKU', 'iPhone SKU 模板', 'TMPL_IPHONE', 'CAT_IPHONE',
 'color|capacity|network', true),
('TMPL_ACC_SKU',    '手机配件 SKU 模板','TMPL_ACC','CAT_ACC','color', false);

-- SPU
INSERT INTO spu VALUES
('SPU_IP16',   'Apple iPhone 16',  'TMPL_IPHONE','BR_APPLE','CAT_IPHONE',
 '官方正品 iPhone 16','{"chip":"A18","screen":"6.1"}','main.jpg','ACTIVE',
 TIMESTAMP '2026-07-26 10:00:00', TIMESTAMP '2026-07-26 10:00:00'),
('SPU_S24',    'Samsung Galaxy S24','TMPL_PHONE','BR_SAMSU','CAT_SMART',
 '官方正品 Galaxy S24','{"chip":"Snapdragon 8 Gen 3"}','main.jpg','ACTIVE',
 TIMESTAMP '2026-07-26 10:00:00', TIMESTAMP '2026-07-26 10:00:00');

-- SKU（6 个 iPhone + 2 个 S24）
INSERT INTO sku VALUES
('SKU_IP16_128_BLACK','iPhone 16 128GB 黑色','SPU_IP16','<color:BLACK|cap:128|net:PUBLIC>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_IP16_256_BLACK','iPhone 16 256GB 黑色','SPU_IP16','<color:BLACK|cap:256|net:PUBLIC>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_IP16_256_TITAN','iPhone 16 256GB 钛色','SPU_IP16','<color:TITAN|cap:256|net:PUBLIC>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_IP16_512_WHITE','iPhone 16 512GB 白色','SPU_IP16','<color:WHITE|cap:512|net:PUBLIC>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_IP16_128_TELE','iPhone 16 128GB 电信版','SPU_IP16','<color:BLACK|cap:128|net:TELECOM>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_IP16_256_BLACK2','iPhone 16 256GB 黑色 复刻','SPU_IP16','<color:BLACK|cap:256|net:PUBLIC|variant:2>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_S24_256',   'Galaxy S24 256GB','SPU_S24','<cap:256>','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('SKU_S24_512',   'Galaxy S24 512GB','SPU_S24','<cap:512>','ONLINE',TIMESTAMP '2026-07-26 10:00:00');

-- SKU ↔ 属性取值
INSERT INTO sku_attribute_value VALUES
('SKU_IP16_128_BLACK','AV_BLACK',   'ATTR_COLOR'),
('SKU_IP16_128_BLACK','AV_128',     'ATTR_CAP'),
('SKU_IP16_128_BLACK','AV_PUBLIC',  'ATTR_NET'),
('SKU_IP16_256_BLACK','AV_BLACK',   'ATTR_COLOR'),
('SKU_IP16_256_BLACK','AV_256',     'ATTR_CAP'),
('SKU_IP16_256_BLACK','AV_PUBLIC',  'ATTR_NET'),
('SKU_IP16_256_TITAN','AV_TITANIUM','ATTR_COLOR'),
('SKU_IP16_256_TITAN','AV_256',     'ATTR_CAP'),
('SKU_IP16_256_TITAN','AV_PUBLIC',  'ATTR_NET'),
('SKU_IP16_512_WHITE','AV_WHITE',   'ATTR_COLOR'),
('SKU_IP16_512_WHITE','AV_512',     'ATTR_CAP'),
('SKU_IP16_512_WHITE','AV_PUBLIC',  'ATTR_NET'),
('SKU_IP16_128_TELE','AV_BLACK',    'ATTR_COLOR'),
('SKU_IP16_128_TELE','AV_128',      'ATTR_CAP'),
('SKU_IP16_128_TELE','AV_TELECOM',  'ATTR_NET'),
('SKU_IP16_256_BLACK2','AV_BLACK',  'ATTR_COLOR'),
('SKU_IP16_256_BLACK2','AV_256',    'ATTR_CAP'),
('SKU_IP16_256_BLACK2','AV_PUBLIC', 'ATTR_NET'),
('SKU_S24_256','AV_256','ATTR_CAP'),
('SKU_S24_512','AV_512','ATTR_CAP');

-- 商家
INSERT INTO merchant VALUES
('MERCH_DXY',  '店小二旗舰店','flagship','400-100-1001','active',TIMESTAMP '2026-07-26 10:00:00'),
('MERCH_DIG',  '数码专营店','specialty','400-100-1002','active',TIMESTAMP '2026-07-26 10:00:00'),
('MERCH_APP',  '苹果直营店','self_operated','400-100-1003','active',TIMESTAMP '2026-07-26 10:00:00');

-- 仓库
INSERT INTO warehouse VALUES
('WH_HUADONG','华东中心仓','上海','self_operated','active'),
('WH_HUABEI', '华北中心仓','北京','self_operated','active');

-- 商家 SKU（SOLD_BY 沉淀）
INSERT INTO merchant_sku VALUES
('MSKU_DXY_IP16_128','SKU_IP16_128_BLACK','MERCH_DXY','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('MSKU_DXY_IP16_256','SKU_IP16_256_BLACK','MERCH_DXY','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('MSKU_DIG_IP16_256','SKU_IP16_256_BLACK','MERCH_DIG','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('MSKU_APP_IP16_512','SKU_IP16_512_WHITE','MERCH_APP','ONLINE',TIMESTAMP '2026-07-26 10:00:00'),
('MSKU_DXY_S24_256', 'SKU_S24_256','MERCH_DXY','ONLINE',TIMESTAMP '2026-07-26 10:00:00');

-- 价格
INSERT INTO price VALUES
('PR_DXY_128_SALE','MSKU_DXY_IP16_128','sale',     6299.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active'),
('PR_DXY_128_ORIG','MSKU_DXY_IP16_128','original', 6999.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active'),
('PR_DXY_256_SALE','MSKU_DXY_IP16_256','sale',     6499.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active'),
('PR_DIG_256_SALE','MSKU_DIG_IP16_256','sale',     6399.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active'),
('PR_APP_512_SALE','MSKU_APP_IP16_512','sale',     7499.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active'),
('PR_DXY_S24_SALE','MSKU_DXY_S24_256', 'sale',     5499.00,'CNY',TIMESTAMP '2026-07-01',TIMESTAMP '2099-12-31','active');

-- 库存
INSERT INTO inventory VALUES
('INV_DXY_128_HD','MSKU_DXY_IP16_128','WH_HUADONG', 50, 5, 10,TIMESTAMP '2026-07-26 10:00:00'),
('INV_DXY_128_HB','MSKU_DXY_IP16_128','WH_HUABEI',  20, 1,  5,TIMESTAMP '2026-07-26 10:00:00'),
('INV_DXY_256_HD','MSKU_DXY_IP16_256','WH_HUADONG',  8, 2, 10,TIMESTAMP '2026-07-26 10:00:00'),  -- 触发低库存预警
('INV_DIG_256_HD','MSKU_DIG_IP16_256','WH_HUADONG', 30, 4, 10,TIMESTAMP '2026-07-26 10:00:00'),
('INV_APP_512_HD','MSKU_APP_IP16_512','WH_HUADONG',100,10, 20,TIMESTAMP '2026-07-26 10:00:00'),
('INV_DXY_S24_HD','MSKU_DXY_S24_256', 'WH_HUADONG', 40, 3, 10,TIMESTAMP '2026-07-26 10:00:00');

-- V4 路线 B：已删除 category_attribute 表与 DECLARES_ATTRIBUTE 关系
-- 属性声明通过 Category.spuTemplateId → SpuTemplate → SpuTemplateDefinesAttribute 查询
```

> **注意**：`PRIMARY KEY (xxx) DISABLE NOVALIDATE` 在 Lakehouse Delta 中不强制唯一性，仅用于在 Lakehouse 中表达意图；Fabric IQ 端的实体键校验在绑定阶段由 UI 完成。Lakehouse 的列定义保持简洁，便于以后被 Fabric IQ 自动生成的 Graph item 直接读取。

### 3.4 一致性与质量检查（建议在创建 Ontology 之前执行）

在创建 Ontology 前，对源数据做一次全表校验：

```sql
-- SPU 必须指向一个存在的 Category
SELECT s.spu_id
FROM ontology.spu s
LEFT JOIN ontology.category c ON s.primary_category_id = c.category_id
WHERE c.category_id IS NULL;

-- SKU 必须指向一个存在的 SPU
SELECT k.sku_id
FROM ontology.sku k
LEFT JOIN ontology.spu p ON k.spu_id = p.spu_id
WHERE p.spu_id IS NULL;

-- MerchantSku 必须指向 SKU + Merchant
SELECT ms.merchant_sku_id
FROM ontology.merchant_sku ms
LEFT JOIN ontology.sku k ON ms.sku_id = k.sku_id
LEFT JOIN ontology.merchant m ON ms.merchant_id = m.merchant_id
WHERE k.sku_id IS NULL OR m.merchant_id IS NULL;

-- 价格 / 库存 / 库存的 MerchantSku 必须存在
SELECT p.price_id
FROM ontology.price p
LEFT JOIN ontology.merchant_sku ms ON p.merchant_sku_id = ms.merchant_sku_id
WHERE ms.merchant_sku_id IS NULL;

-- 父子品类不能形成环
WITH RECURSIVE chain AS (
  SELECT category_id, parent_id, ARRAY[category_id] AS path FROM ontology.category
  UNION ALL
  SELECT c.category_id, c.parent_id, chain.path || c.category_id
  FROM ontology.category c JOIN chain ON c.parent_id = chain.category_id
)
SELECT category_id, path FROM chain WHERE array_size(path) <> array_size(array_distinct(path));
```

如果任何一条返回非空集，回到表里修复后再继续。

`<!-- APPEND-3 -->` 留位：§4 创建 Ontology。

---

## 4. 创建 Ontology（Entity Type + Property）

Entity Type 的创建流程是统一的：在 Home configuration canvas → Add entity type → 输入名字 → 进入 Configure 页 → Add properties → Bind data。所有 Entity Type 必须有至少一个属性后才能在 Graph 中出现实例（Entity Type Key 是用 string 或 integer 属性做的）。

### 4.1 命名规则（Fabric IQ 强制）

- Entity Type 名：`1–26` 字符，只能含字母数字、下划线、连字符；首尾必须是字母数字。
- 自定义 Property 名：同样 `1–26` 字符；**Property 名在整个 Ontology 内必须唯一**（即便跨不同 Entity Type）。如果两个 Entity Type 都想要 `name`，会冲突。
- Entity Type Key：必须是 string 或 integer 属性。
- 推荐使用业务可读名 `Category` / `Spu` / `Sku`，不要带 `OT_` 前缀（会让关系名字里出现 `OT_xxx` 的奇怪连字符）。

> **小贴士**：原方案中所有 `OT_XXX` 名只是内部 Schema 名。在 Ontology 里直接使用业务名（`Category`、`Spu` …），让 Data Agent 回答时更自然。

### 4.2 一次性创建 13 个 Entity Type

按以下顺序操作，每一步都在 Ontology item 中点 Add entity type → 输入名字 → Add Entity Type → 进入 Configure 页。

| # | Entity Type 名 | Entity Type Key | 主要 Property | 绑定 OneLake 表 |
|---|---|---|---|---|
| 1 | `Category` | `categoryId` (string) | `categoryId`, `categoryName`, `parentId`, `categoryLevel`, `categoryPath`, `spuTemplateId`, `status` | `ontology.category` |
| 2 | `Brand` | `brandId` (string) | `brandId`, `brandName`, `country`, `logoUrl`, `status` | `ontology.brand` |
| 3 | `Attribute` | `attrId` (string) | `attrId`, `attrName`, `dataType`, `validationRules`, `defaultValue` | `ontology.attribute` |
| 4 | `AttributeValue` | `attrValueId` (string) | `attrValueId`, `attrId`, `valueText`, `alias`, `sortOrder`, `displayMeta` | `ontology.attribute_value` |
| 5 | `SpuTemplate` | `templateId` (string) | `templateId`, `templateName`, `applicableCategories` | `ontology.spu_template` |
| 6 | `SkuTemplate` | `templateId` (string) | `templateId`, `templateName`, `parentSpuTemplateId`, `applicableCategories`, `salesAttributeRules`, `autoGenerate` | `ontology.sku_template` |
| 7 | `Spu` | `spuId` (string) | `spuId`, `spuName`, `templateId`, `brandId`, `primaryCategoryId`, `description`, `specifications`, `images`, `status`, `createdAt`, `updatedAt` | `ontology.spu` |
| 8 | `Sku` | `skuId` (string) | `skuId`, `skuName`, `spuId`, `salesAttrsHash`, `status`, `createdAt` | `ontology.sku` |
| 9 | `Merchant` | `merchantId` (string) | `merchantId`, `merchantName`, `merchantType`, `contactPhone`, `status`, `createdAt` | `ontology.merchant` |
| 10 | `Warehouse` | `warehouseId` (string) | `warehouseId`, `warehouseName`, `location`, `warehouseType`, `status` | `ontology.warehouse` |
| 11 | `MerchantSku` | `merchantSkuId` (string) | `merchantSkuId`, `skuId`, `merchantId`, `status`, `listingTime` | `ontology.merchant_sku` |
| 12 | `Price` | `priceId` (string) | `priceId`, `merchantSkuId`, `priceType`, `amount`, `currency`, `effectiveFrom`, `effectiveTo`, `status` | `ontology.price` |
| 13 | `Inventory` | `inventoryId` (string) | `inventoryId`, `merchantSkuId`, `warehouseId`, `available`, `reserved`, `alertThreshold`, `updatedAt` | `ontology.inventory` |

> **V4 路线 B 变更**：第 3 行 `Attribute` Entity Type 已删除 `isSalesAttr` / `isInheritable` 字段（这些语义移至 `SpuTemplate` 的 `SpuTemplateDefinesAttribute` 关系，`scope` 替代）；第 4 行 `AttributeValue` 新增 `displayMeta`（string，存 JSON，含 color_hex / image_url / extra_data，对应电商产品数据模型 v1.0）。

完整步骤示例（以 `Category` 为例）：

1. 在 Home configuration canvas 顶部点 **Add entity type** → 输入 `Category` → **Add Entity Type**。
2. 选中新卡片 → 顶部 **View entity type details** → 进入 Configure 页。
3. **Manage property bindings → Add properties**，依次按上表新增属性，把类型选成 `string` / `integer` / `decimal` / `boolean` / `datetime`。`specifications` / `applicableCategories` / `validationRules` 这种结构化字段用 `string` 存 JSON 字符串即可。
4. **Define entity type key**：`categoryId`，属性类型必须为 string。
5. **Add data binding → Lakehouse table** → 选 `EcommerceOntologyLH` → `ontology.category` → 在 Entity type key mapping 里把 `categoryId` 指向 `category_id` 列；在 Properties 区域确认每列都映射好 → **Save**。
6. 完成后在 Configure 页把 `categoryName` 标为 **display name property**。

> **陷阱**：如果 Lakehouse 表里有 OneLake Security 或 column mapping（特殊字符列名），binding 列表里就看不到该 Lakehouse。修复办法：禁用 OneLake Security，或者改名去掉 `,` `;` `()` `{}` `=` `\n` `\t` 空格等字符。

把以上 13 行重复 13 遍。MVP 阶段（§1.1）可以只做 1–4、7–13，跳过 5、6 模板实体；完整闸门再补齐。

### 4.3 把 Template 类实体补充到位（完整闸门）

当 §4.2 全部 13 个 Entity Type 都能看到实例后再补：

- `SpuTemplate` 跟 `SpuTemplate -> Attribute` 的关系一起做，因为没有 attribute 模板的 Spu 是不合规的。
- `SkuTemplate` 跟 `SkuTemplate -> Attribute` 和 `SkuTemplate -> SpuTemplate` 一起做。

模板实体的属性命名建议保持与 `Attribute` 一致（`attrId`/`attrName`），让模板与属性之间的多对多关系可以直接用 `attr_id` 列做映射。

`<!-- APPEND-4 -->` 留位：§5 创建关系。

---

## 5. 创建 Relationship Type（对应 LinkType）

Fabric IQ 的 Relationship Type 与 Entity Type 平级，必须单独创建并显式绑定映射表（mapping table）。映射表的每一行都同时持有 origin 和 target 的 Entity Type Key。本指南把原方案（Palantir V4.1 路线 B）13 个 LinkType 重写为 16 个 Relationship Type，**避开 SOLD_BY 上挂 linkProperties 的灰色地带**：把 SOLD_BY 的 linkProperties（merchant_sku_id、status、listing_time）全部沉淀到 `MerchantSku` 桥接实体上，让关系保持简洁。

### 5.1 关系清单与映射

| # | Relationship 名 | Origin | Target | Mapping Table | Matched Origin | Matched Target |
|---|---|---|---|---|---|---|
| 1 | `CategoryParentOf` | `Category` | `Category` | `ontology.category` | `parent_id` | `category_id` |
| 2 | `AttributeHasAttributeValue` | `Attribute` | `AttributeValue` | `ontology.attribute_value` | `attr_id` | `attr_value_id` |
| 3 | `SpuTemplateDefinesAttribute` | `SpuTemplate` | `Attribute` | 新建映射表 `ontology.spu_template_attribute`（MVP 可省略） | `template_id` | `attr_id` |
| 4 | `SkuTemplateInheritsFromSpuTemplate` | `SkuTemplate` | `SpuTemplate` | `ontology.sku_template` | `template_id` | `parent_spu_template_id` |
| 5 | `SkuTemplateDefinesAttribute` | `SkuTemplate` | `Attribute` | 新建映射表 `ontology.sku_template_attribute`（MVP 可省略） | `template_id` | `attr_id` |
| 6 | `CategoryUsesTemplate` | `Category` | `SpuTemplate` | `ontology.category` | `spu_template_id` | `template_id` |
| 7 | `SpuBelongsToCategory` | `Spu` | `Category` | `ontology.spu` | `primary_category_id` | `category_id` |
| 8 | `SpuHasBrand` | `Spu` | `Brand` | `ontology.spu` | `brand_id` | `brand_id` |
| 9 | `SpuUsesTemplate` | `Spu` | `SpuTemplate` | `ontology.spu` | `template_id` | `template_id` |
| 10 | `SpuGeneratesSku` | `Spu` | `Sku` | `ontology.sku` | `spu_id` | `sku_id` |
| 11 | `SkuHasAttributeValue` | `Sku` | `AttributeValue` | `ontology.sku_attribute_value` | `sku_id` | `attr_value_id` |
| 12 | `MerchantSkuIsSoldByMerchant` | `MerchantSku` | `Merchant` | `ontology.merchant_sku` | `merchant_sku_id` → `merchant_id` | `merchant_id` |
| 13 | `SkuListedAsMerchantSku` | `Sku` | `MerchantSku` | `ontology.merchant_sku` | `sku_id` | `merchant_sku_id` |
| 14 | `MerchantSkuHoldsPrice` | `MerchantSku` | `Price` | `ontology.price` | `merchant_sku_id` | `merchant_sku_id` |
| 15 | `MerchantSkuHoldsInventory` | `MerchantSku` | `Inventory` | `ontology.inventory` | `merchant_sku_id` | `merchant_sku_id` |
| 16 | `InventoryLocatedAtWarehouse` | `Inventory` | `Warehouse` | `ontology.inventory` | `inventory_id` → `warehouse_id` | `warehouse_id` |

> **V4 路线 B 变更**：原 #2 `CategoryDeclaresAttribute`（对应 Palantir V3 的 `DECLARES_ATTRIBUTE` LinkType）已删除。属性声明路径改为：`CategoryUsesTemplate`（#6，指向 SpuTemplate）+ `SpuTemplateDefinesAttribute`（#3，指向 Attribute）。查询链路为 `Category → USES_TEMPLATE → SpuTemplate → TEMPLATE_DEFINES_ATTR → Attribute`。

**关于 self-link（自连接关系）的说明**：在 `CategoryParentOf` 中，origin 和 target 都是 `Category`。映射表用同一张 `ontology.category`；Matched origin 列是 `parent_id`，Matched target 列是 `category_id`，让每条 `category` 行都代表一条“子指向父”的边。

**关于跨实体引用的处理**：当一个 mapping table 自身不是 origin / target 主键所在表时，需要先在 mapping table 上加一列指向 origin 的键。例如 `SpuTemplateDefinesAttribute` 用的是 `spu_template_attribute`；该表 PK 为 `(template_id, attr_id)`，满足 origin/target 主键要求，不需要额外列。

**关系命名注意事项**：Entity Type 名是 `Category`，Property 名是 `categoryId`；Relationship Type 名使用驼峰 `CategoryParentOf` 是合法的。不要把名字命名为 `Category->ParentOf` 等含 `>` 的字符串（Fabric 不允许特殊字符）。

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

| 报错 | 排查 |
|---|---|
| Save 后红字：No matching key column | 检查 mapping table 是否有 origin 或 target 的 Entity Type Key 列；`merchant_sku` 缺一列就用 §3.2 的版本 |
| Save 后红字：origin/target entity type not bound | 一定是 origin 或 target 实体还没绑表，回 §4 绑定 |
| Edge 类型看不到实例 | Mapping table 中存在空值，导致实例被过滤；先回 §3.4 的检查 |
| Relationship 实例数量多于预期 | 多对多自连接会出现重复 row，可以用 `MATCH DISTINCT` 或用 `DISTINCT origin/target` 处理；先确认是上游 ETL 问题 |

### 5.4 模板与属性的多对多关系

为 `SpuTemplateDefinesAttribute`、`SkuTemplateDefinesAttribute` 准备两张映射表（在 §3.2 之外）：

```sql
CREATE TABLE IF NOT EXISTS ontology.spu_template_attribute (
    template_id STRING NOT NULL,
    attr_id     STRING NOT NULL,
    scope       STRING  -- required / optional / sales；V4 路线 B 替代原 is_sales_attr/is_inheritable
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology.sku_template_attribute (
    template_id STRING NOT NULL,
    attr_id     STRING NOT NULL,
    scope       STRING  -- required / optional / sales；V4 路线 B：销售属性归属 SKU 模板层
) USING DELTA;

INSERT INTO ontology.spu_template_attribute VALUES
('TMPL_IPHONE','ATTR_COLOR', 'sales'),
('TMPL_IPHONE','ATTR_CAP',   'sales'),
('TMPL_IPHONE','ATTR_NET',   'sales'),
('TMPL_IPHONE','ATTR_YEAR',  'optional'),
('TMPL_PHONE', 'ATTR_COLOR', 'sales'),
('TMPL_PHONE', 'ATTR_CAP',   'sales'),
('TMPL_ACC',   'ATTR_COLOR', 'sales');

INSERT INTO ontology.sku_template_attribute VALUES
('TMPL_IPHONE_SKU','ATTR_COLOR', 'sales'),
('TMPL_IPHONE_SKU','ATTR_CAP',   'sales'),
('TMPL_IPHONE_SKU','ATTR_NET',   'sales'),
('TMPL_ACC_SKU',   'ATTR_COLOR', 'sales');

-- V4 路线 B 属性声明查询路径：
-- Category → USES_TEMPLATE → SpuTemplate → SpuTemplateDefinesAttribute → Attribute
-- SKU 额外路径：SkuTemplate → SkuTemplateDefinesAttribute（scope=sales 驱动 SKU 组合生成）
```
```

### 5.5 刷新 Ontology Graph

刷新方式：

1. 进入 Ontology item → 任一 Entity Type → Configure → Overview 标签 → 任意一张 tile → 顶部点 **Expand** 打开 Graph view → 直接做查询。
2. 等价方式：在 Workspace 中找到自动生成的 Graph item（命名形如 `EcommerceOntology` 的 Graph child item）→ **... → Schedule → Refresh now**。

```text
[ ] 在 Ontology Item → Configure → Overview → Graph tile → Expand，确认出现节点
[ ] 在自动生成的 Graph item 中 Schedule → Refresh now，记录刷新耗时
[ ] 检查错误：若刷新 > 20 分钟且失败，按官方建议缩减节点类型或调整映射
```

`<!-- APPEND-5 -->` 留位：§6 Graph 查询。

---

## 6. 在 Fabric Graph 中验证多跳关系

Fabric Graph 当前是 labeled property graph（LPG），使用 GQL（ISO/IEC 39075）。Cypher 在 Fabric 上**不能直接执行**——原方案 §4.3 的 Cypher 必须重写为 GQL。GQL 的语法骨架是 `MATCH ... [FILTER] ... [LET ...] ... [RETURN ...] [GROUP BY ...] [ORDER BY ...] [LIMIT ...]`。

> **GQL vs Cypher 关键差异**：GQL 用 `FILTER` 替代 `WHERE`；节点标签是 `n:Label` 而非 `(n:Label)`；变量要显式 `LET`；`OPTIONAL MATCH` 是关键字；边属性用 `[e:EdgeType WHERE e.foo = 1]` 内联表达。

### 6.1 进入 Graph 视图

1. Ontology item → Configure → 任一 Entity Type details → Overview → 找到 **Fabric graph** tile → **Expand**。
2. 顶部 ribbon 切到 **Query** 模式 → 选 **Code editor**。
3. 也可以从 Workspace 直接打开自动生成的 Graph item，进入 Query mode。

### 6.2 关键验证查询（GQL 改写）

#### Q1：品类继承路径

```gql
MATCH (root:Category WHERE root.categoryId = 'ROOT')
MATCH path = (root)-[:CategoryParentOf]->{1,5}(c:Category WHERE c.categoryId = 'CAT_IPHONE')
RETURN path, c.categoryId AS leaf_id, c.categoryName AS leaf_name
```

预期返回一条 path：`ROOT → CAT_PHONE → CAT_SMART → CAT_IPHONE`。

#### Q2：从一个 SKU 追溯到 SPU、品牌、主品类

```gql
MATCH (k:Sku WHERE k.skuId = 'SKU_IP16_256_BLACK')
MATCH (k)<-[:SpuGeneratesSku]-(p:Spu)
MATCH (p)-[:SpuHasBrand]->(b:Brand)
MATCH (p)-[:SpuBelongsToCategory]->(c:Category)
RETURN k.skuName AS sku, p.spuName AS spu, b.brandName AS brand, c.categoryName AS category
```

#### Q3：商家 SKU 完整链路

```gql
MATCH (k:Sku WHERE k.skuName = 'iPhone 16 256GB 黑色')
MATCH (k)-[:SkuListedAsMerchantSku]->(ms:MerchantSku)
MATCH (ms)-[:MerchantSkuIsSoldByMerchant]->(m:Merchant)
MATCH (ms)-[:MerchantSkuHoldsPrice]->(pr:Price WHERE pr.priceType = 'sale' AND pr.status = 'active')
MATCH (ms)-[:MerchantSkuHoldsInventory]->(inv:Inventory)
MATCH (inv)-[:InventoryLocatedAtWarehouse]->(w:Warehouse)
RETURN k.skuName AS sku,
       m.merchantName AS merchant,
       pr.amount AS sale_price,
       inv.available AS available_qty,
       w.warehouseName AS warehouse
ORDER BY pr.amount ASC
```

#### Q4：基于属性值的商品搜索（NL2GQL 的底层）

```gql
MATCH (av1:AttributeValue WHERE av1.valueText = '256GB')
MATCH (av2:AttributeValue WHERE av2.valueText = '黑色')
MATCH (k:Sku)-[:SkuHasAttributeValue]->(av1)
MATCH (k)-[:SkuHasAttributeValue]->(av2)
MATCH (k)<-[:SpuGeneratesSku]-(p:Spu)
RETURN p.spuName AS spu, collect(DISTINCT k.skuName) AS matching_skus
```

#### Q5：品类健康度（聚合统计）

```gql
MATCH (c:Category WHERE c.categoryId = 'CAT_IPHONE')
OPTIONAL MATCH (c)<-[:SpuBelongsToCategory]-(p:Spu)
OPTIONAL MATCH (p)-[:SpuGeneratesSku]->(k:Sku)
OPTIONAL MATCH (k)-[:SkuListedAsMerchantSku]->(ms:MerchantSku)
OPTIONAL MATCH (ms)-[:MerchantSkuHoldsPrice]->(pr:Price WHERE pr.priceType = 'sale' AND pr.status = 'active')
WITH c, count(DISTINCT p) AS spu_count,
         count(DISTINCT k) AS sku_count,
         count(DISTINCT ms) AS merchant_count,
         min(pr.amount) AS min_price,
         max(pr.amount) AS max_price,
         avg(pr.amount) AS avg_price
RETURN c.categoryName AS category,
       spu_count, sku_count, merchant_count,
       min_price, max_price, avg_price
```

#### Q6：自连接（品类层级）

```gql
MATCH (leaf:Category WHERE leaf.categoryPath CONTAINS 'CAT_IPHONE')
MATCH path = (root:Category WHERE root.categoryId = 'ROOT')-[:CategoryParentOf*]->(leaf)
LET chain = [n IN nodes(path) | n.categoryName]
RETURN leaf.categoryName AS leaf, chain
```

#### Q7：检测低库存（激活器用）

```gql
MATCH (ms:MerchantSku WHERE ms.status = 'ONLINE')
MATCH (ms)-[:MerchantSkuHoldsInventory]->(inv:Inventory)
LET available = inv.available, threshold = inv.alertThreshold
FILTER available < threshold
RETURN ms.merchantSkuId AS merchant_sku_id,
       inv.warehouseId AS warehouse_id,
       available AS qty,
       threshold AS threshold
ORDER BY available ASC
LIMIT 100
```

> **GQL 注意**：RETURN 里的别名要写在 AS 前（Fabric GQL 与标准 GQL 一致）；变量绑定用 `LET`；类型转换靠 `FILTER`；`count(DISTINCT x)` 在 GQL 中合法；如果遇到不支持的语法（例如部分 `OPTIONAL MATCH` 嵌套），改写为多次 MATCH。

### 6.3 验收清单（Graph）

```text
[ ] Q1 返回 ROOT → CAT_PHONE → CAT_SMART → CAT_IPHONE
[ ] Q2 至少返回一行，包含 sku / spu / brand / category
[ ] Q3 返回 1~N 行，每行覆盖 merchant / sale_price / available_qty / warehouse
[ ] Q4 把 SKU_IP16_256_BLACK 与 SKU_IP16_256_BLACK2 都列出来（同 spu 跨多 SKU）
[ ] Q5 返回聚合：SPU ≥ 1，SKU ≥ 6，merchant ≥ 2
[ ] Q6 在 leaf=CAT_IPHONE 时返回 4 节点路径
[ ] Q7 至少返回 INV_DXY_256_HD 一行（available=8 < threshold=10）
```

把每条查询结果截图或导出到 `docs/verifications/figures/` 中，作为方案 PoC 的视觉证据。

`<!-- APPEND-6 -->` 留位：§7 Agent 验证。

---

## 7. 用 Fabric Data Agent 验证自然语言消费

Fabric IQ 的 Ontology 可以作为 Data Agent 的数据源，让用户用业务术语提问、Agent 自动用 Ontology 实体回答。验证 NL2Ontology 的能力是 PoC 的关键环节。

### 7.1 创建 Data Agent 并绑定 Ontology

1. Workspace 中点 **+ New item** → 选 **Data agent (preview)** → 命名 `EcommerceOntologyAgent` → Create。
2. 在 Data agent 中点 **Add a data source** → 搜索 `EcommerceOntology` → Add。
3. 在左侧 Explorer 中能看到所有 Entity Type 自动出现。
4. **Agent instructions** → 在输入框末尾添加：`Support group by in GQL`（官方建议，针对已知聚合 bug）。
5. 选保存。

### 7.2 验收对话样本（复制即可发送）

| # | 用户问题 | 期望 Agent 行为 |
|---|---|---|
| N1 | `列出 iPhone 品类下所有的 SPU` | 引用 `Spu` 与 `Category`，输出至少 1 条 `Apple iPhone 16` |
| N2 | `列出 iPhone 16 的所有 SKU，并按颜色聚合` | 引用 `Sku` 与 `AttributeValue`，按颜色分组 |
| N3 | `谁在售卖 iPhone 16 256GB 黑色？列出商家和售价` | 引用 `Sku`、`MerchantSku`、`Merchant`、`Price`，按 `priceType='sale'` 过滤 |
| N4 | `按品类统计每类商品的数量、商家数和平均售价` | 引用 `Category`、`Spu`、`Sku`、`MerchantSku`、`Price` 并执行聚合 |
| N5 | `店小二旗舰店有哪些 SKU 的库存低于阈值？` | 引用 `Merchant`、`MerchantSku`、`Inventory`，命中 `INV_DXY_256_HD` |
| N6 | `iPhone 16 Pro 系列 SPU 在哪里？` | 诚实地回答"当前数据集中没有 iPhone 16 Pro 的 SPU"，引用 `Spu` 而不编造 |
| N7 | `解释一下 SKU 与 MerchantSku 的区别` | 引用 `Sku`、`MerchantSku` Entity Type 描述，输出业务语义区分 |

### 7.3 调试 Agent 的常用动作

- 如果回答中带有错误的实体名，回到 Ontology 中确认 Entity Type 名是否符合 §4.1 的命名规则。
- 如果回答中数据有缺失，到 Graph item 中手动 Schedule → Refresh now，让 Graph 子项同步上游数据。
- 如果 Agent 提示 “no data”，等待 5–10 分钟初始化后重试（官方提示）。
- 如果多轮上下文导致混淆，把 Agent instructions 中加入一句：`Only use entities defined in EcommerceOntology; do not infer new entities.`

### 7.4 集成到 Foundry IQ（可选）

1. 进入 Azure AI Foundry → 创建 Knowledge Source → 类型选 Foundry IQ → 在 OneLake catalog 中选 `EcommerceOntology`。
2. 创建 Knowledge Base → 关联 Knowledge Source。
3. 创建 Foundry Agent → 关联 Knowledge Base → 测试问答。

这一路径的覆盖效果与 Fabric Data Agent 类似，但能套入 Foundry 已有工具链。

### 7.5 集成到 Copilot Studio（可选）

1. 在 Copilot Studio 中创建 Agent → **Tools → + Add tool** → 搜索 `Fabric IQ` → 选 `Fabric IQ MCP (Preview)`。
2. 填入 Workspace ID 与 Ontology ID（§2.4 步骤 7）。
3. 验证 Tools 列表里有 `list_ontology_entity_types` 和 `search_ontology`。
4. 在 Test pane 中跑同样的 N1–N7。

`<!-- APPEND-7 -->` 留位：§8 Operationalization。

---

## 8. Operationalization：低库存预警与 Action

原方案中的“Action Type”（上架、定价、下单、调拨）在 Fabric IQ 当前 Preview 中没有一等公民。PoC 用 **Fabric Activator**（基于 Ontology 业务实体触发）和 **Fabric Operations Agent**（生成 playbook + 推荐动作）来近似。

### 8.1 用 Activator 给 `Inventory.available < alert_threshold` 配规则

1. Ontology item → 顶部 ribbon → **Add and view rules → View rules**。
2. 在 Rules 面板里点 **New rule** → 选 entity type `Inventory` → Activator 设计器打开。
3. 配置触发条件：`inv.available < inv.alert_threshold`。
4. 选择动作：
   - 发送 Teams 通知（推荐 PoC 默认）：填 Webhook URL 或 Teams channel。
   - 触发 Fabric item：启动 Pipeline、Notebook、Dataflow 等，把告警落入业务系统。
   - 触发 User Data Function：自定义代码（参考库存调拨逻辑）。
5. 保存 → Rules 自动生成一个同名 Fabric Activator item。
6. 验证：手动把 §3.3 中某条库存 `available` 改到小于 `alert_threshold`，刷新 Graph 后应收到告警。

> **说明**：Activator 的 condition 设计当前支持时间窗聚合（阈值在时间窗内持续满足才告警），适合“持续低于阈值才报警”的库存场景，避免偶发波动误报。

### 8.2 用 Operations Agent 把业务目标固化为 Playbook

1. Workspace 中新建 **Operations agent (preview)** item → 命名 `InventoryOpsAgent`。
2. 填写：
   - Business goals：`Detect low stock for online SKUs and recommend replenishment to merchants.`
   - Instructions：`When merchant SKU's inventory stays below alert threshold for 5 minutes, recommend NotifyMerchant with parameters merchantId, skuId, currentQty.`
   - Knowledge source：`EcommerceOntology`
   - Actions：定义 `NotifyMerchant(merchantId, skuId, currentQty)`，配 Power Automate flow 发邮件 / Teams 消息。
3. 保存 → **Generate playbook** → 复核 playbook 中提到的 entity type 是否为 `Inventory`、`MerchantSku`。
4. 安装 Fabric Operations Agent Teams app；当 Agent 检测到条件时会在 Teams 推送推荐。
5. 在推送里选择 Yes 批准 → 触发 Power Automate / Fabric item。

### 8.3 验证 A8 动作能力

| 检查 | 期望 |
|---|---|
| Activator 规则触发后 Teams 收到消息 | 是 |
| Power Automate flow 收到 merchantId / skuId 参数 | 是 |
| Operations Agent playbook 中能列出 `Inventory` / `MerchantSku` / `Merchant` 三种实体 | 是 |
| 推荐动作中包含明确的 Action 名（如 `NotifyMerchant`）和参数 | 是 |
| 批准后 Power Automate 执行成功 | 是 |

### 8.4 不要把这些当作完整的 Action Type 治理

Fabric IQ 的 Activator / Operations Agent 是**编排 + 通知**层，不提供：

- Action 的强类型注册中心
- Action 本身的 ontology versioning
- 写回业务系统的 transaction governance

如果业务需要 Action Type schema 治理，请参照 Stardog（参见 `图业界Ontology产品调研与Palantir电商适配分析.md` 中第 3.1 节）。

`<!-- APPEND-8 -->` 留位：§9 角色与权限。

---

## 9. 角色视图与权限验证

原方案 §3.2 中 5 个角色的数据视图在 Fabric IQ 当前 Preview 中没有完整 ABAC。本节给出 PoC 阶段可行的近似做法。

### 9.1 用 Workspace 角色做粗粒度视图

| 角色 | Workspace 角色 | 能看什么 | 不能做什么 |
|---|---|---|---|
| 平台运营 | Workspace Admin | 所有 Ontology、Lakehouse、Graph、Agent、Activator | — |
| 品类经理 | Workspace Contributor | 所有 Ontology + Graph，能修改本品类数据；用 OneLake 数据权限缩窄源表可见性 | 不能修改 Workspace 设置 |
| 品牌方 | Workspace Viewer（通过单独的安全组） | 仅 `Spu` / `SpuTemplate` / `Brand` 等相关 Ontology；用 Lakehouse Row-Level Security 缩窄 brand_id 可见集 | 不能写入 |
| 商家 | Workspace Viewer（通过单独的安全组） | 仅与自己 `merchant_id` 相关的 `MerchantSku` / `Price` / `Inventory`；用 Lakehouse RLS 限制 `merchant_id = currentMerchant` | 不能写入 |
| 消费者 | 通过 Data Agent / Foundry IQ 间接访问 | 只能问不能改 | 不能直接登 Workspace |
| Agent | 通过专用 service principal | 只读 Graph；用 Fabric REST API 走最少权限 | 写权限单独审批 |

### 9.2 给商家实施 Lakehouse RLS

为 `merchant_sku`、`price`、`inventory` 创建视图并加 RLS 函数：

```sql
CREATE OR REPLACE VIEW ontology.v_merchant_sku AS
SELECT * FROM ontology.merchant_sku
WHERE merchant_id = currentMerchant();

ALTER VIEW ontology.v_merchant_sku
SET ROW FILTER ontology.fn_current_merchant_filter ON;

-- 同样为 price / inventory 创建视图；
-- 注意 Data Agent 的数据源可以选择视图，不是必须的；
-- 也可以让 Data Agent 只关联到受控的 Item。
```

`<!-- APPEND-9 -->` 留位：§10 验收清单。

---

## 10. 端到端验收清单

把下面 8 项当作正式 PoC 的“放行条件”。每完成一项在对应行打钩，并把验证截图 / 输出留到 `docs/verifications/`。

| 编号 | 验收点 | 通过标准 | 负责人 |
|---|---|---|---|
| A1 | Ontology 中存在 13 个 Entity Type | 13 个 Entity Type 全部显示在 Home configuration canvas | |
| A1 | Entity Type 都能在 Instances 标签下看到实例 | 实例数量 = 源表行数 | |
| A2 | 16 个 Relationship Type 全部创建成功 | 配置 canvas 全部出现，无红字警告 | |
| A2 | Graph tile 中看到节点和边 | 至少 3 个节点类型可见 | |
| A3 | Template → ObjectType 关系显式可见 | SpuTemplate → Spu 用 `SpuUsesTemplate` 关联；SKU 模板继承 SPU 模板 | |
| A4 | 每张源表都被绑定到至少一个 Entity / Relationship | binding 列表中无 unbound warning | |
| A5 | Q1 与 Q6 验证品类继承 | 返回 ROOT → CAT_IPHONE 路径 | |
| A6 | Q3 验证 SKU → 商家 → 价格/库存多跳 | 至少 1 行，覆盖 5 个 Entity Type | |
| A7 | Data Agent 答对 N1–N7 中至少 6 题 | 引用 Ontology 实体名 | |
| A8 | Activator 规则触发 Teams 通知 | 收到包含 sku_id / qty 的告警 | |

### 10.1 失败兜底

| 现象 | 兜底动作 |
|---|---|
| Entity Type Key mapping 红字 | 检查 mapping table 是否同时含有 origin 和 target 主键；确认列没有特殊字符 |
| Graph 刷新超时（>20 分钟） | 缩减 mapping table 的列数；删掉示例数据；分批绑定 |
| Agent 答非所问 | 把系统提示语加入 “Only use EcommerceOntology entities”；重新生成 playbook |
| Activator 收不到通知 | 确认 channel Webhook URL 有效；用 Power Automate 测试一次流程 |
| 找不到 Ontology item 类型 | 让 Fabric 管理员开启 §2.1 的 Tenant 设置 |
| Lakehouse 表无法被绑定 | 取消 OneLake Security；改名去掉 `,;{}()=\n\t` 与空格 |

### 10.2 与原方案的 8 条能力诉求对账

| 原方案能力诉求 | 落地路径 | 验收编号 |
|---|---|---|
| A1 ObjectType 一等公民 | Ontology Entity Type | A1 |
| A2 LinkType 一等公民 + 边属性 | Relationship Type + MerchantSku 沉淀 linkProperties | A2 |
| A3 Template → ObjectType 双层 | SpuTemplate / SkuTemplate 实体 + 关系 | A3 |
| A4 Backing Datasource | OneLake Lakehouse 表绑定 | A4 |
| A5 品类引用模板与属性声明 | CategoryUsesTemplate + SpuTemplateDefinesAttribute（V4 路线 B，已删除 DECLARES_ATTRIBUTE） | A5 |
| A6 Action Type / 写回 | Activator + Operations Agent（业务级，不是 schema 注册中心） | A8 |
| A7 细粒度权限 | Workspace 角色 + Lakehouse RLS | §9 |
| A8 Agent / GraphRAG | Fabric Data Agent + Foundry IQ / Copilot Studio 集成 | A7 |

`<!-- APPEND-10 -->` 留位：附录。

---

## 附录 A. 一图看懂 PoC 资源依赖

```text
                  ┌──────────────────────────────────────┐
                  │  Workspace (Fabric capacity)         │
                  │  ──────────────────────────────────  │
                  │   Lakehouse   EcommerceOntologyLH    │
                  │   Notebook    EcommerceOntology…     │
                  │   Ontology    EcommerceOntology      │
                  │      └── managed Graph item (auto)   │
                  │   Graph item  EcommerceGraph         │
                  │   Data agent EcommerceOntologyAgent  │
                  │   Ops agent   InventoryOpsAgent      │
                  │   Activator   InventoryLowStock      │
                  │   Power Auto  NotifyMerchant flow    │
                  └──────────────────────────────────────┘
                                ▲          ▲
                                │          │
                                │          │
            Fabric tenant settings          Data Agent
            (Admin Portal)                  / Foundry IQ
                                            / Copilot Studio
```

## 附录 B. 把原方案 LinkType → Fabric IQ Relationship Type 的对照清单

> **V4 路线 B 重要变更**：`DECLARES_ATTRIBUTE` 已从 Palantir V4 中删除，Fabric 中对应 Relationship（`CategoryDeclaresAttribute`）与 `category_attribute` 表亦已移除。属性声明路径改为：`USES_TEMPLATE → SpuTemplate → SpuTemplateDefinesAttribute`。

| 原方案 LinkType | Fabric IQ 落地 | 关系属性如何承载 |
|---|---|---|
| PARENT_OF | `CategoryParentOf` 自连接 | `rank` 等若需承载，新增 `category_category_extra` 表 |
| BELONGS_TO_CATEGORY | `SpuBelongsToCategory` + 后续可加 `BELONGS_TO_CATEGORY` 二级关系 | 主品类 vs 关联品类用单独关系 + `isPrimary` 属性 |
| HAS_BRAND | `SpuHasBrand` | 关系属性足够表达 |
| GENERATES | `SpuGeneratesSku` | 把 `combination_key` 落地为 `Sku.salesAttrsHash` |
| HAS_ATTR_VALUE | `SkuHasAttributeValue` | 直接承载在桥接表 `sku_attribute_value` |
| SOLD_BY | 拆为 `MerchantSkuIsSoldByMerchant` + `SkuListedAsMerchantSku` | linkProperties 沉淀到 `MerchantSku`（merchant_sku_id / status / listing_time） |
| HAS_PRICE | `MerchantSkuHoldsPrice` | `Price` 实体加 `priceType` / `amount` |
| HOLDS_INVENTORY | `MerchantSkuHoldsInventory` | `Inventory` 实体加 `available` / `reserved` |
| LOCATED_AT | `InventoryLocatedAtWarehouse` | 直接关系；后续可加 `WarehouseOwnsInventory` 反向 |

## 附录 C. 异常情况的诊断路径

1. **看不到 Ontology item**：检查 §2.1 的 Tenant 设置，并确认登录的账号在 Fabric capacity 范围内。
2. **看不到 Graph item**：刷新 Graph：Workspace → 自动生成的 Graph 子项 → **... → Schedule → Refresh now**；在 Monitoring hub 中跟踪 Graph refresh job。
3. **Data Agent 答错**：在 Data Agent 顶部点 **Agent instructions** 把系统提示改写，加入“只使用 EcommerceOntology 实体”字样。
4. **Activator 规则触发后没动作**：先确认 Teams channel 或 Webhook URL 仍有效；在 Activator 的 Run history 中查看 trigger 时间。
5. **Operations Agent 没有产生推荐**：检查 Business goals 是否包含数值指标；Operations Agent 依赖更新 Graph 模型，先做 §5.5 的刷新。

## 附录 D. 参考资料

| 资源 | 链接（2026-07-26 访问） |
|---|---|
| What is Fabric IQ? | https://learn.microsoft.com/en-us/fabric/iq/overview |
| What is ontology (preview)? | https://learn.microsoft.com/en-us/fabric/iq/ontology/overview |
| Create entity types | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-entity-types |
| Bind data | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-bind-data |
| Add relationship types | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-relationship-types |
| View entity type details | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-view-entity-type-details |
| Ontology (preview) glossary | https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-glossary |
| Ontology (preview) FAQ | https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-frequently-asked-questions |
| Ontology (preview) troubleshooting | https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-troubleshooting |
| Required tenant settings for ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/overview-tenant-settings |
| Generate ontology from a semantic model | https://learn.microsoft.com/en-us/fabric/iq/ontology/concepts-generate |
| Capacity consumption for ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-capacity-usage |
| Add rules (Fabric Activator) | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-use-rules |
| Create operations agent connected to ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-operations-agent |
| Create ontology agent with Foundry IQ | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-agent-foundry-iq |
| Create ontology agent with Copilot Studio | https://learn.microsoft.com/en-us/fabric/iq/ontology/how-to-create-agent-copilot-studio |
| Tutorial Part 0: Introduction and environment setup | https://learn.microsoft.com/en-us/fabric/iq/ontology/tutorial-0-introduction |
| Tutorial Part 1: Create an ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/tutorial-1-create-ontology |
| Tutorial Part 2: Enrich the ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/tutorial-2-enrich-ontology |
| Tutorial Part 3: Preview the ontology | https://learn.microsoft.com/en-us/fabric/iq/ontology/tutorial-3-preview-ontology |
| Tutorial Part 4: Consume ontology from agents | https://learn.microsoft.com/en-us/fabric/iq/ontology/tutorial-4-create-data-agent |
| What is Fabric Activator? | https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction |
| What is graph in Microsoft Fabric? | https://learn.microsoft.com/en-us/fabric/graph/overview |
| Graph data models | https://learn.microsoft.com/en-us/fabric/graph/graph-data-models |
| Quickstart: Create your first graph | https://learn.microsoft.com/en-us/fabric/graph/quickstart |
| GQL language guide for graph in Microsoft Fabric | https://learn.microsoft.com/en-us/fabric/graph/gql-language-guide |
| Write graph pattern queries | https://learn.microsoft.com/en-us/fabric/graph/write-graph-pattern-queries |
| Tutorial: Query the graph with GQL | https://learn.microsoft.com/en-us/fabric/graph/tutorial-query-code-editor |
| Monitor graph performance | https://learn.microsoft.com/en-us/fabric/graph/monitor-graph-performance |
| 原方案：基于 Palantir 范式的电商产品语义建模方案 | `./Palantir范式电商语义建模方案.md` |
| 调研：图业界 Ontology 产品调研与 Palantir 电商适配分析 | `./图业界Ontology产品调研与Palantir电商适配分析.md` |

## 附录 E. 变更记录

| 版本 | 日期 | 主要变更 |
|---|---|---|
| v2.0 | 2026-07-27 | 与 Palantir V4.1（路线 B Template-Centric）同步：① 删除 `DECLARES_ATTRIBUTE` 相关设计（`category_attribute` 表、`CategoryDeclaresAttribute` Relationship）；② `attribute` 表删除 `is_sales_attr` / `is_inheritable` / `is_required` 字段；③ `attribute_value` 表新增 `display_meta`（color_hex / image_url / extra_data）；④ §5.1 Relationship 表新增 `CategoryUsesTemplate`（#6）并补全说明；⑤ `spu_template_attribute` / `sku_template_attribute` 字段改为 `scope`（required/optional/sales）；⑥ 附录 B 删除 `DECLARES_ATTRIBUTE` 行并添加 V4 说明；⑦ 文档头、§1.2 取舍表、§3.1/§3.2/§3.3/§4.2 均已同步更新。 |
| v1.0 | 2026-07-26 | 初始版：基于 Fabric IQ Ontology（Preview）+ Lakehouse + Graph + Data Agent + Activator，给出端到端 PoC 操作步骤；将原方案 Palantir 风格的 ObjectType/LinkType 映射为 Entity Type / Relationship Type，并以 MerchantSku 桥接实体承载原 SOLD_BY 的 linkProperties。 |

---

*文档结束*
