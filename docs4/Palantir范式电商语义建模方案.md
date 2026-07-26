# Palantir 范式电商语义建模方案

> **文档版本**: v1.0（基于复杂产品配置器数据模型 v1.1 框架重写）
> **创建时间**: 2026-07-27
> **适用场景**: 电商平台（手机数码、服饰、美妆等）的本体建模、品类管理、商家运营与商品配置
> **核心参考**:
> - `docs3/复杂产品配置器的数据模型.md`（复杂产品配置器数据模型 v1.1）
> - `docs/电商产品数据模型.md`（电商产品数据模型 v1.0）
> - `docs/图业界Ontology产品调研与Palantir电商适配分析.md`（v1.3，Stardog/Fabric IQ/Neo4j 等调研）

---

## 目录

1. [总体数据模型](#一总体数据模型核心实体及关系)
2. [详细数据案例](#二详细数据案例以手机品类为例)
3. [业务处理流程](#三业务处理流程以手机品类从建模到配置为例)
4. [新模型与现有模型的关系](#四新模型与-现有模型的关系)

---

## 一、总体数据模型（核心实体及关系）

### 1.1 建模边界与核心结论

复杂产品（服务器、工业设备）用 **ProductClass → PartClass → Part** 三层模型，因为核心问题是「部件组合 + 配置约束」。

电商产品（手机数码、服饰、美妆）不同。它的核心问题是：

- 品类由多级 Category 组成（ROOT → 手机数码 → 智能手机 → iPhone）
- SPU 是标准化的产品单元（Apple iPhone 16）
- SKU 是最终可售单元，属性组合决定唯一性（颜色 + 容量 + 版本）
- 商家对同一 SKU 有不同的价格和库存
- 品类经理可配置品类的展示属性、销售属性、继承策略
- 商家可配置自己的运营参数（最低售价、发货时效、推广预算）

因此，电商语义模型同样需要 **规格（Spec）** 与 **参数（Parameter）** 的区分——这与复杂产品配置器的核心概念完全一致，只是领域不同：

| 领域 | SpecDefinition | Parameter | 载体 |
|------|--------------|-----------|------|
| **复杂产品** | CPU 核心数、硬盘容量（Part 固有） | Sum_Capacity >= 5TB（用户输入） | ProductClass / Part |
| **电商** | SPU 屏幕尺寸、品牌国籍（SPU 固有） | SPU 定价区间、SKU 展示优先级（用户输入） | Category / SPU / SKU / Merchant |

### 1.2 电商 vs 复杂产品的概念映射

| 复杂产品概念 | 电商对应概念 | 核心差异 |
|------------|------------|---------|
| ProductClass（产品类） | SPU（标准产品单元） | 电商 SPU 是"标准化产品骨架"，可跨商家 |
| PartClass（部件分类） | Category（品类） | 品类是分类树，PartClass 是配置单元 |
| Part（部件） | SKU（最小可售单元） | SKU 由属性值组合决定唯一性 |
| SpecDefinition | SPU Spec / SKU Spec | SPU 规格 = 共享属性；SKU 规格 = 属性值 |
| SpecValue | SKU 属性值 | SKU 的颜色/容量等是 SpecValue |
| Parameter | Configurable Param | 商家运营参数、品类展示参数 |
| ProductInstance | MerchantSKU（商家 SKU） | 商家视角的"可售产品" |

> **关键洞察**：电商的 **MerchantSKU**（商家对 SKU 的具体报价）本质上等价于复杂产品的 **ProductInstance**——都是「骨架 + 实例化边 + 裁剪」的产物。MerchantSKU 决定商家向哪些 SKU 报价、报什么价，是商家的"可售产品实例"。

### 1.3 三层概念架构图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ L1 业务元模型                                                                 │
│ CategoryType ──hasSpec──> SpecDefinition（品类固有规格：level/name）           │
│ CategoryType ──hasParameter──> Parameter（品类可配置参数：展示优先级/销售政策）  │
│ SPUType ──hasSpec──> SpecDefinition（SPU 固有规格：chip/screen/品牌）          │
│ SPUType ──hasParameter──> Parameter（SPU 可配置参数：定价区间/优先级）        │
│ SKUType ──hasSpec──> SpecDefinition（SKU 属性值：颜色/容量）                  │
│ SKUType ──hasParameter──> Parameter（SKU 可配置参数：展示权重/上下架状态）     │
│ MerchantType ──hasSpec──> SpecDefinition（商家固有规格：merchantType/等级）     │
│ MerchantType ──hasParameter──> Parameter（商家可配置参数：最低售价/发货时效）   │
└─────────────────────────────┬────────────────────────────────────────────────┘
                              │ instantiate
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ L2 业务对象实例                                                               │
│ Category(ROOT/手机/智能/iPhone) ──parentOf──> Category                       │
│ SPU(Apple iPhone 16) ──belongsTo──> Category                               │
│ SPU ──generates──> SKU(iPhone16-256GB-黑色)                                │
│ SKU ──hasAttr──> AttributeValue(颜色=黑色, 容量=256GB)                       │
│ MerchantSKU(iPhone16@店小二) ──realizes──> SPU                               │
│ MerchantSKU ──offers──> SKU (裁剪：enabled/disabled/默认选中/数量边界)         │
└─────────────────────────────┬────────────────────────────────────────────────┘
                              │ configure
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ L3 配置运行实例                                                               │
│ Configuration ──selects──> ConfiguredSKU                                     │
│ Configuration ──input──> ConfiguredParameter                                  │
│ Configuration ──produces──> Price / Inventory / Listing                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 规格与参数的区别（电商视角）

| 维度 | 规格（SpecDefinition） | 参数（Parameter） |
| --- | --- | --- |
| **语义** | 品类/SPU/SKU/商家固有的物理特性或属性值 | 可由品类经理/商家/运营人员配置的输入 |
| **面向角色** | 研发/产品设计定义 | 品类经理/商家/运营使用和理解 |
| **是否可手工输入** | 否，继承 SPU/SKU 的固定值 | 是，可由用户手工输入或修改 |
| **载体有无对应值** | Category/SPU/SKU/Merchant 都有 SpecValue | SKU/MerchantSKU 上无 Parameter 值，参数在配置阶段输入 |
| **举例** | iPhone 16 屏幕 6.1 寸（SPU 规格）、颜色=黑色（SKU 规格值） | SPU 定价区间 ¥5000-¥9000（品类经理输入）、商家最低售价 ¥6000（商家输入） |
| **在模型中的位置** | 定义在 CategoryType/SPUType/SKUType 上，挂在 Category/SPU/SKU 上都有值 | 定义在 CategoryType/SPUType/MerchantType 上，SKU 无值 |
| **用途** | 定义产品/品类/商家的固有属性边界 | 在运营阶段传递配置需求，驱动展示/定价/上下架 |

### 1.5 详细实体关系表

#### L1 业务元模型

| 实体名称 | 英文名 | 定义 | 关键字段 | 关联关系 |
|---------|--------|------|---------|---------|
| **品类类元模型** | CategoryType | 品类分类体系类型，承载品类树和继承策略 | code, name, level, parent_policy | parentOf → CategoryType；hasSpec → SpecDefinition；hasParameter → Parameter |
| **SPU 类元模型** | SPUType | 标准产品单元类型，承载共享属性定义 | code, name, domain, template_id | belongsTo → CategoryType；hasSpec → SpecDefinition；hasParameter → Parameter |
| **SKU 类元模型** | SKUType | 最小可售单元类型，承载属性组合模板 | code, name, attr_combination_policy | realizes → SPUType；hasSpec → SpecDefinition；hasParameter → Parameter |
| **商家类元模型** | MerchantType | 商家主体类型，承载商家运营参数 | code, name, merchant_grade | hasSpec → SpecDefinition；hasParameter → Parameter |
| **规格定义** | SpecDefinition | 品类/SPU/SKU/商家的固有属性定义 | code, name, data_type, unit, value_domain, required | definedOn → CategoryType/SPUType/SKUType/MerchantType |
| **参数定义** | Parameter | 可由品类经理/商家配置的运营参数 | code, name, data_type, unit, min, max, default_value, assign_type | definedOn → CategoryType/SPUType/MerchantType |

#### L2 业务对象实例

| 实体名称 | 英文名 | 定义 | 关键字段 | 关联关系 |
|---------|--------|------|---------|---------|
| **品类** | Category | 品类树节点 | id, code, name, level, parent_id, path, status | N:1 ← Category；1:N → SPU；1:N → SpecValue |
| **品类规格值** | CategorySpecValue | 品类的固有规格属性值 | id, category_id, spec_code, value | N:1 ← Category |
| **SPU** | SPU | 标准产品单元（对标复杂产品的 ProductClass） | id, code, name, category_id, brand_id, status, version | N:1 ← Category；1:N → SKU；1:N → SpecValue |
| **SPU 规格值** | SPUSpecValue | SPU 的固有规格属性值 | id, spu_id, spec_code, value | N:1 ← SPU |
| **SKU** | SKU | 最小可售单元（对标复杂产品的 Part） | id, code, name, spu_id, sales_attrs_hash, status | N:1 ← SPU；1:N → AttributeValue |
| **SKU 属性值** | SKUAttributeValue | SKU 的属性值（等价于 Part 的 SpecValue） | id, sku_id, attr_value_id, attr_id | N:1 ← SKU |
| **商家** | Merchant | 商家主体 | id, code, name, merchant_type, grade, status | 1:N → MerchantSKU；1:N → SpecValue |
| **商家规格值** | MerchantSpecValue | 商家的固有规格属性值 | id, merchant_id, spec_code, value | N:1 ← Merchant |
| **商家 SKU** | MerchantSKU | 商家对 SKU 的具体报价（对标复杂产品的 ProductInstance） | id, code, sku_id, merchant_id, status, version | realizes → SPU；N:1 ← SKU/Merchant |
| **商家 SKU 裁剪** | MerchantSKUConfig | 商家对 SKU 候选集的裁剪（对标 offersPart 边） | merchant_sku_id, sku_id, enabled, default_selected, min_qty, max_qty | N:1 ← MerchantSKU |

#### L3 配置运行实例

| 实体名称 | 英文名 | 定义 | 关键字段 | 关联关系 |
|---------|--------|------|---------|---------|
| **配置方案** | Configuration | 一次商家运营配置 | id, merchant_sku_id, model_snapshot_id, status, operator_context | N:1 ← MerchantSKU |
| **已选 SKU** | ConfiguredSKU | 本次选中的 SKU 及数量 | configuration_id, sku_id, instance_no, quantity, selected | N:1 ← Configuration, SKU |
| **已配置参数** | ConfiguredParameter | 商家输入的参数值 | owner_type/id, parameter_code, value, unit, source | N:1 ← Configuration |
| **配置产物** | ConfigurationArtifact | 生成的报价/库存/展示信息 | configuration_id, artifact_type, content | N:1 ← Configuration |

### 1.6 实体关系ER图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           L1 业务元模型层                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────┐                                                     │
│    │ CategoryType    │                                                     │
│    │  品类类元模型   │                                                     │
│    └────────┬────────┘                                                     │
│             │ 1:N                                                         │
│     ┌───────┼───────┐                                                     │
│     ▼       ▼       ▼                                                     │
│ ┌─────────┐ ┌─────────────────┐ ┌─────────────────┐                       │
│ │  Spec    │ │   Parameter      │ │  CategoryType    │                       │
│ │Definition│ │   参数定义       │ │  (recursive)     │                       │
│ │ 规格定义  │ │（品类可配置）    │ └────────┬────────┘                       │
│ └─────────┘ └─────────────────┘          │ N:1 (parentOf)                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           L2 业务对象实例层                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────┐                                                     │
│    │   Category     │                                                     │
│    │   品类         │                                                     │
│    └────────┬────────┘                                                     │
│             │ 1:N (parentOf)                                             │
│             ▼                                                             │
│    ┌─────────────────┐     ┌──────────────────────────────────────────┐   │
│    │   Category       │────▶│ CategorySpecValue                        │   │
│    │   (节点)         │     │  品类规格值                              │   │
│    └────────┬────────┘     └──────────────────────────────────────────┘   │
│             │ 1:N (belongsTo)                                           │
│             ▼                                                             │
│    ┌─────────────────┐     ┌──────────────────────────────────────────┐   │
│    │      SPU        │────▶│ SPUSpecValue                             │   │
│    │  标准产品单元    │     │  SPU 规格值                              │   │
│    └────────┬────────┘     └──────────────────────────────────────────┘   │
│             │ 1:N (generates)                                           │
│             ▼                                                             │
│    ┌─────────────────┐     ┌──────────────────────────────────────────┐   │
│    │      SKU        │────▶│ SKUAttributeValue                        │   │
│    │  最小可售单元   │     │  SKU 属性值                              │   │
│    └────────┬────────┘     └──────────────────────────────────────────┘   │
│             │                                                             │
│             │ realizes                                                    │
│             ▼                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                   MerchantSKU 层                                   │     │
│    │                    (对标 ProductInstance)                         │     │
│    │                                                                   │     │
│    │   ┌─────────────────┐    realizes    ┌─────────────────┐      │     │
│    │   │   MerchantSKU    │──────────────▶│      SPU         │      │     │
│    │   │   商家SKU        │               │    标准产品单元   │      │     │
│    │   │   (自带 version)  │               │  (自带 version)   │      │     │
│    │   └────────┬────────┘               └─────────────────┘      │     │
│    │            │ offers (N:M)                                       │     │
│    │            ▼                                                    │     │
│    │   ┌─────────────────┐                                         │     │
│    │   │      SKU        │                                         │     │
│    │   │   最小可售单元  │                                         │     │
│    │   └─────────────────┘                                         │     │
│    │                                                                   │     │
│    │  offers 边属性:                                                │     │
│    │  enabled / disabled → 商家是否向该 SKU 报价                     │     │
│    │  defaultSelected  → 默认展示                                    │     │
│    │  minPrice / maxPrice → 商家可接受的报价区间                     │     │
│    │  fixed            → 是否固定不可改                              │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│    ┌─────────────────┐                                                 │
│    │    Merchant      │                                                 │
│    │     商家         │                                                 │
│    └────────┬────────┘                                                 │
│             │ 1:N                                                       │
│             ▼                                                           │
│    ┌─────────────────┐                                                │
│    │MerchantSpecValue │                                                │
│    │   商家规格值    │                                                │
│    └─────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           L3 配置运行实例层                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────┐    selects    ┌─────────────────┐                   │
│    │  Configuration  │──────────────▶│  ConfiguredSKU   │                   │
│    │   配置方案       │              │   已选 SKU       │                   │
│    └────────┬────────┘              └────────┬────────┘                   │
│             │ configuredParameter              │ N:1                       │
│             ▼                                 ▼                           │
│    ┌─────────────────┐               ┌─────────────────┐                   │
│    │ConfiguredParam.  │               │      SKU        │                   │
│    │   已配置参数      │               │   最小可售单元 │                   │
│    └─────────────────┘               └─────────────────┘                   │
│                                                                            │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  Configuration ──produces──> Price / Inventory / Listing          │     │
│    └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、详细数据案例（以手机品类为例）

### 2.1 L1 业务元模型数据

#### 品类类元模型定义

| type_code | name | level | parent_policy | description |
|-----------|------|-------|--------------|-------------|
| CAT_ROOT | 根品类 | 0 | NONE | 全品类根节点 |
| CAT_DIGITAL | 手机数码 | 1 | HIERARCHICAL | 一级品类 |
| CAT_PHONE | 手机 | 2 | HIERARCHICAL | 二级品类 |
| CAT_SMART | 智能手机 | 3 | HIERARCHICAL | 三级品类 |
| CAT_IPHONE | iPhone | 4 | HIERARCHICAL | 四级品类 |

#### SPU 类元模型定义

| type_code | name | domain | description |
|-----------|------|--------|-------------|
| SPU_PHONE | 手机 SPU | 手机数码 | 手机品类的标准产品单元模板 |

#### 规格定义（SpecDefinition）

规格定义在品类、SPU 或 SKU 类型上，描述固有属性：

| spec_code | name | defined_on | data_type | unit | value_domain | required |
|-----------|------|-----------|-----------|------|--------------|----------|
| CategoryLevel | 品类层级 | CAT_ROOT/CAT_DIGITAL/... | INTEGER | 级 | 0,1,2,3,4 | true |
| CategoryPath | 品类路径 | CAT_ROOT/CAT_DIGITAL/... | STRING | - | 任意路径字符串 | true |
| ChipModel | 芯片型号 | SPU_PHONE | STRING | - | A18/Snapdragon 8 Gen3/... | false |
| ScreenSize | 屏幕尺寸 | SPU_PHONE | DECIMAL | 寸 | 5.5~7.0 | true |
| BatteryCapacity | 电池容量 | SPU_PHONE | INTEGER | mAh | 3000~6000 | true |
| BrandCountry | 品牌国籍 | SPU_PHONE | STRING | - | US/KR/CN/JP | true |
| Color | 颜色 | SKU | STRING | - | 枚举值 | true |
| Capacity | 容量 | SKU | STRING | GB | 128,256,512,1024 | true |
| NetworkType | 网络制式 | SKU | STRING | - | 公开版/电信版/移动版 | false |
| MerchantGrade | 商家等级 | Merchant | STRING | - | flagship/specialty/self_operated | true |
| MerchantType | 商家类型 | Merchant | STRING | - | platform/third_party | true |

#### 参数定义（Parameter）

参数定义在品类、SPU 或商家类型上，描述可变的配置需求：

| param_code | name | defined_on | data_type | unit | min | max | default_value | description |
|-----------|------|-----------|-----------|------|-----|-----|--------------|-------------|
| ListingPriority | 展示优先级 | CAT_SMART | INTEGER | - | 1 | 100 | 50 | 品类页的展示排序权重 |
| SalesPolicy | 销售政策 | CAT_IPHONE | STRING | - | - | - | STANDARD | 销售政策：标准/预售/限购 |
| PriceRange | 定价区间 | SPU_PHONE | DECIMAL | CNY | 0 | 99999 | null | SPU 的官方定价区间 |
| ListingDuration | 上架时长 | SPU_PHONE | INTEGER | 天 | 1 | 3650 | 365 | 预期上架销售天数 |
| MinPrice | 最低售价 | Merchant | DECIMAL | CNY | 0 | 99999 | 0 | 商家 SKU 的最低可接受售价 |
| DeliveryDays | 发货时效 | Merchant | INTEGER | 天 | 1 | 30 | 7 | 商家承诺的发货天数 |
| PromotionBudget | 推广预算 | Merchant | DECIMAL | CNY | 0 | 999999 | 0 | 商家月度推广预算上限 |

> **注意**：参数定义在类型上（CategoryType/SPUType/MerchantType），SKU 本身没有参数值。商家在配置 MerchantSKU 时输入参数值。

### 2.2 L2 品类与 SPU/SKU 数据

#### 品类树（Category）

| code | name | level | parent_id | path | status | CategoryLevel |
| --- | --- | --- | --- | --- | --- | --- |
| ROOT | 根品类 | 0 | NULL | /ROOT | active | 0 |
| CAT_DIGITAL | 手机数码 | 1 | ROOT | /ROOT/CAT_DIGITAL | active | 1 |
| CAT_PHONE | 手机 | 2 | CAT_DIGITAL | /ROOT/CAT_DIGITAL/CAT_PHONE | active | 2 |
| CAT_SMART | 智能手机 | 3 | CAT_PHONE | /ROOT/CAT_DIGITAL/CAT_PHONE/CAT_SMART | active | 3 |
| CAT_IPHONE | iPhone | 4 | CAT_SMART | /ROOT/CAT_DIGITAL/CAT_PHONE/CAT_SMART/CAT_IPHONE | active | 4 |

#### SPU 数据（SPUSpecValue）

| code | name | category_id | brand | ChipModel | ScreenSize | BatteryCapacity | PriceRange |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SPU_IP16 | Apple iPhone 16 | CAT_IPHONE | BR_APPLE | A18 | 6.1 | 3561 | ¥5999-¥9999 |
| SPU_S24 | Samsung Galaxy S24 | CAT_SMART | BR_SAMSU | Snapdragon 8 Gen3 | 6.2 | 4000 | ¥4999-¥7999 |

> SPU 自身也有规格值（如 ChipModel、ScreenSize 是 SPU 固有的，不是特定 SKU 的）。

#### SKU 数据（SKUAttributeValue）

| code | name | spu_code | Color | Capacity | NetworkType | price |
| --- | --- | --- | --- | --- | --- | --- |
| SKU_IP16_256_BLACK | iPhone 16 256GB 黑色 | SPU_IP16 | 黑色 | 256GB | 公开版 | 6999 |
| SKU_IP16_512_TITAN | iPhone 16 512GB 钛色 | SPU_IP16 | 钛色 | 512GB | 公开版 | 8999 |
| SKU_IP16_128_BLACK_TELE | iPhone 16 128GB 黑色电信版 | SPU_IP16 | 黑色 | 128GB | 电信版 | 5999 |
| SKU_S24_256 | Galaxy S24 256GB | SPU_S24 | 灰色 | 256GB | 公开版 | 5499 |

#### 商家数据（MerchantSpecValue）

| code | name | MerchantType | MerchantGrade | MinPrice | DeliveryDays | PromotionBudget |
| --- | --- | --- | --- | --- | --- | --- |
| MERCH_DXY | 店小二旗舰店 | third_party | flagship | 100 | 3 | 50000 |
| MERCH_APP | 苹果直营店 | self_operated | flagship | 0 | 1 | 200000 |

### 2.3 MerchantSKU 数据（对标复杂产品的 ProductInstance）

#### MerchantSKU vs 复杂产品 ProductInstance 对照

| 复杂产品概念 | 电商对应 | 说明 |
|------------|---------|------|
| ProductInstance | MerchantSKU | 商家视角的"可售产品实例" |
| realizes → ProductClass | realizes → SPU | 商家 SKU 归属于哪个 SPU |
| offersPart → Part（裁剪） | offers → SKU（裁剪） | 商家选择向哪些 SKU 报价 |
| enabled/disabled（Part 裁剪） | enabled/disabled（SKU 裁剪） | 商家是否向该 SKU 报价 |
| defaultSelected | defaultSelected | 默认展示的 SKU |
| minQty/maxQty | minPrice/maxPrice | 数量边界 → 价格边界 |
| fixed | fixed | 是否固定不可改 |

#### MerchantSKU 数据（示例）

| merchant_sku_code | merchant | realizes (SPU) | enabled SKUs | default | price_range |
| --- | --- | --- | --- | --- | --- | --- |
| MSKU_DXY_IP16 | MERCH_DXY | SPU_IP16 | SKU_IP16_256_BLACK ✅、SKU_IP16_512_TITAN ✅、SKU_IP16_128_BLACK_TELE ❌ | SKU_IP16_256_BLACK | ¥6299-¥8999 |
| MSKU_APP_IP16 | MERCH_APP | SPU_IP16 | SKU_IP16_256_BLACK ✅、SKU_IP16_512_TITAN ✅ | SKU_IP16_512_TITAN | ¥6999-¥9999 |

> **关键理解**：MerchantSKU 是商家的"可售产品实例"，商家通过 `offers` 边决定向哪些 SKU 报价（裁剪）。店小二禁用电信版 SKU（SKU_IP16_128_BLACK_TELE），苹果直营店禁用电信版但展示 512GB 钛色为默认。

#### MerchantSKU 完整数据（JSON格式）

```json
{
  "code": "MSKU_DXY_IP16",
  "name": "店小二-iPhone16",
  "version": "1.0.0",
  "realizes": {
    "spuCode": "SPU_IP16"
  },
  "merchant": {
    "code": "MERCH_DXY",
    "name": "店小二旗舰店"
  },
  "offersSKULinks": [
    {
      "skuCode": "SKU_IP16_256_BLACK",
      "enabled": true,
      "defaultSelected": true,
      "minPrice": 6299,
      "maxPrice": 7499,
      "fixed": false
    },
    {
      "skuCode": "SKU_IP16_512_TITAN",
      "enabled": true,
      "defaultSelected": false,
      "minPrice": 8299,
      "maxPrice": 9999,
      "fixed": false
    },
    {
      "skuCode": "SKU_IP16_128_BLACK_TELE",
      "enabled": false
    }
  ],
  "parameters": {
    "MinPrice": 100,
    "DeliveryDays": 3,
    "PromotionBudget": 50000
  },
  "extensions": {
    "sales": {
      "sellingPoints": ["正品保障", "急速发货", "官方授权"],
      "bannerAssetId": "ASSET-DXY-IP16"
    }
  }
}
```

### 2.4 商家配置实例数据（对标复杂产品的 Configuration）

**场景**：店小二配置 iPhone 16 商家 SKU，设置 256GB 为主推款，512GB 为备选，总库存不少于 50 台。

```json
{
  "configurationId": "CFG-MERCH-20260727-0001",
  "merchantSkuCode": "MSKU_DXY_IP16",
  "modelSnapshot": "SPU_IP16:1.0.0 / MSKU_DXY_IP16:1.0.0",
  "configuredParameters": [
    {
      "parameterCode": "MinPrice",
      "ownerType": "Merchant",
      "ownerId": "MERCH_DXY",
      "value": 6299,
      "unit": "CNY",
      "description": "256GB最低售价"
    },
    {
      "parameterCode": "DeliveryDays",
      "ownerType": "Merchant",
      "ownerId": "MERCH_DXY",
      "value": 3,
      "unit": "天",
      "description": "发货时效3天"
    }
  ],
  "solution": {
    "configuredSKUs": [
      {
        "skuCode": "SKU_IP16_256_BLACK",
        "quantity": 50,
        "selected": true,
        "listingPrice": 6999,
        "reason": "主推款，256GB黑色，库存50+"
      },
      {
        "skuCode": "SKU_IP16_512_TITAN",
        "quantity": 20,
        "selected": true,
        "listingPrice": 8999,
        "reason": "备选款，512GB钛色，高端定位"
      },
      {
        "skuCode": "SKU_IP16_128_BLACK_TELE",
        "quantity": 0,
        "selected": false,
        "reason": "被店小二禁用（未签约电信版）"
      }
    ]
  },
  "artifacts": {
    "listing": {
      "items": [
        {"skuCode": "SKU_IP16_256_BLACK", "listingPrice": 6999, "stock": 50},
        {"skuCode": "SKU_IP16_512_TITAN", "listingPrice": 8999, "stock": 20}
      ]
    },
    "totalValue": 6999 * 50 + 8999 * 20,
    "deliveryPromise": "3天内发货"
  }
}
```

---

## 三、业务处理流程（以手机品类从建模到运营为例）

### 3.1 流程总览

电商语义模型的完整生命周期分为 **两个核心建模阶段**：

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        电商语义模型完整生命周期                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                    阶段一：品类/SPU 语义设计                               │   │
│  │                    责任人：品类经理 + 产品设计师                           │   │
│  │                                                                      │   │
│  │  CategoryType ──hasSpec──> SpecDefinition（品类层级/路径）              │   │
│  │  SPUType ──hasSpec──> SpecDefinition（芯片/屏幕/品牌）                  │   │
│  │  SPUType ──hasParameter──> Parameter（定价区间/展示优先级）            │   │
│  │  SKUType ──hasSpec──> SpecDefinition（颜色/容量/制式）                  │   │
│  │  MerchantType ──hasSpec──> SpecDefinition（商家类型/等级）              │   │
│  │  MerchantType ──hasParameter──> Parameter（最低售价/发货时效）          │   │
│  │                                                                      │   │
│  │  输入：品类树 + SPU 定义 + SKU 属性模板 + 商家运营参数模板               │   │
│  │  输出：品类/SPU/SKU/商家语义模型（已发布）                             │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                    阶段二：商家 SKU 实例化                               │   │
│  │                    责任人：商家运营 + 品类经理                           │   │
│  │                                                                      │   │
│  │  MerchantSKU ──realizes──> SPU（商家SKU 自带 version）                  │   │
│  │  MerchantSKU ──offers──> SKU（裁剪：enabled/disabled/默认/价格区间）  │   │
│  │                                                                      │   │
│  │  输入：已发布的 SPU + 商家运营策略 + SKU 候选集                         │   │
│  │  输出：MerchantSKU（已发布的商家可售产品）                              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                    阶段三：商家运营配置                                  │   │
│  │                    责任人：商家 / 运营平台                               │   │
│  │                                                                      │   │
│  │  Configuration ──selects──> ConfiguredSKU                              │   │
│  │  Configuration ──produces──> Listing / Price / Inventory               │   │
│  │                                                                      │   │
│  │  输入：MerchantSKU + 商家输入的参数值                                   │   │
│  │  输出：商品上架 / 报价 / 库存配置                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 阶段一：品类/SPU 语义设计（品类经理 + 产品设计师）

**责任人**：品类经理（定义品类结构和展示策略）、产品设计师（定义 SPU/SKU 属性体系）。

**核心任务**：定义品类树结构、SPU 共享属性、SKU 属性组合模板、商家运营参数模板。

```
┌────────────────────────────────────────────────────────────────────────────┐
│           阶段一：品类/SPU 语义设计 - 责任人：品类经理 + 产品设计师           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐                                                           │
│  │ 品类经理    │                                                           │
│  │ 产品设计师  │                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 1: 设计品类树                                                    │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：定义品类层级结构及继承策略                                        │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ 品类编码    │ 品类名称    │ 层级 │ 上级品类   │ 继承策略       │    │   │
│  │  ├─────────────┼─────────────┼──────┼─────────────┼───────────────┤    │   │
│  │  │ ROOT       │ 根品类     │  0  │ -         │ NONE          │    │   │
│  │  │ CAT_DIGITAL│ 手机数码   │  1  │ ROOT      │ HIERARCHICAL  │    │   │
│  │  │ CAT_PHONE  │ 手机       │  2  │ CAT_DIGITAL│ HIERARCHICAL │    │   │
│  │  │ CAT_SMART  │ 智能手机   │  3  │ CAT_PHONE  │ HIERARCHICAL │    │   │
│  │  │ CAT_IPHONE │ iPhone     │  4  │ CAT_SMART  │ HIERARCHICAL │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  输出：Category 集合                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 2: 定义 SPU 及共享规格（SpecDefinition）                          │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：为 SPU 定义固有的物理特性                                        │   │
│  │  语义：这些是 SPU 天生的属性，不可由商家修改                           │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ SPU编码   │ 规格编码     │ 规格名称    │ 数据类型 │ 单位   │ 可选值              │    │   │
│  │  ├───────────┼──────────────┼─────────────┼──────────┼────────┼──────────────────────┤    │   │
│  │  │ SPU_IP16 │ ChipModel   │ 芯片型号   │ STRING   │ -      │ A18/Snapdragon... │    │   │
│  │  │ SPU_IP16 │ ScreenSize  │ 屏幕尺寸   │ DECIMAL  │ 寸     │ 5.5~7.0            │    │   │
│  │  │ SPU_IP16 │ BatteryCap  │ 电池容量   │ INTEGER  │ mAh    │ 3000~6000          │    │   │
│  │  │ SPU_S24  │ ChipModel   │ 芯片型号   │ STRING   │ -      │ Snapdragon 8 Gen3   │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  输出：SPU 规格定义集合                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 3: 定义 SPU 可配置参数（Parameter）                              │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：为 SPU 定义可由品类经理配置的运营参数                              │   │
│  │  语义：这些是可变的输入项，面向品类经理                                 │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ SPU编码   │ 参数编码      │ 参数名称     │ 类型 │ 单位  │ 说明                │    │   │
│  │  ├───────────┼───────────────┼──────────────┼──────┼───────┼────────────────────┤    │   │
│  │  │ SPU_IP16 │ PriceRange   │ 定价区间    │INPUT │ CNY   │ 官方定价上下限      │    │   │
│  │  │ SPU_IP16 │ ListingPriority│ 展示优先级 │INPUT │ -     │ 品类页排序权重      │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  输出：SPU 参数定义集合                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 4: 定义 SKU 属性模板（颜色/容量/制式组合）                       │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：为 SKU 定义属性组合规则，决定 SKU 唯一性                          │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ SKU编码           │ 属性维度      │ 可选值                            │    │   │
│  │  ├───────────────────┼───────────────┼─────────────────────────────────┤    │   │
│  │  │ SKU_PHONE        │ Color        │ 黑色/白色/钛色/蓝色               │    │   │
│  │  │ SKU_PHONE        │ Capacity     │ 128GB/256GB/512GB/1TB            │    │   │
│  │  │ SKU_PHONE        │ NetworkType │ 公开版/电信版/移动版               │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  输出：SKU 属性组合规则                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 5: 定义商家规格与参数（MerchantType）                            │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：为商家定义固有规格和可配置运营参数                                │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ 维度       │ 编码             │ 名称       │ 类型  │ 说明              │    │   │
│  │  ├────────────┼──────────────────┼─────────────┼───────┼────────────────────┤    │   │
│  │  │ 商家规格   │ MerchantGrade   │ 商家等级   │ STRING │ flagship/specialty │    │   │
│  │  │ 商家规格   │ MerchantType   │ 商家类型   │ STRING │ platform/third_party│    │   │
│  │  │ 商家参数   │ MinPrice       │ 最低售价   │ INPUT  │ 商家最低可接受售价 │    │   │
│  │  │ 商家参数   │ DeliveryDays   │ 发货时效   │ INPUT  │ 承诺发货天数       │    │   │
│  │  │ 商家参数   │ PromotionBudget│ 推广预算   │ INPUT  │ 月度推广预算上限   │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  输出：商家规格定义 + 参数定义集合                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 阶段二：商家 SKU 实例化（商家运营 + 品类经理）

**责任人**：商家运营（商家视角决定向哪些 SKU 报价）、品类经理（审核商家配置）。

**核心任务**：创建 MerchantSKU，通过 `offers` 边裁剪 SKU 候选集，定义价格区间。

```
┌────────────────────────────────────────────────────────────────────────────┐
│           阶段二：商家 SKU 实例化 - 责任人：商家运营 + 品类经理                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 1: 选择 SPU 基线                                                │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：商家选择要经营的 SPU                                             │   │
│  │  输入：SPU_IP16（Apple iPhone 16）                                     │   │
│  │  说明：MerchantSKU 自带 version 字段，不引入 MerchantSKUVersion            │   │
│  │  输出：基线引用 SPU = SPU_IP16                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 2: 创建 MerchantSKU                                              │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：商家创建自己的 iPhone 16 可售产品                                 │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ 字段           │ 店小二旗舰店          │ 苹果直营店           │    │   │
│  │  ├────────────────┼──────────────────────┼──────────────────────┤    │   │
│  │  │ 商家SKU编码    │ MSKU_DXY_IP16       │ MSKU_APP_IP16       │    │   │
│  │  │ 商家          │ MERCH_DXY            │ MERCH_APP           │    │   │
│  │  │ 商家版本      │ 1.0.0              │ 1.0.0             │    │   │
│  │  │ SPU 基线      │ SPU_IP16           │ SPU_IP16          │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 3: 裁剪 SKU 候选集（核心步骤）                                   │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  操作：通过 offers 边配置商家向哪些 SKU 报价                             │   │
│  │  语义：确定商家是否向每个候选 SKU 开放报价                               │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ SKU               │ 店小二 enabled │ 店小二默认 │ 苹果 enabled │ 苹果默认 │    │   │
│  │  ├──────────────────┼────────────────┼────────────┼─────────────┼──────────┤    │   │
│  │  │ SKU_IP16_256_BLACK│ ✅ 启用       │ ✅ 主推(¥6999) │ ✅ 启用 │ ❌ 非默认 │    │   │
│  │  │ SKU_IP16_512_TITAN│ ✅ 启用       │ ❌ 备选      │ ✅ 启用 │ ✅ 主推(¥8999) │    │   │
│  │  │ SKU_IP16_128_BLACK_TELE│ ❌ 禁用 │ -            │ ❌ 禁用 │ -         │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                        │   │
│  │  🔑 裁剪说明：                                                         │   │
│  │     • 店小二禁用电信版 SKU（未签约电信运营商）                          │   │
│  │     • 苹果直营店主推 512GB 钛色（高端定位）                             │   │
│  │     • offers 边属性：enabled / defaultSelected / minPrice / maxPrice    │   │
│  │                                                                        │   │
│  │  输出：offers SKU OntoLinkInst 集合（裁剪结果）                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Step 4: 发布 MerchantSKU                                              │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  校验：裁剪后商家至少有一个可售 SKU                                   │   │
│  │  输出：MSKU_DXY_IP16、MSKU_APP_IP16 发布                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 完整数据流程图

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        电商语义模型全链路数据流转图                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  【阶段一：品类/SPU 语义设计】                                                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                   Category: ROOT → CAT_DIGITAL → CAT_PHONE                 │ │
│  │                   → CAT_SMART → CAT_IPHONE                                │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SPU: SPU_IP16 (Apple iPhone 16)                                    │  │ │
│  │  │    Spec: ChipModel=A18, ScreenSize=6.1, BatteryCap=3561mAh           │  │ │
│  │  │    Parameter: PriceRange(¥5999-¥9999), ListingPriority=80              │  │ │
│  │  │    generates: SKU_PHONE (Color × Capacity × NetworkType 组合)         │  │ │
│  │  ├────────────────────────────────────────────────────────────────────┤  │ │
│  │  │  SKU: SKU_IP16_256_BLACK (颜色=黑色, 容量=256GB, 制式=公开版) → ¥6999 │  │ │
│  │  │  SKU: SKU_IP16_512_TITAN (颜色=钛色, 容量=512GB, 制式=公开版) → ¥8999 │  │ │
│  │  │  SKU: SKU_IP16_128_BLACK_TELE (颜色=黑色, 容量=128GB, 制式=电信版) → ¥5999 │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                     │
│         │ realize + offers (裁剪)                                              │
│         ▼                                                                     │
│  【阶段二：商家 SKU 实例化】                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  店小二 MSKU_DXY_IP16 ──────────────────────────────────────────────┐     │ │
│  │  ┌────────────────────────────────────────────────────────────────┐│     │ │
│  │  │  enabled: SKU_IP16_256_BLACK ✅, SKU_IP16_512_TITAN ✅          ││     │ │
│  │  │  excluded: SKU_IP16_128_BLACK_TELE ❌                          ││     │ │
│  │  │  default: SKU_IP16_256_BLACK (¥6999)                            ││     │ │
│  │  │  price_range: ¥6299-¥8999                                       ││     │ │
│  │  └────────────────────────────────────────────────────────────────┘│     │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │  苹果直营店 MSKU_APP_IP16 ──────────────────────────────────────────┐     │ │
│  │  ┌────────────────────────────────────────────────────────────────┐│     │ │
│  │  │  enabled: SKU_IP16_256_BLACK ✅, SKU_IP16_512_TITAN ✅          ││     │ │
│  │  │  excluded: SKU_IP16_128_BLACK_TELE ❌                          ││     │ │
│  │  │  default: SKU_IP16_512_TITAN (¥8999)                           ││     │ │
│  │  │  price_range: ¥6999-¥9999                                      ││     │ │
│  │  └────────────────────────────────────────────────────────────────┘│     │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                     │
│         │ 商家选择 MerchantSKU + 输入参数值                                    │
│         ▼                                                                     │
│  【阶段三：商家运营配置】                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Configuration: CFG-MERCH-20260727-0001                                │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  configuredParameters (商家输入的参数):                               │  │ │
│  │  │    - MERCH_DXY.MinPrice = 6299 (最低售价)                          │  │ │
│  │  │    - MERCH_DXY.DeliveryDays = 3 (发货时效)                          │  │ │
│  │  ├────────────────────────────────────────────────────────────────────┤  │ │
│  │  │  configuredSKUs (结果):                                             │  │ │
│  │  │    - SKU_IP16_256_BLACK x1 (主推款, ¥6999, 库存50+)              │  │ │
│  │  │    - SKU_IP16_512_TITAN x1 (备选款, ¥8999, 库存20)               │  │ │
│  │  ├────────────────────────────────────────────────────────────────────┤  │ │
│  │  │  artifacts:                                                        │  │ │
│  │  │    - Listing: iPhone 16 上架 (店小二)                              │  │ │
│  │  │    - Delivery Promise: 3天发货                                      │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、新模型与现有模型的关系

### 4.1 定位说明

本文模型是 **电商语义全生命周期的业务事实模型**；底层可对接各类 Ontology 引擎（Stardog/Fabric IQ/Neo4j）或关系型数据库。

二者是「业务事实源 → 可执行投影」关系：

```
电商语义模型（源）              可执行投影（Ontology / 关系库）
─────────────────              ──────────────────────────────
Category / SPU / SKU      ──compile──> Category Entity / SPU Entity / SKU Entity
CategorySpecValue / SPUSpecValue ──compile──> Entity Property Values
MerchantSKU              ──compile──> MerchantSKU Entity + offers Relationship
Parameter                ──compile──> Configurable Property / Rule Parameter
Configuration           <──result─── Listing / Price / Inventory Artifact
```

### 4.2 电商 vs 复杂产品概念对照总表

| 复杂产品概念（docs3） | 电商对应 | 说明 |
|---------------------|---------|------|
| ProductClass（产品类） | SPU（标准产品单元） | 都是"骨架"，可跨实例复用 |
| PartClass（部件分类） | Category（品类） | 都是分类/分组边界 |
| Part（部件） | SKU（最小可售单元） | 都是骨架的具体部件 |
| SpecDefinition | SPU Spec / SKU Spec | 都是固有属性 |
| SpecValue | SPUSpecValue / SKUAttributeValue | 都是具体属性值 |
| Parameter | SPU Parameter / Merchant Parameter | 都是可变配置需求 |
| ProductInstance | MerchantSKU | 都是骨架的实例化 |
| offersPart 边（裁剪） | offers 边（裁剪） | 实例决定包含哪些部件候选 |
| Configuration | Merchant Configuration | 都是运行时的配置输入 |
| ConfiguredPart | ConfiguredSKU | 都是选中的具体实例 |

### 4.3 Palantir Ontology 对位映射

| Palantir 概念 | 电商模型对应 | 说明 |
|--------------|------------|------|
| ObjectType (OT_SPU) | SPUType | 标准产品单元 |
| ObjectType (OT_SKU) | SKUType | 最小可售单元 |
| ObjectType (OT_MERCHANT) | MerchantType | 商家主体 |
| LinkType (GENERATES) | SPU → SKU (generates) | SPU 生成 SKU |
| LinkType (SOLD_BY) | MerchantSKU (offers) | 商家向 SKU 报价 |
| Link properties | offers 边属性 (minPrice/maxPrice/enabled) | 价格区间/启用状态 |
| Action Type | Configuration → Listing/Price/Inventory | 运营配置动作 |

### 4.4 需要保持的边界

1. **MerchantSKU 自带 version**：不要引入 MerchantSKUVersion 之类的额外对象。版本直接在 MerchantSKU.version 字段管理。

2. **SpecDefinition 和 Parameter 的区别要保持**：
   - SpecDefinition 定义在 SPUType/SKUType/MerchantType 上，Category/SPU/SKU/Merchant 都有自己的 SpecValue，描述固有属性
   - Parameter 定义在 SPUType/MerchantType 上，SKU 无 Parameter 值，描述用户可变的配置需求

3. **SKU 属性值 = SpecValue**：电商 SKU 的颜色/容量/制式是 SpecValue（属性值），不是 Parameter（参数）。商家在配置 MerchantSKU 时输入的最低售价/发货时效才是 Parameter。

4. **品类树 ≠ PartClass**：Category 是分类体系，不是部件分类。品类树通过 parentOf 自连接关系表达，PartClass 通过 composedOf 表达组成关系。

5. **模型升级需要快照机制**：历史报价和上架记录必须能够复现，不能因为模型变更导致历史配置无法验证。

---

## 五、数据模型关键指标汇总

| 指标维度 | 指标名称 | 数值 | 说明 |
|---------|---------|------|------|
| **品类层** | Category | 5个 | ROOT/手机数码/手机/智能手机/iPhone |
| **SPU 层** | SPU | 2个 | SPU_IP16、SPU_S24 |
| **SKU 层** | SKU | 4个 | 各颜色/容量/制式组合 |
| **商家层** | Merchant | 2个 | 店小二旗舰店、苹果直营店 |
| **商家 SKU 层** | MerchantSKU | 2个 | MSKU_DXY_IP16、MSKU_APP_IP16 |
| **规格定义层** | SpecDefinition | 12个 | 品类规格 + SPU规格 + SKU规格 + 商家规格 |
| **参数定义层** | Parameter | 7个 | SPU定价区间/展示优先级 + 商家最低售价/发货时效/推广预算 |
| **配置运行层** | Configuration | 1个 | 商家运营配置方案 |

---

## 六、附录

### 6.1 术语表

| 术语 | 全称 | 说明 |
|------|------|------|
| SPU | Standard Product Unit | 标准产品单元，对标复杂产品的 ProductClass |
| SKU | Stock Keeping Unit | 最小可售单元，对标复杂产品的 Part |
| MerchantSKU | 商家 SKU | 商家对 SKU 的具体报价，对标复杂产品的 ProductInstance |
| SPUSpecValue | SPU 规格值 | SPU 的固有规格属性值 |
| SKUAttributeValue | SKU 属性值 | SKU 的颜色/容量等属性值（等价于 SpecValue） |
| offers 边 | 商家 SKU 裁剪边 | MerchantSKU 到 SKU 的关系边，携带 enabled/defaultSelected/minPrice/maxPrice/fixed |
| SpecDefinition | 规格定义 | 产品/品类/商家固有的物理特性或属性定义 |
| Parameter | 参数 | 可由品类经理/商家配置的运营参数 |

### 6.2 规格 vs 参数速查（电商版）

| 问题 | 答案 |
|------|------|
| iPhone 16 屏幕 6.1 寸是规格还是参数？ | SPU 规格，因为屏幕尺寸是 SPU 固有的物理属性 |
| iPhone 16 256GB 黑色是规格还是参数？ | SKU 属性值（SpecValue），颜色/容量是 SKU 的固有属性 |
| 店小二要求"256GB 最低售价 ¥6299"是什么？ | 商家参数（Parameter），由商家输入的可配置价格下限 |
| 品类经理设置的"展示优先级 80"是什么？ | 品类参数（Parameter），由品类经理输入的配置值 |
| 商家设置"发货时效 3 天"是什么？ | 商家参数（Parameter），由商家输入的运营承诺 |
| Parameter 有 SpecValue 吗？ | 没有，Parameter 值在 Configuration 中由商家/品类经理输入 |

### 6.3 数据流向总结

```
品类经理 + 产品设计师
     ↓
设计品类树（Category） → 定义 SPU 规格（SpecDefinition）
     ↓
定义 SPU 参数（Parameter） → 定义 SKU 属性模板
     ↓
发布品类/SPU/SKU 语义模型
     ↓
商家运营
     ↓
创建 MerchantSKU（自带 version）
     ↓
通过 offers 边裁剪 SKU 候选集（enabled/disabled/默认/价格区间）
     ↓
商家输入 Parameter 值（最低售价/发货时效/推广预算）
     ↓
配置引擎求解 → 输出上架/报价/库存
```

---

*文档结束*
