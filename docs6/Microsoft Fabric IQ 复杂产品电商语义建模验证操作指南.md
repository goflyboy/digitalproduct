# Microsoft Fabric IQ 电商语义建模验证操作指南

> **文档版本**: v1.0
> **创建时间**: 2026-07-27
> **核心主题**: 在 Microsoft Fabric IQ 中验证复杂产品/电商语义模型（基于 docs3 框架 + docs4 SPU/SKU 概念）
> **关联文档**:
> - `docs3/复杂产品配置器的数据模型.md`（复杂产品配置器数据模型 v1.1）
> - `docs4/Palantir范式电商语义建模方案.md`（电商语义模型 v1.0）
> - `docs/Microsoft Fabric IQ 电商语义建模验证操作指南.md`（v2.0，原始版）

---

## 1. 先看结论：这次验证要证明什么

docs3（复杂产品）和 docs4（电商）的核心概念可以在 Fabric IQ Ontology 中找到直接映射。本指南验证 8 个核心能力：

| 验收编号 | docs3/4 能力 | Fabric IQ 验证结果 |
|---------|-------------|-------------------|
| S1 | SpecDefinition 属性类型定义 | Ontology 中 Entity Type 有 Property，绑定 OneLake 表后自动承载 SpecValue |
| S2 | ProductClass / SPU 自身有规格值 | ProductClass / SPU Entity 可以有自己的 Property Values（如 FormFactor=2U） |
| S3 | Parameter 定义（无 Part 值） | Parameter 定义在 Entity Type 上，Part / SKU 上无 Parameter 值 |
| R1 | offersPart 边属性裁剪 | Relationship Type + 映射表承载 enabled/defaultSelected/minQty 等属性 |
| R2 | realizes 关系 | Relationship Type 映射 ProductInstance → ProductClass 或 MerchantSKU → SPU |
| R3 | parentOf 自连接 | Relationship Type 自连接映射 Category 品类树 |
| A1 | Agent 消费 | Fabric Data Agent 用业务术语回答配置/选品问题 |
| A2 | Action / 运营配置 | Activator 触发低库存预警或配置变更通知 |

### 1.1 建模概念对照（docs3/4 → Fabric IQ）

| docs3 概念 | docs4 概念 | Fabric IQ 对位 | 说明 |
|------------|------------|--------------|------|
| ProductClassType | SPUType | Entity Type | 产品类/标准产品单元 |
| PartClassType | CategoryType | Entity Type | 部件分类/品类分类 |
| SpecDefinition | SpecDefinition | Entity Type Property | 规格定义（属性类型） |
| SpecValue | SPUSpecValue / SKUAttributeValue | Entity Instance Property Values | 规格值（实例属性） |
| Parameter | Parameter | Configurable Property / Rule Parameter | 参数（可配置属性） |
| ProductClass | SPU | Entity Instance | 产品类实例 |
| Part | SKU | Entity Instance | 部件实例（SKU） |
| ProductInstance | MerchantSKU | Entity Instance + Relationship | 可售产品实例 |
| offersPart 边 | offers 边 | Relationship Type + 映射表属性 | 裁剪边 |
| realizes 关系 | realizes 关系 | Relationship Type | 实例化关系 |
| Configuration | MerchantConfiguration | Entity Instance | 配置方案 |

### 1.2 推荐验证顺序

```
数据准备 → Ontology 骨架 → SpecDefinition → SpecValue → Parameter
    → offersPart 裁剪 → realizes 关系 → Agent → Activator → 权限验证
```

---

## 2. 前置条件与环境检查

### 2.1 必备资源与角色

| 资源 | 是否必须 | 说明 |
|------|---------|------|
| Microsoft Fabric 租户 | 是 | 需要 Fabric-enabled capacity（F2 或更高） |
| Workspace（不是 My workspace） | 是 | 所有 Ontology 资源必须放在普通 Workspace |
| Capacity | 是 | 试用版可在 `https://app.fabric.microsoft.com` 申请 |
| Tenant 设置 | 是 | 由 Fabric 管理员在 Admin Portal 中开启 |
| 数据源 | 是 | OneLake managed Lakehouse 表 |

Tenant 设置（在 Admin Portal → Tenant settings）：

1. **Enable Ontology item (preview)**
2. **Users can use Copilot and other features powered by Azure OpenAI**
3. **Data sent to Azure OpenAI can be processed outside your capacity's geographic region**
4. **Data sent to Azure OpenAI can be stored outside your capacity's geographic region**

### 2.2 一次性环境就绪清单

```
[ ] 1. 拿到 Fabric 租户管理员，开通 §2.1 的 Tenant 设置
[ ] 2. 在 Fabric Portal 创建一个普通 Workspace，绑定到 Fabric capacity
[ ] 3. 在 Workspace 中新建一个 Lakehouse，命名：DigitalProductLH
[ ] 4. 在 Lakehouse 中创建一个 schema，命名：ontology
[ ] 5. 准备一个 Notebook，命名：DigitalProductBootstrap，用于创建所有 OneLake 表
[ ] 6. 在 Workspace 中创建 Ontology (preview) item，命名：DigitalProductOntology
[ ] 7. 在 Workspace 中创建 Graph item，命名：DigitalProductGraph
```

---

## 3. 把 docs3/4 设计转换为 OneLake 表

### 3.1 表清单（复杂产品 + 电商双场景）

#### 复杂产品场景（对应 docs3）

| 表名 | 对应 docs3 | OneLake schema | 用途 |
|------|-----------|---------------|------|
| `product_class` | ProductClass | ontology | 产品类（带 SpecValue，如 FormFactor=2U） |
| `part_class` | PartClass | ontology | 部件分类 |
| `part` | Part | ontology | 部件实例 |
| `spec_value` | SpecValue | ontology | 规格值（挂在 ProductClass 或 Part 上） |
| `spec_def` | SpecDefinition | ontology | 规格定义 |
| `param_def` | Parameter | ontology | 参数定义 |
| `product_instance` | ProductInstance | ontology | 可售产品实例 |
| `offers_part` | offersPart 边 | ontology | 裁剪边（enabled/default/minQty/maxQty） |

#### 电商场景（对应 docs4）

| 表名 | 对应 docs4 | OneLake schema | 用途 |
|------|-----------|---------------|------|
| `category` | Category | ontology | 品类树 |
| `spu` | SPU | ontology | 标准产品单元（带 SpecValue） |
| `sku` | SKU | ontology | 最小可售单元 |
| `sku_attr_value` | SKUAttributeValue | ontology | SKU 属性值（等价 SpecValue） |
| `merchant` | Merchant | ontology | 商家（带 SpecValue） |
| `merchant_sku` | MerchantSKU | ontology | 商家 SKU（对标 ProductInstance） |
| `offers_sku` | offers 边 | ontology | 商家 SKU 的 SKU 裁剪边 |

### 3.2 复杂产品场景表结构

#### ProductClass（产品类，带自身 SpecValue）

```sql
CREATE SCHEMA IF NOT EXISTS ontology;
USE SCHEMA ontology;

-- 产品类（带规格值，如 FormFactor=2U）
CREATE TABLE IF NOT EXISTS product_class (
    product_class_id   STRING  NOT NULL,
    code              STRING  NOT NULL,
    name              STRING  NOT NULL,
    version           STRING  NOT NULL,
    status            STRING,
    -- 产品类规格值（ProductClass 自身也有 SpecValue）
    form_factor       STRING,  -- 如 1U, 2U, 4U
    power_supply      STRING,  -- 如 SINGLE, DUAL
    PRIMARY KEY (product_class_id) DISABLE NOVALIDATE
) USING DELTA;

-- 规格定义（对应 docs3 的 SpecDefinition）
CREATE TABLE IF NOT EXISTS spec_def (
    spec_id           STRING  NOT NULL,
    spec_code         STRING  NOT NULL,
    spec_name         STRING  NOT NULL,
    defined_on_type    STRING  NOT NULL,  -- 'product_class' / 'part_class'
    data_type         STRING  NOT NULL,
    unit              STRING,
    value_domain      STRING,
    required          BOOLEAN,
    PRIMARY KEY (spec_id) DISABLE NOVALIDATE
) USING DELTA;

-- 规格值（挂在 ProductClass 或 Part 上）
CREATE TABLE IF NOT EXISTS spec_value (
    spec_value_id     STRING  NOT NULL,
    owner_type        STRING  NOT NULL,  -- 'product_class' / 'part'
    owner_id          STRING  NOT NULL,
    spec_code         STRING  NOT NULL,
    value             STRING  NOT NULL,
    unit              STRING,
    PRIMARY KEY (spec_value_id) DISABLE NOVALIDATE
) USING DELTA;

-- 参数定义（对应 docs3 的 Parameter）
CREATE TABLE IF NOT EXISTS param_def (
    param_id          STRING  NOT NULL,
    param_code        STRING  NOT NULL,
    param_name       STRING  NOT NULL,
    defined_on_type   STRING  NOT NULL,  -- 'product_class' / 'part_class'
    data_type         STRING  NOT NULL,
    unit              STRING,
    min_value         STRING,
    max_value         STRING,
    default_value     STRING,
    assign_type       STRING,  -- 'INPUT' / 'CALCULATED' / 'AGGREGATE'
    description       STRING,
    PRIMARY KEY (param_id) DISABLE NOVALIDATE
) USING DELTA;

-- 部件分类
CREATE TABLE IF NOT EXISTS part_class (
    part_class_id     STRING  NOT NULL,
    code              STRING  NOT NULL,
    name              STRING  NOT NULL,
    product_class_id  STRING  NOT NULL,
    selection_policy  STRING,  -- 'REQUIRED' / 'OPTIONAL'
    min_qty           INT,
    max_qty           INT,
    multi_instance    BOOLEAN,
    PRIMARY KEY (part_class_id) DISABLE NOVALIDATE
) USING DELTA;

-- 部件
CREATE TABLE IF NOT EXISTS part (
    part_id           STRING  NOT NULL,
    code              STRING  NOT NULL,
    name              STRING  NOT NULL,
    part_class_id     STRING  NOT NULL,
    status            STRING,
    price             DECIMAL(18,2),
    PRIMARY KEY (part_id) DISABLE NOVALIDATE
) USING DELTA;

-- 可售产品实例（ProductInstance 自带 version）
CREATE TABLE IF NOT EXISTS product_instance (
    instance_id       STRING  NOT NULL,
    code              STRING  NOT NULL,
    name              STRING  NOT NULL,
    version           STRING  NOT NULL,
    product_class_id  STRING  NOT NULL,
    market            STRING,
    status            STRING,
    positioning       STRING,
    PRIMARY KEY (instance_id) DISABLE NOVALIDATE
) USING DELTA;

-- offersPart 裁剪边（enabled/defaultSelected/minQty/maxQty/fixed）
CREATE TABLE IF NOT EXISTS offers_part (
    instance_id       STRING  NOT NULL,
    part_id           STRING  NOT NULL,
    enabled           BOOLEAN NOT NULL DEFAULT true,
    default_selected  BOOLEAN NOT NULL DEFAULT false,
    min_qty           INT     NOT NULL DEFAULT 0,
    max_qty           INT     NOT NULL DEFAULT 9999,
    fixed             BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (instance_id, part_id) DISABLE NOVALIDATE
) USING DELTA;
```

### 3.3 电商场景表结构

```sql
-- 品类树（parentOf 自连接）
CREATE TABLE IF NOT EXISTS category (
    category_id      STRING  NOT NULL,
    category_name    STRING  NOT NULL,
    parent_id        STRING,
    category_level   INT,
    category_path    STRING,
    status           STRING,
    PRIMARY KEY (category_id) DISABLE NOVALIDATE
) USING DELTA;

-- SPU（标准产品单元，带自身 SpecValue）
CREATE TABLE IF NOT EXISTS spu (
    spu_id           STRING  NOT NULL,
    code             STRING  NOT NULL,
    name             STRING  NOT NULL,
    version          STRING  NOT NULL,
    category_id      STRING,
    brand            STRING,
    -- SPU 规格值（自身固有的物理属性）
    chip_model       STRING,
    screen_size      DECIMAL(5,1),
    battery_capacity INT,
    status           STRING,
    PRIMARY KEY (spu_id) DISABLE NOVALIDATE
) USING DELTA;

-- SKU（最小可售单元）
CREATE TABLE IF NOT EXISTS sku (
    sku_id           STRING  NOT NULL,
    code             STRING  NOT NULL,
    name             STRING  NOT NULL,
    spu_id           STRING  NOT NULL,
    status           STRING,
    PRIMARY KEY (sku_id) DISABLE NOVALIDATE
) USING DELTA;

-- SKU 属性值（等价于 Part 的 SpecValue）
CREATE TABLE IF NOT EXISTS sku_attr_value (
    sku_id           STRING  NOT NULL,
    attr_code        STRING  NOT NULL,
    attr_name        STRING  NOT NULL,
    value            STRING  NOT NULL,
    -- 对应 docs4 的 Parameter 定义在 SKU 上
    param_value      STRING,  -- SKU 无 Parameter 值，但可记录计算结果
    PRIMARY KEY (sku_id, attr_code) DISABLE NOVALIDATE
) USING DELTA;

-- 商家（带自身 SpecValue）
CREATE TABLE IF NOT EXISTS merchant (
    merchant_id      STRING  NOT NULL,
    code             STRING  NOT NULL,
    name             STRING  NOT NULL,
    version          STRING  NOT NULL,
    merchant_type    STRING,
    merchant_grade   STRING,
    -- 商家规格值
    status           STRING,
    PRIMARY KEY (merchant_id) DISABLE NOVALIDATE
) USING DELTA;

-- 商家 SKU（对标 ProductInstance，MerchantSKU 自带 version）
CREATE TABLE IF NOT EXISTS merchant_sku (
    msku_id          STRING  NOT NULL,
    code             STRING  NOT NULL,
    name             STRING  NOT NULL,
    version          STRING  NOT NULL,
    spu_id           STRING  NOT NULL,
    merchant_id      STRING  NOT NULL,
    status           STRING,
    PRIMARY KEY (msku_id) DISABLE NOVALIDATE
) USING DELTA;

-- offers SKU 裁剪边（enabled/defaultSelected/minPrice/maxPrice/fixed）
CREATE TABLE IF NOT EXISTS offers_sku (
    msku_id          STRING  NOT NULL,
    sku_id           STRING  NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT true,
    default_selected BOOLEAN NOT NULL DEFAULT false,
    min_price        DECIMAL(18,2),
    max_price        DECIMAL(18,2),
    fixed            BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (msku_id, sku_id) DISABLE NOVALIDATE
) USING DELTA;
```

### 3.4 样例数据

```sql
-- 复杂产品：产品类（ProductClass，带自身规格值）
INSERT INTO product_class VALUES
('PC_SERVER_X86', 'SERVER_X86', 'X86服务器平台', '1.0.0', 'PUBLISHED', '2U', 'DUAL');

-- 规格定义（SpecDefinition）
INSERT INTO spec_def VALUES
('SD_FORM_FACTOR', 'FormFactor', '外形规格', 'product_class', 'STRING', 'U', '1U,2U,4U', true),
('SD_POWER_SUPPLY', 'PowerSupply', '电源类型', 'product_class', 'STRING', '-', 'SINGLE,DUAL', true),
('SD_CORE_NUM', 'CoreNum', '核心数', 'part_class', 'INTEGER', 'core', '2,4,8,18', true),
('SD_CAPACITY', 'Capacity', '容量', 'part_class', 'INTEGER', 'TB', '1,2,3,6,9', true);

-- 参数定义（Parameter）
INSERT INTO param_def VALUES
('PD_SUM_CAPACITY', 'Sum_Capacity', '硬盘总容量需求', 'part_class', 'INTEGER', 'TB', '0', '100', null, 'AGGREGATE', '客户要求的硬盘总容量下限'),
('PD_QUANTITY', 'Quantity', '硬盘数量需求', 'part_class', 'INTEGER', '块', '0', '100', null, 'INPUT', '客户要求的硬盘总数量');

-- 部件（Part，带规格值）
INSERT INTO part VALUES
('P_CPU1', 'cpu1', 'CPU-2核', 'PC_CPU', 'ACTIVE', 100),
('P_CPU2', 'cpu2', 'CPU-4核', 'PC_CPU', 'ACTIVE', 200),
('P_SD1', 'sd1', '固态硬盘-3TB', 'PC_DRIVE', 'ACTIVE', 50),
('P_MD1', 'md1', '机械硬盘-1TB', 'PC_DRIVE', 'ACTIVE', 30);

-- 规格值（挂在 Part 上）
INSERT INTO spec_value VALUES
('SV_CPU1_CORE', 'part', 'P_CPU1', 'CoreNum', '2', 'core'),
('SV_CPU1_MEM', 'part', 'P_CPU1', 'Memory', '123', 'GB'),
('SV_SD1_CAP', 'part', 'P_SD1', 'Capacity', '3', 'TB'),
('SV_SD1_TYPE', 'part', 'P_SD1', 'Type', 'sd', '-'),
('SV_MD1_CAP', 'part', 'P_MD1', 'Capacity', '1', 'TB'),
('SV_MD1_TYPE', 'part', 'P_MD1', 'Type', 'md', '-');

-- 产品实例（ProductInstance 自带 version）
INSERT INTO product_instance VALUES
('PI_S1110', 'S1110', 'X86服务器S1110低端型', '1.0.0', 'PC_SERVER_X86', 'CN', 'PUBLISHED', '低端通用场景'),
('PI_S22', 'S22', 'X86服务器S22高端型', '1.0.0', 'PC_SERVER_X86', 'CN/Global', 'PUBLISHED', '高端计算与存储');

-- offersPart 裁剪边
INSERT INTO offers_part VALUES
('PI_S1110', 'P_CPU1', true,  true,  1, 1,  false),  -- 低端默认用 cpu1
('PI_S1110', 'P_CPU2', true,  false, 0, 2,  false),  -- cpu2 可选
('PI_S1110', 'P_SD1',  true,  false, 0, 2,  false),  -- 固态可选
('PI_S1110', 'P_MD1',  true,  true,  1, 8,  false);  -- 机械硬盘默认
INSERT INTO offers_part VALUES
('PI_S22',    'P_CPU2',  true,  false, 0, 2,  false),  -- 高端用 cpu2/3/4
('PI_S22',    'P_CPU3',  true,  true,  1, 1,  false),  -- 高端默认 cpu3
('PI_S22',    'P_SD1',  false, false, 0, 0,  false),   -- 高端禁用固态
('PI_S22',    'P_MD1',  false, false, 0, 0,  false);  -- 高端禁用机械

-- 电商：品类树
INSERT INTO category VALUES
('CAT_ROOT',     '根品类',      NULL,       0, '/ROOT',     'active'),
('CAT_DIGITAL',  '手机数码',    'CAT_ROOT',  1, '/ROOT/DIGITAL', 'active'),
('CAT_PHONE',    '手机',       'CAT_DIGITAL',2, '/ROOT/DIGITAL/PHONE', 'active'),
('CAT_IPHONE',   'iPhone',    'CAT_PHONE',  3, '/ROOT/DIGITAL/PHONE/IPHONE', 'active');

-- SPU（带自身规格值）
INSERT INTO spu VALUES
('SPU_IP16', 'SPU_IP16', 'Apple iPhone 16', '1.0.0', 'CAT_IPHONE', 'BR_APPLE', 'A18', 6.1, 3561, 'ACTIVE');

-- SKU
INSERT INTO sku VALUES
('SKU_IP16_256_BLACK', 'SKU_IP16_256_BLACK', 'iPhone 16 256GB 黑色', 'SPU_IP16', 'ACTIVE'),
('SKU_IP16_512_TITAN', 'SKU_IP16_512_TITAN', 'iPhone 16 512GB 钛色', 'SPU_IP16', 'ACTIVE');

-- SKU 属性值
INSERT INTO sku_attr_value VALUES
('SKU_IP16_256_BLACK', 'Color',     '颜色', '黑色', null),
('SKU_IP16_256_BLACK', 'Capacity',  '容量', '256GB', null),
('SKU_IP16_512_TITAN', 'Color',     '颜色', '钛色', null),
('SKU_IP16_512_TITAN', 'Capacity',  '容量', '512GB', null);

-- 商家
INSERT INTO merchant VALUES
('MERCH_DXY', 'MERCH_DXY', '店小二旗舰店', '1.0.0', 'third_party', 'flagship', 'ACTIVE');

-- 商家 SKU
INSERT INTO merchant_sku VALUES
('MSKU_DXY_IP16', 'MSKU_DXY_IP16', '店小二-iPhone16', '1.0.0', 'SPU_IP16', 'MERCH_DXY', 'ACTIVE');

-- offers SKU 裁剪边
INSERT INTO offers_sku VALUES
('MSKU_DXY_IP16', 'SKU_IP16_256_BLACK', true,  true,  6299, 7499, false),  -- 默认展示
('MSKU_DXY_IP16', 'SKU_IP16_512_TITAN', true,  false, 8299, 9999, false);  -- 可选
```

---

## 4. 创建 Ontology（Entity Type + Property）

### 4.1 复杂产品场景 Entity Type

| # | Entity Type 名 | Entity Type Key | 主要 Property | 绑定表 |
|---|--------------|----------------|-------------|--------|
| 1 | `ProductClass` | `productClassId` | `productClassId`, `code`, `name`, `version`, `status`, `formFactor`, `powerSupply` | `ontology.product_class` |
| 2 | `SpecDef` | `specId` | `specId`, `specCode`, `specName`, `definedOnType`, `dataType`, `unit`, `valueDomain`, `required` | `ontology.spec_def` |
| 3 | `SpecValue` | `specValueId` | `specValueId`, `ownerType`, `ownerId`, `specCode`, `value`, `unit` | `ontology.spec_value` |
| 4 | `ParamDef` | `paramId` | `paramId`, `paramCode`, `paramName`, `definedOnType`, `dataType`, `unit`, `minValue`, `maxValue`, `assignType` | `ontology.param_def` |
| 5 | `PartClass` | `partClassId` | `partClassId`, `code`, `name`, `productClassId`, `selectionPolicy`, `minQty`, `maxQty`, `multiInstance` | `ontology.part_class` |
| 6 | `Part` | `partId` | `partId`, `code`, `name`, `partClassId`, `status`, `price` | `ontology.part` |
| 7 | `ProductInstance` | `instanceId` | `instanceId`, `code`, `name`, `version`, `productClassId`, `market`, `status`, `positioning` | `ontology.product_instance` |

### 4.2 电商场景 Entity Type

| # | Entity Type 名 | Entity Type Key | 主要 Property | 绑定表 |
|---|--------------|----------------|-------------|--------|
| 1 | `Category` | `categoryId` | `categoryId`, `categoryName`, `parentId`, `categoryLevel`, `categoryPath`, `status` | `ontology.category` |
| 2 | `SPU` | `spuId` | `spuId`, `code`, `name`, `version`, `categoryId`, `brand`, `chipModel`, `screenSize`, `batteryCapacity`, `status` | `ontology.spu` |
| 3 | `SKU` | `skuId` | `skuId`, `code`, `name`, `spuId`, `status` | `ontology.sku` |
| 4 | `SKUAttrValue` | `skuAttrValueId` | `skuAttrValueId`, `skuId`, `attrCode`, `attrName`, `value`, `paramValue` | `ontology.sku_attr_value` |
| 5 | `Merchant` | `merchantId` | `merchantId`, `code`, `name`, `version`, `merchantType`, `merchantGrade`, `status` | `ontology.merchant` |
| 6 | `MerchantSKU` | `mskuId` | `mskuId`, `code`, `name`, `version`, `spuId`, `merchantId`, `status` | `ontology.merchant_sku` |

### 4.3 SpecDefinition 绑定说明

**关键概念**：docs3/4 中 SpecDefinition 定义在 PartClassType / ProductClassType 上，SpecValue 挂在 ProductClass 或 Part 上。

Fabric IQ 中的绑定方式：
- `SpecDef` Entity Type：存储规格定义元数据
- `SpecValue` Entity Type：存储规格值，**`ownerType` 字段区分挂在 ProductClass 还是 Part 上**

验证 ProductClass 自身有规格值：查询 `spec_value` 表中 `owner_type = 'product_class'` 的行，应返回 FormFactor=2U 等规格值。

---

## 5. 创建 Relationship Type

### 5.1 复杂产品场景 Relationship

| # | Relationship 名 | Origin | Target | 说明 |
|---|----------------|--------|--------|------|
| 1 | `ProductClassHasPartClass` | `ProductClass` | `PartClass` | 产品类包含部件分类 |
| 2 | `ProductClassHasSpecValue` | `ProductClass` | `SpecValue` | 产品类自身有规格值（关键！） |
| 3 | `PartClassHasSpecDef` | `PartClass` | `SpecDef` | 部件分类有规格定义 |
| 4 | `PartClassHasParamDef` | `PartClass` | `ParamDef` | 部件分类有参数定义 |
| 5 | `PartClassHasPart` | `PartClass` | `Part` | 部件分类包含部件 |
| 6 | `PartHasSpecValue` | `Part` | `SpecValue` | 部件有规格值 |
| 7 | `ProductInstanceRealizes` | `ProductInstance` | `ProductClass` | 实例实现产品类 |
| 8 | `ProductInstanceOffersPart` | `ProductInstance` | `Part` | 裁剪边（需绑定 `offers_part` 表） |

### 5.2 电商场景 Relationship

| # | Relationship 名 | Origin | Target | 说明 |
|---|----------------|--------|--------|------|
| 1 | `CategoryParentOf` | `Category` | `Category` | 品类树自连接 |
| 2 | `SPUBelongsToCategory` | `SPU` | `Category` | SPU 归属品类 |
| 3 | `SPUGeneratesSKU` | `SPU` | `SKU` | SPU 生成 SKU |
| 4 | `SKUHasAttrValue` | `SKU` | `SKUAttrValue` | SKU 有属性值（等价 SpecValue） |
| 5 | `MerchantSKURealizesSPU` | `MerchantSKU` | `SPU` | 商家 SKU 实现 SPU |
| 6 | `MerchantSKUBelongsToMerchant` | `MerchantSKU` | `Merchant` | 商家 SKU 归属商家 |
| 7 | `MerchantSKUOffersSKU` | `MerchantSKU` | `SKU` | 裁剪边（enabled/defaultSelected/minPrice/maxPrice） |

### 5.3 offersPart / offersSKU 裁剪边的实现

这是 docs3/4 的核心语义：**ProductInstance / MerchantSKU 通过 offers 边对 Part / SKU 候选集进行裁剪**，边属性包括 enabled / disabled / defaultSelected / minQty / maxQty / fixed。

在 Fabric IQ 中实现：

1. 创建映射表（如 `offers_part` / `offers_sku`）包含裁剪属性列
2. 创建 Relationship Type（如 `ProductInstanceOffersPart` / `MerchantSKUOffersSKU`）
3. 在 Relationship 配置中，把 enabled / defaultSelected / minQty 等字段映射为 Relationship 的 Property

```sql
-- offersPart 映射表（已在 §3.2 创建）
-- 关键字段：enabled, default_selected, min_qty, max_qty, fixed
-- 这些字段在 Relationship 配置中成为 Edge Properties
```

> **验证方法**：查询时用 GQL 的边属性过滤 `WHERE r.enabled = true`，验证裁剪语义。

---

## 6. 在 Fabric Graph 中验证

### 6.1 复杂产品场景验证

#### Q1：ProductClass 自身有规格值（验证 S1/S2）

```gql
MATCH (pc:ProductClass WHERE pc.code = 'SERVER_X86')
MATCH (pc)-[:ProductClassHasSpecValue]->(sv:SpecValue)
RETURN pc.code AS product_class,
       sv.specCode AS spec_code,
       sv.value AS value,
       sv.unit AS unit
```

预期返回：FormFactor=2U, PowerSupply=DUAL。

#### Q2：Part 有规格值（验证 S1）

```gql
MATCH (p:Part WHERE p.code = 'sd1')
MATCH (p)-[:PartHasSpecValue]->(sv:SpecValue)
RETURN p.code AS part, sv.specCode AS spec, sv.value AS value
```

#### Q3：offersPart 裁剪边属性（验证 R1）

```gql
MATCH (pi:ProductInstance WHERE pi.code = 'S1110')
MATCH (pi)-[r:ProductInstanceOffersPart]->(p:Part)
WHERE r.enabled = true
RETURN pi.code AS instance,
       p.code AS part,
       r.defaultSelected AS default_selected,
       r.minQty AS min_qty,
       r.maxQty AS max_qty
ORDER BY r.defaultSelected DESC
```

预期：cpu1 选中(默认)，md1 选中(默认)，cpu2 和 sd1 可选。

#### Q4：Parameter 定义在 PartClass 上（验证 S3）

```gql
MATCH (pc:PartClass WHERE pc.code = 'drive')
MATCH (pc)-[:PartClassHasParamDef]->(pd:ParamDef)
RETURN pc.code AS part_class,
       pd.paramCode AS param_code,
       pd.paramName AS param_name,
       pd.assignType AS assign_type
```

预期：Sum_Capacity (AGGREGATE), Quantity (INPUT)。

### 6.2 电商场景验证

#### Q5：品类继承路径（验证 R3）

```gql
MATCH (root:Category WHERE root.categoryId = 'CAT_ROOT')
MATCH path = (root)-[:CategoryParentOf]->{1,3}(c:Category WHERE c.categoryId = 'CAT_IPHONE')
RETURN path, c.categoryId AS leaf_id, c.categoryName AS leaf_name
```

预期：ROOT → 手机数码 → 手机 → iPhone。

#### Q6：SPU 自身有规格值（验证 S2）

```gql
MATCH (spu:SPU WHERE spu.code = 'SPU_IP16')
RETURN spu.code AS spu,
       spu.chipModel AS chip,
       spu.screenSize AS screen,
       spu.batteryCapacity AS battery
```

预期：chip=A18, screen=6.1, battery=3561。

#### Q7：SKU 属性值（验证 S1）

```gql
MATCH (s:SKU WHERE s.code = 'SKU_IP16_256_BLACK')
MATCH (s)-[:SKUHasAttrValue]->(av:SKUAttrValue)
RETURN s.code AS sku, collect(av.attrCode + '=' + av.value) AS attributes
```

预期：Color=黑色, Capacity=256GB。

#### Q8：offersSKU 裁剪边（验证 R1）

```gql
MATCH (msku:MerchantSKU WHERE msku.code = 'MSKU_DXY_IP16')
MATCH (msku)-[r:MerchantSKUOffersSKU]->(s:SKU)
WHERE r.enabled = true
RETURN msku.code AS msku,
       s.code AS sku,
       r.defaultSelected AS default_selected,
       r.minPrice AS min_price,
       r.maxPrice AS max_price
ORDER BY r.defaultSelected DESC
```

预期：SKU_IP16_256_BLACK 为主推(minPrice=6299)，SKU_IP16_512_TITAN 可选(minPrice=8299)。

### 6.3 验收清单

```
[ ] Q1: ProductClass 自身返回 FormFactor=2U, PowerSupply=DUAL
[ ] Q2: Part sd1 返回 Capacity=3, Type=sd
[ ] Q3: S1110 offersPart 返回 cpu1/md1 默认选中, cpu2/sd1 可选
[ ] Q4: drive PartClass 返回 Sum_Capacity(AGGREGATE), Quantity(INPUT)
[ ] Q5: Category 返回 ROOT → 手机数码 → 手机 → iPhone 路径
[ ] Q6: SPU_IP16 返回 chip=A18, screen=6.1, battery=3561
[ ] Q7: SKU_IP16_256_BLACK 返回 Color=黑色, Capacity=256GB
[ ] Q8: MSKU_DXY_IP16 offersSKU 返回 256GB 主推(¥6299), 512GB 可选(¥8299)
```

---

## 7. 用 Fabric Data Agent 验证自然语言消费

### 7.1 验收对话样本

| # | 用户问题 | 期望 Agent 行为 |
|---|---------|----------------|
| N1（复杂产品） | `服务器 S1110 支持哪些 CPU 选项？` | 引用 ProductInstance + Part，返回 cpu1/cpu2 及规格 |
| N2（复杂产品） | `S1110 的硬盘默认配置是什么？` | 引用 offersPart defaultSelected=true，返回 md1 x1 |
| N3（电商） | `iPhone 16 有哪些颜色和容量组合？` | 引用 SPU + SKUAttrValue，返回颜色和容量列表 |
| N4（电商） | `店小二卖哪些 iPhone 16 SKU？` | 引用 MerchantSKU + offersSKU enabled=true，返回 SKU 列表 |
| N5（电商） | `店小二的 iPhone 16 主推款是什么，价格多少？` | 引用 offersSKU defaultSelected=true + minPrice，返回 256GB ¥6299 |

### 7.2 Agent 配置要点

在 Data Agent 的 **Agent instructions** 中加入：

```
Support group by in GQL.
The ontology contains:
- ProductClass with its own SpecValue (e.g., formFactor, powerSupply)
- Part with SpecValue (e.g., CoreNum, Capacity)
- Parameter defined on PartClass (e.g., Sum_Capacity, Quantity) - NOT on Part
- offersPart edge with properties: enabled, defaultSelected, minQty, maxQty, fixed
- MerchantSKU (equivalent to ProductInstance) with its own version
```

---

## 8. 端到端验收清单

| 编号 | 验收点 | 通过标准 | 关联概念 |
|------|--------|---------|---------|
| S1 | Ontology 中 Entity Type 有 Property 绑定 OneLake 表 | 所有 Entity Type 绑定成功 | SpecDefinition |
| S2 | ProductClass / SPU Entity 自身有规格值（formFactor=2U / chipModel=A18） | Q1/Q6 返回规格值 | ProductClass 自身规格值 |
| S3 | Parameter 定义在 Entity Type 上，Part / SKU 上无 Parameter 值 | Q4 返回 ParamDef，Part/SKU 上无 param_value | Parameter |
| R1 | offersPart / offersSKU 边有 enabled/defaultSelected/minQty 等属性 | Q3/Q8 边属性过滤正确 | offersPart 裁剪 |
| R2 | realizes 关系正确映射 | Relationship 类型可见 | realizes 关系 |
| R3 | parentOf 自连接正确 | Q5 返回品类路径 | parentOf 自连接 |
| A1 | Data Agent 答对 N1-N5 中至少 4 题 | 引用正确 Entity/Relationship | Agent 消费 |

---

## 附录 A. docs3/4 概念 → Fabric IQ 完整对照表

| docs3 概念 | docs4 概念 | Fabric IQ Entity Type | Fabric IQ Relationship | 说明 |
|------------|------------|---------------------|---------------------|------|
| ProductClassType | SPUType | Entity Type | - | 产品类/标准产品单元类型 |
| ProductClass | SPU | Entity Instance | - | 产品类实例 |
| SpecDefinition | SpecDefinition | Entity Type Property 或 SpecDef Entity | - | 规格定义 |
| SpecValue（ProductClass） | SPUSpecValue | SpecValue Entity（ownerType='product_class'） | ProductClassHasSpecValue | 产品类自身规格值 |
| SpecValue（Part） | SKUAttributeValue | SpecValue Entity（ownerType='part'）或 SKUAttrValue Entity | PartHasSpecValue | 部件/SKU 的规格值 |
| PartClassType | CategoryType | Entity Type | - | 部件分类/品类类型 |
| PartClass | Category | Entity Instance | - | 部件分类实例 |
| Part | SKU | Entity Instance | - | 部件/SKU 实例 |
| Parameter | Parameter | ParamDef Entity | PartClassHasParamDef | 参数定义 |
| ProductInstance | MerchantSKU | Entity Instance | ProductInstanceRealizes / MerchantSKURealizesSPU | 可售产品实例 |
| offersPart 边 | offers 边 | - | ProductInstanceOffersPart / MerchantSKUOffersSKU | 裁剪边（携带 enabled/defaultSelected/minQty 等） |
| Configuration | MerchantConfiguration | Configuration Entity | - | 配置方案 |
| realizes 关系 | realizes 关系 | - | ProductInstanceRealizes / MerchantSKURealizesSPU | 实例化关系 |
| parentOf 自连接 | parentOf 自连接 | - | CategoryParentOf | 品类树自连接 |

## 附录 B. 参考文档

- `docs3/复杂产品配置器的数据模型.md`（v1.1）
- `docs4/Palantir范式电商语义建模方案.md`（v1.0）
- `docs/Microsoft Fabric IQ 电商语义建模验证操作指南.md`（v2.0，原始版）
- [Microsoft Fabric IQ Ontology Overview](https://learn.microsoft.com/en-us/fabric/iq/ontology/overview)
- [Microsoft Fabric IQ Ontology Glossary](https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-glossary)

---

*文档结束*
