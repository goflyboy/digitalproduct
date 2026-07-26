# 基于 Palantir 范式的电商产品语义建模方案

> **文档版本**: v4.0
> **创建时间**: 2026-07-26
> **核心主题**: 两层语义模型设计、Graph构建与Agent消费场景
> **重写说明**: v4.0 在 v3.0 基础上收敛"Category vs Template"职责，采用 **路线 B（Template-Centric）**：Category 不再独立声明属性，**OT_SPU_TEMPLATE 成为属性声明的唯一入口**。LinkType 从 12 个降为 11 个（删除 DECLARES_ATTRIBUTE），详见附录修订记录。

---

## 一、Palantir 范式解读与电商映射

> **V4 路线 B 设计原则**：本节起所有 LinkType 与 ObjectType 的定义都基于 **路线 B（Template-Centric）** —— Category 是业务归属层，**OT_SPU_TEMPLATE 是属性声明的唯一入口**。V3 的"Category 通过 DECLARES_ATTRIBUTE 独立声明属性"模型已废弃。详见 §1.1.1 / §2.1.5 / §2.3.2 / §4.4。

### 1.1 Palantir 核心概念回顾

| Palantir 概念 | 定义 | 文档中的定义位置 | 电商场景映射 |
|--------------|------|------------------|------------|
| **Object Type** | 对象的类型定义（实体/事件） | §2.1.5 ~ §2.1.13 | 品类、品牌、SPU、SKU、商家、仓库、属性、属性值、价格、库存 |
| **Property Type** | 对象类型的属性定义（含基础类型、约束） | 在每个 ObjectType 的 `properties` 中 | 品类的"名称"、SKU 的"价格"等 |
| **Object Instance** | ObjectType 的具体实例 | §2.2 | 具体 SPU（如 iPhone 16）、具体商家（如店小二旗舰店） |
| **Link Type** | **连接两个 ObjectType 的关系类型定义（与 ObjectType 平级的一等公民）** | §1.1.1 | "品类-PARENT_OF-品类"、"SPU-GENERATES-SKU"、"SKU-SOLD_BY-商家" |
| **Interface Type** | 多 ObjectType 可实现的共享 shape（类似接口/抽象类） | v3 规划（本文档不展开） | "Inspectable"、"Sellable"、"InventoryHoldable" |
| **Action Type** | 可对 Object 执行的可写操作（含参数、返回、权限） | v3 规划（本文档不展开） | 上架、定价、下单、调拨 |
| **Backing Datasource** | ObjectType / LinkType 背后的物理数据源（数据集/流） | §4.2 | 关系数据库表、流式管道 |

### 1.1.1 LinkType 详解（核心补充）

Palantir 中 LinkType 与 ObjectType 平级，是 Ontology 的一等公民，不是附属品。其官方定义为：

> "A link type is the **schema definition of a relationship between two object types**. A link refers to a single instance of that relationship between two objects in the same Ontology."

LinkType 有四个关键特征：

| 特征 | 说明 | 电商映射举例 |
|------|------|------------|
| **双向 (bidirectional)** | 一个 LinkType 永远有两端，两端可独立遍历，命名可不同 | `SPU ↔ SKU` 一侧叫 `generatesSkus`，另一侧叫 `generatedFromSpu` |
| **可自连接 (self-link)** | 两端可以是同一个 ObjectType | `Category ↔ Category` 的 `PARENT_OF` |
| **可带属性 (link-side properties)** | LinkType 自身可声明 PropertyType | `SOLD_BY` 上的 `merchant_sku_id`、`status`、`sale_price` |
| **可独立 backing datasource** | 多对多关系可由专门的 LinkType datasource 支撑 | `merchant_sku` 表 支撑 `SOLD_BY` |

#### 电商场景的 LinkType 清单

| # | LinkType Id | A-side | B-side | 一端类型 | 另一端类型 | A-side API | B-side API | Link Properties | Backing |
|---|------------|--------|--------|---------|-----------|------------|------------|-----------------|---------|
| 1 | `PARENT_OF` | parent | child | OT_CATEGORY | OT_CATEGORY | parentCategory | subCategories | rank, inherit_strategy | category.parent_id |
| 2 | `BELONGS_TO_CATEGORY` | spu | category | OT_SPU | OT_CATEGORY | spusInCategory | primaryCategory / alsoInCategories | is_primary | spu.category_id |
| 3 | `HAS_BRAND` | spu | brand | OT_SPU | OT_BRAND | brandedProducts | brand | — | spu.brand_id |
| 4 | `GENERATES` | spu | sku | OT_SPU | OT_SKU | generatedSkus | generatedFromSpu | combination_key | sku.spu_id |
| 5 | `HAS_ATTR_VALUE` | sku | attrValue | OT_SKU | OT_ATTRIBUTE_VALUE | attrValues | belongsToSku | — | sku_attr_value |
| 6 | `SOLD_BY` | sku | merchant | OT_SKU | OT_MERCHANT | sellers | soldSkus | merchant_sku_id, status, listing_time | merchant_sku |
| 7 | `HAS_PRICE` | merchantSku | price | OT_MERCHANT_SKU | OT_PRICE | prices | heldByMerchantSku | sale_price, original_price, cost_price, price_type | price |
| 8 | `HOLDS_INVENTORY` | merchantSku | inventory | OT_MERCHANT_SKU | OT_INVENTORY | inventoryItems | heldByMerchantSku | warehouse_id, available, reserved, alert_threshold | inventory |
| 9 | `LOCATED_AT` | inventory | warehouse | OT_INVENTORY | OT_WAREHOUSE | stockholdings | warehouse | — | inventory.warehouse_id |
| 10 | **`HAS_CANDIDATE_VALUE`** | attribute | attrValue | OT_ATTRIBUTE | OT_ATTRIBUTE_VALUE | candidateValues | candidateOfAttribute | sort_order, is_default | attr_id（值池表） |
| 11 | **`TEMPLATE_REFERENCES_ATTR`** | template | attribute | OT_SPU_TEMPLATE / OT_SKU_TEMPLATE | OT_ATTRIBUTE | referencedAttributes | referencedByTemplates | scope: required/optional/sales, allowed_value_refs[], overrides{} | template_attribute_rel（模板属性关联表） |

> **V4 重要变更**：删除了原 V3 的 LinkType #6 `DECLARES_ATTRIBUTE`（Category → Attribute 的品类声明属性关系）。V4 路线 B 下，**Template 是属性声明的唯一入口**，Category 不再独立声明属性，因此该 LinkType 不再存在。LinkType 总数从 12 降为 11。

> **LinkType #10 `HAS_CANDIDATE_VALUE` 是 OT_ATTRIBUTE ↔ OT_ATTRIBUTE_VALUE 之间的核心关系**，决定了"一个属性有哪些可选值"。
>
> **LinkType #11 `TEMPLATE_REFERENCES_ATTR` 是模板 ↔ 属性字典之间的关系**，对应 §2.1.1 / §2.1.2 中模板里的 `required_attribute_refs` / `sales_attribute_rules` 列表项。该 link 上的 `allowed_value_refs` 是值池子集 —— 它不复制值，而是引用值池中的某些 attr_value_id。**这是 V4 路线 B 下属性声明的唯一入口**。

**示例：LinkType #11 的 linkProperties 与 allowed_value_refs 的关系**

```json
{
  "linkType": "TEMPLATE_REFERENCES_ATTR",
  "from": "OT_SPU_TEMPLATE/TMPL_IPHONE",
  "to":   "OT_ATTRIBUTE/ATTR_COLOR",

  "linkProperties": {
    "scope": "sales",                                  // 销售属性
    "is_combination_key": true,
    "allowed_value_refs": [                            // 模板限定值池子集
      "OT_ATTRIBUTE_VALUE/AV_BLACK",
      "OT_ATTRIBUTE_VALUE/AV_WHITE",
      "OT_ATTRIBUTE_VALUE/AV_PINK",
      "OT_ATTRIBUTE_VALUE/AV_BLUE"
    ],
    "overrides": {
      "must_be_in_category_whitelist": true
    }
  }
}
```

也就是说：OT_ATTRIBUTE/ATTR_COLOR 的值池可能包含 50 个值（黑、白、粉、蓝、玫红、Tiffany 蓝、青灰……），但 iPhone 模板通过 LinkType #11 的 `allowed_value_refs` 限制只允许其中 4 个。

#### LinkType 的 JSON Schema 定义示例（Palantir 风格）

```json
{
  "linkType": {
    "apiName": "SOLD_BY",
    "displayName": "被商家销售",
    "description": "SKU 被商家认领并销售的关系",
    "objectTypeAPrimaryKey": "sku_id",
    "objectTypeBPrimaryKey": "merchant_id",
    "objectTypeAType": "OT_SKU",
    "objectTypeBType": "OT_MERCHANT",
    "cardinality": "MANY_TO_MANY",
    "aSide": {
      "apiName": "sellers",
      "displayName": "售卖商家集合",
      "cardinality": "ZERO_TO_MANY"
    },
    "bSide": {
      "apiName": "soldSkus",
      "displayName": "销售的SKU集合",
      "cardinality": "ZERO_TO_MANY"
    },
    "linkProperties": [
      {
        "apiName": "merchant_sku_id",
        "dataType": "STRING",
        "isPrimaryKey": true,
        "description": "商家侧SKU标识"
      },
      {
        "apiName": "status",
        "dataType": "ENUM",
        "values": ["draft", "online", "offline", "banned"],
        "default": "draft"
      },
      {
        "apiName": "listing_time",
        "dataType": "TIMESTAMP",
        "description": "上架时间"
      }
    ],
    "backingDatasources": [
      {
        "type": "DATASET",
        "rid": "ri.foundry.main.dataset.merchant_sku",
        "joinKey": {
          "fromA": "sku_id",
          "fromB": "merchant_id"
        }
      }
    ]
  }
}
```

> ⚠️ 关键认知：在 Palantir 范式下，关系是有"schema"的，不是 Graph DB 里随便创建一条边那么简单。LinkType 本身需要被版本化、被注册、被权限控制。

### 1.2 电商语义两层模型架构

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    Palantir 范式下的电商语义两层模型                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                第一层：元数据层 (Meta Layer)                               │ │
│  │  ──────────────────────────────────────────────────────────────────────  │ │
│  │                                                                           │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  A. 模板类型（电商特有，Palantir 原生 Ontology 中没有此层）           │  │ │
│  │  │     ——  "元数据的元数据"，规定某类 ObjectType 应有哪些属性           │  │ │
│  │  │                                                                    │  │ │
│  │  │    ┌────────────────────────┐      ┌────────────────────────┐     │  │ │
│  │  │    │ OT_SPU_TEMPLATE         │      │ OT_SKU_TEMPLATE         │     │  │ │
│  │  │    │ (SPU 模板：定义 SPU      │ ───▶ │ (SKU 模板：定义 SKU      │     │  │ │
│  │  │    │  实例应有哪些属性)        │ 驱动 │  实例应有哪些属性)        │     │  │ │
│  │  │    └────────────────────────┘      └────────────────────────┘     │  │ │
│  │  └────────┬───────────────────┬────────────────────┬─────────────────┘  │ │
│  │           │TEMPLATE_REFS_ATTR │TEMPLATE_REFS_ATTR  │                    │ │
│  │           ▼ (#12)             ▼ (#12)              ▼                    │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  B. ObjectType 定义（Palantir 原生概念，对应"实例的数据结构"）        │  │ │
│  │  │     ——  与 LinkType 平级，均为一等公民，需被注册/版本化/权限控制      │  │ │
│  │  │                                                                    │  │ │
│  │  │    属性字典（全局平台级）        │    值池候选（全局平台级）         │  │ │
│  │  │    ┌─────────────────────┐      │      ┌─────────────────────┐    │  │ │
│  │  │    │  OT_ATTRIBUTE        │ HAS_ │NDIDATE│_VALUE│( #11 )│    │  │ │
│  │  │    │  属性定义             │◀─────│────▶│  OT_ATTRIBUTE_VALUE│    │  │ │
│  │  │    │  §2.1.3              │      │      │  属性值             │    │  │ │
│  │  │    │  (ATTR_COLOR 等)     │      │      │  §2.1.4             │    │  │ │
│  │  │    └──────────▲──────────┘      │      │  (AV_BLACK 等)      │    │  │ │
│  │  │               │ (V4: 无 DECLARES_ATTRIBUTE，参见 §1.1.1)             │  │ │
│  │  │               │                                                       │  │ │
│  │  │    ┌──────────┴──────────┐    ┌────────────┐ ┌────────────┐         │  │ │
│  │  │    │  OT_CATEGORY        │    │ OT_BRAND   │ │            │         │  │ │
│  │  │    │  品类                │    │ 品牌       │ │            │         │  │ │
│  │  │    │  §2.1.5             │    │ §2.1.6    │ │            │         │  │ │
│  │  │    └─────────────────────┘    └────────────┘ │            │         │  │ │
│  │  │                                              │            │         │  │ │
│  │  │    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │  │ │
│  │  │    │OT_SPU      │ │OT_SKU      │ │OT_MERCHANT │ │OT_WAREHOUSE│    │  │ │
│  │  │    │ 标准产品   │ │ 库存单元   │ │ 商家       │ │ 仓库       │    │  │ │
│  │  │    │  §2.1.7    │ │  §2.1.8    │ │  §2.1.9    │ │  §2.1.10   │    │  │ │
│  │  │    └────────────┘ └────────────┘ └────────────┘ └────────────┘    │  │ │
│  │  │                                                                    │  │ │
│  │  │    ┌────────────┐ ┌────────────┐ ┌────────────────────────────┐  │  │ │
│  │  │    │OT_PRICE    │ │OT_INVENTORY│ │OT_MERCHANT_SKU（衍生）     │  │  │ │
│  │  │    │ 价格       │ │ 库存       │ │ SOLD_BY linkProperties 沉淀 │  │  │ │
│  │  │    │  §2.1.11   │ │  §2.1.12   │ │  §2.1.13                   │  │  │ │
│  │  │    └────────────┘ └────────────┘ └────────────────────────────┘  │  │ │
│  │  │                                                                    │  │ │
│  │  │  LinkType（与 ObjectType 平级，§1.1.1 完整清单，V4 共 11 个）     │  │ │
│  │  │  PARENT_OF / BELONGS_TO_CATEGORY / HAS_BRAND / GENERATES /        │  │ │
│  │  │  HAS_ATTR_VALUE / SOLD_BY / HAS_PRICE / HOLDS_INVENTORY /         │  │ │
│  │  │  LOCATED_AT / HAS_CANDIDATE_VALUE / TEMPLATE_REFERENCES_ATTR       │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                            │
│                                  │ 实例化（填入具体值）                       │
│                                  ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                第二层：Object Instance（Palantir 原生概念）                  │ │
│  │  ──────────────────────────────────────────────────────────────────────  │ │
│  │                                                                           │ │
│  │  ┌──────────────┐   USES_TEMPLATE   ┌──────────────┐                    │ │
│  │  │ Category     │◀───────────────────▶│ SPUTemplate  │  …… §2.2.1         │ │
│  │  │ "iPhone"     │     (V4 唯一路径)    │ "TMPL_IPHONE"│                    │ │
│  │  └──────┬───────┘                     └──────┬───────┘                    │ │
│  │         │                                    │ TEMPLATE_REFERENCES_ATTR   │ │
│  │         ▼                                    ▼                            │ │
│  │  ┌──────────────┐ HAS_BRAND ┌────────┐    ┌──────────────┐              │ │
│  │  │ SPU          │──────────▶│ Brand  │    │ AttributeValue│              │ │
│  │  │ "iPhone 16"  │           │ Apple  │    │ "黑色/128GB" │              │ │
│  │  │  §2.2.2      │           └────────┘    │  §2.2.x 新增  │              │ │
│  │  └──────┬───────┘                          └──────┬───────┘              │ │
│  │         │ GENERATES                               │                       │ │
│  │         ▼                                         ▼                       │ │
│  │  ┌──────────────┐ HAS_ATTR_VALUE      ┌──────────────┐                  │ │
│  │  │ SKU          │─────────────────────▶│ AttributeValue│  …… §2.2.3       │ │
│  │  │ "128G 黑色"  │                      │ "黑色/128GB" │                  │ │
│  │  │  §2.2.3      │                      └──────────────┘                  │ │
│  │  └──────┬───────┘                                                     │ │
│  │         │ SOLD_BY (M:N, linkProps 沉淀为 OT_MERCHANT_SKU)              │ │
│  │         ▼                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │ MerchantSKU  │─▶│ Price        │  │ Inventory    │  …… §2.2.4       │ │
│  │  │ (每商家每SKU) │  │ 销售价/划线价 │  │ 多仓库明细    │                  │ │
│  │  └──────┬───────┘  └──────────────┘  └──────┬───────┘                  │ │
│  │         │                                    │ LOCATED_AT               │ │
│  │         ▼                                    ▼                          │ │
│  │  ┌──────────────┐                    ┌──────────────┐                  │ │
│  │  │ Merchant     │                    │ Warehouse    │                  │ │
│  │  │ §2.2.5       │                    │ §2.2.6       │                  │ │
│  │  └──────────────┘                    └──────────────┘                  │ │
│  │                                                                           │ │
│  │  【属性三层模型示意 — 第二层实例如何引用属性字典】                           │ │
│  │                                                                           │ │
│  │       SPU "iPhone 16"           SKU "128G 黑色"                          │ │
│  │             │                         │                                  │ │
│  │             │ HAS_ATTR_VALUE          │ HAS_ATTR_VALUE                   │ │
│  │             │ (#5, 实例↔值)            │ (#5, 实例↔值)                    │ │
│  │             ▼                         ▼                                  │ │
│  │       ┌──────────────────────────────────────┐                           │ │
│  │       │   OT_ATTRIBUTE_VALUE（值池候选）        │                           │ │
│  │       │   AV_BLACK / AV_128GB / AV_APPLE    │                           │ │
│  │       └────────────────────┬─────────────────┘                           │ │
│  │                            │ HAS_CANDIDATE_VALUE (#11)                  │ │
│  │                            ▼                                            │ │
│  │       ┌──────────────────────────────────────┐                           │ │
│  │       │   OT_ATTRIBUTE（属性字典）             │                           │ │
│  │       │   ATTR_COLOR / ATTR_CAPACITY / ...  │                           │ │
│  │       └────────────────────┬─────────────────┘                           │ │
│  │                            │ TEMPLATE_REFERENCES_ATTR (#12, linkProps  │ │
│  │                            │ 上的 allowed_value_refs 限制值池子集)      │ │
│  │                            ▼                                            │ │
│  │                   OT_SPU_TEMPLATE / OT_SKU_TEMPLATE                     │ │
│  │                                                                            │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**说明**：
- 第一层 A（模板类型）→ 第一层 B（ObjectType）：是「驱动关系」，模板规定 ObjectType 应包含哪些属性
- 第一层 B → 第二层：是「实例化关系」，ObjectType 定义是 schema，实例是 schema 的一行
- LinkType 跨越第一层与第二层：LinkType 的两端是 ObjectType，LinkType 的实例是 Object Instance 之间的边
- OT_MERCHANT_SKU 是 SOLD_BY LinkType 的 linkProperties 沉淀物（详见 §2.1.15）

---

## 二、数据与映射构建方案

### 2.1 第一层元数据的建模

> **本节说明**：第一层包含**两套**类型定义：
> - **模板类型**（A）：OT_SPU_TEMPLATE / OT_SKU_TEMPLATE — 电商特有的「元数据的元数据」，规定某类 ObjectType 应有哪些属性
> - **ObjectType**（B）：OT_CATEGORY / OT_BRAND / OT_ATTRIBUTE / OT_ATTRIBUTE_VALUE / OT_SPU / OT_SKU / OT_MERCHANT / OT_WAREHOUSE / OT_PRICE / OT_INVENTORY / OT_MERCHANT_SKU — Palantir 原生概念，对应实例的数据结构
>
> **重要区分**：OT_SPU ≠ OT_SPU_TEMPLATE。OT_SPU 是 ObjectType 定义（表格的列），OT_SPU_TEMPLATE 是驱动它生成的规则（表格模板的 Word 模板文件）。

#### 2.1.1 SPU 模板类型 (OT_SPU_TEMPLATE)

```json
{
  "object_type": "SPUTemplateType",
  "type_id": "OT_SPU_TEMPLATE",
  "description": "SPU 模板，规定某类 SPU 实例应具备哪些属性列。是「元数据的元数据」。",
  "properties": {
    "template_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "模板唯一标识"
    },
    "template_name": {
      "type": "STRING",
      "is_required": true
    },
    "applicable_categories": {
      "type": "ARRAY[STRING]",
      "references": "OT_CATEGORY",
      "description": "适用的品类列表（支持多品类共用模板）"
    }
  },

  "required_attribute_refs": {
    "description": "必填属性组：引用 OT_ATTRIBUTE 全局属性字典，引用即继承其 data_type / validation_rules",
    "items": [
      {
        "attr_id": "ATTR_BRAND",
        "attr_ref": "OT_ATTRIBUTE/ATTR_BRAND",
        "cardinality": "SINGLE",
        "overrides": {
          "must_be_in_category_whitelist": true
        }
      },
      {
        "attr_id": "ATTR_MODEL",
        "attr_ref": "OT_ATTRIBUTE/ATTR_MODEL",
        "cardinality": "SINGLE"
      },
      {
        "attr_id": "ATTR_SCREEN",
        "attr_ref": "OT_ATTRIBUTE/ATTR_SCREEN",
        "cardinality": "SINGLE"
      },
      {
        "attr_id": "ATTR_BATTERY",
        "attr_ref": "OT_ATTRIBUTE/ATTR_BATTERY",
        "cardinality": "SINGLE"
      }
    ]
  },

  "optional_attribute_refs": {
    "description": "可选属性组：可选填，引用 OT_ATTRIBUTE",
    "items": [
      {
        "attr_id": "ATTR_5G",
        "attr_ref": "OT_ATTRIBUTE/ATTR_5G",
        "cardinality": "SINGLE"
      }
    ]
  },

  "sales_attribute_rules": {
    "description": "销售属性规则：引用 OT_ATTRIBUTE 作为组合键，并限制可选 OT_ATTRIBUTE_VALUE 子集",
    "items": [
      {
        "attr_id": "ATTR_COLOR",
        "attr_ref": "OT_ATTRIBUTE/ATTR_COLOR",
        "is_combination_key": true,
        "allowed_value_refs": [
          "OT_ATTRIBUTE_VALUE/AV_BLACK",
          "OT_ATTRIBUTE_VALUE/AV_WHITE",
          "OT_ATTRIBUTE_VALUE/AV_PINK",
          "OT_ATTRIBUTE_VALUE/AV_BLUE"
        ],
        "description": "颜色为销售属性，可选值为平台字典中颜色属性下的 4 个值"
      },
      {
        "attr_id": "ATTR_CAPACITY",
        "attr_ref": "OT_ATTRIBUTE/ATTR_CAPACITY",
        "is_combination_key": true,
        "allowed_value_refs": [
          "OT_ATTRIBUTE_VALUE/AV_128GB",
          "OT_ATTRIBUTE_VALUE/AV_256GB",
          "OT_ATTRIBUTE_VALUE/AV_512GB"
        ]
      }
    ]
  }
}
```

> **设计要点（驱动的三层语义）**：
> 1. 模板不再写死属性，而是**引用**全局 OT_ATTRIBUTE 字典（`attr_ref: OT_ATTRIBUTE/ATTR_BRAND`）。同一 attr_id 全平台唯一，新增品类时不必重复定义「颜色」属性。
> 2. `allowed_value_refs` 让模板可限制属性值的取值范围（手机模板允许黑色，T 恤模板不允许黑色，因为 T 恤有「图案」属性但「颜色」值池可能不同）。
> 3. `overrides` 让模板在继承全局属性后可定制校验规则（手机模板要求品牌必须在品类白名单）。
>
> **`scope` 三分法与电商产品数据模型 v1.0 的概念映射：
>
> | OT_SPU_TEMPLATE `scope` | 对应电商数据模型 | 说明 | 示例 |
> |-------------------------|----------------|------|------|
> | **`required`** | 基本属性（Basic Attribute） | SPU 级别的必填规格参数，不参与 SKU 组合，在 SPU 详情页展示 | 屏幕尺寸（6.1英寸）、电池容量（3561mAh）、芯片（A18）、运行内存（8GB） |
> | **`optional`** | 可选属性（Optional Attribute） | SPU 级别的可选规格参数，商家可填可不填 | 售后服务（全国联保）、上市年份（2025） |
> | **`sales`** | 销售属性（Sales Attribute） | **参与 SKU 笛卡尔积组合**的属性，**驱动 OT_SKU 自动生成** | 机身颜色（5色 × 4容量 = 20 SKU）、存储容量、网络制式、标配类型 |
>
> **关键区别**：
> - `scope=sales` 且 `is_combination_key=true` 的属性组合，直接决定 SKU 笛卡尔积数量（如 5 颜色 × 4 容量 × 1 制式 × 1 类型 = 20 个 SKU）
> - `scope=required/optional` 的属性值记录在 SPU 实例的 `specifications` / `basic_attributes` 中，**不生成独立 SKU**
> - 这与电商产品数据模型 v1.0 §2.4/§2.5 完全一致：ATTR001~004（颜色/容量/制式/标配类型）是销售属性，ATTR006~008（上市年份/屏幕尺寸/电池容量）是基本属性

#### 2.1.2 SKU 模板类型 (OT_SKU_TEMPLATE)

```json
{
  "object_type": "SKUTemplateType",
  "type_id": "OT_SKU_TEMPLATE",
  "description": "SKU 的类型定义，由 SPU 模板中的销售属性规则驱动生成",
  "properties": {
    "template_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "template_name": {
      "type": "STRING",
      "is_required": true
    },
    "parent_spu_template_ref": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_SPU_TEMPLATE",
      "description": "引用父级 SPU 模板（SKU 模板是 SPU 模板的销售属性子集）"
    },
    "applicable_categories": {
      "type": "ARRAY[STRING]",
      "references": "OT_CATEGORY",
      "description": "适用的品类列表（由父 SPU 模板推导，可裁剪）"
    },
    "sales_attribute_rules": {
      "type": "ARRAY[OBJECT]",
      "description": "销售属性组合规则（引用 OT_ATTRIBUTE，并通过 allowed_value_refs 限制 OT_ATTRIBUTE_VALUE 子集）",
      "items": {
        "attr_id": {
          "type": "STRING",
          "references": "OT_ATTRIBUTE",
          "description": "引用 OT_ATTRIBUTE 全局属性字典"
        },
        "attr_ref": {
          "type": "STRING",
          "references": "OT_ATTRIBUTE",
          "description": "规范化引用（如 OT_ATTRIBUTE/ATTR_COLOR）"
        },
        "is_combination_key": {
          "type": "BOOLEAN",
          "default": false,
          "description": "是否参与 SKU 笛卡尔积组合（true 即为「销售属性」）"
        },
        "allowed_value_refs": {
          "type": "ARRAY[STRING]",
          "references": "OT_ATTRIBUTE_VALUE",
          "description": "本模板允许的 OT_ATTRIBUTE_VALUE 引用列表（值池子集）"
        },
        "options_source": {
          "type": "ENUM",
          "values": ["FROM_ALLOWED_VALUE_REFS", "DYNAMIC_FROM_SPU_INSTANCE"],
          "description": "选项来源：allowed_value_refs 静态限定 / SPU 实例动态指定"
        }
      }
    },
    "auto_generate_on_spu_create": {
      "type": "BOOLEAN",
      "default": true,
      "description": "SPU 创建时是否自动生成 SKU 实例"
    }
  }
}
```

> **设计要点**：OT_SKU_TEMPLATE 的 `sales_attribute_rules` 与 OT_SPU_TEMPLATE 完全对齐 —— 都引用 OT_ATTRIBUTE，并通过 `allowed_value_refs` 限制值池子集。这保证了"SPU 实例下的属性值"与"SKU 实例下的销售属性值"必须从同一值池选取，不会出现"SPU 选了 T 恤专属色，但 SKU 选手机色"这种跨品类串味。

> **元数据层结构说明**：第一层实际上包含**两套平行的 Object Type**，而非一套：
> - **模板类型**（Template）：OT_SPU_TEMPLATE / OT_SKU_TEMPLATE，用于定义"规则"和"结构"，本质上是元数据的元数据
> - **实例类型**（Instance）：OT_SPU / OT_SKU 等，用于定义"实例的数据结构"，由对应模板驱动生成
>
> 两者关系：OT_SPU_TEMPLATE 规定 OT_SPU 拥有哪些属性列，OT_SKU_TEMPLATE 规定 OT_SKU 拥有哪些属性列。

#### 2.1.3 属性类型定义 (OT_ATTRIBUTE)

```json
{
  "object_type": "AttributeType",
  "type_id": "OT_ATTRIBUTE",
  "description": "属性定义，平台全局属性字典。一条记录 = 一个属性词条（如「颜色」「容量」「内存」）。",
  "properties": {
    "attr_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "全局唯一，例如 ATTR_COLOR / ATTR_CAPACITY"
    },
    "attr_name": {
      "type": "STRING",
      "is_required": true,
      "description": "属性展示名，如「颜色」"
    },
    "data_type": {
      "type": "ENUM",
      "values": [
        "STRING",
        "INTEGER",
        "DECIMAL",
        "BOOLEAN",
        "ENUM",
        "REFERENCE",
        "ARRAY"
      ],
      "is_required": true
    },
    "scope": {
      "type": "ENUM",
      "values": ["PLATFORM_GLOBAL", "CATEGORY_SCOPED", "TEMPLATE_LOCAL"],
      "default": "PLATFORM_GLOBAL",
      "description": "属性作用域：PLATFORM_GLOBAL（所有品类通用，如「颜色」） / CATEGORY_SCOPED（指定品类，如「电池容量」仅手机/笔记本） / TEMPLATE_LOCAL（模板自定义私有属性）"
    },
    "value_pool_mode": {
      "type": "ENUM",
      "values": ["FIXED_GLOBAL", "EXTENSIBLE", "RESTRICTED_BY_TEMPLATE"],
      "default": "RESTRICTED_BY_TEMPLATE",
      "description": "值池模式：FIXED_GLOBAL（值池全局固定）/ EXTENSIBLE（任何模板可扩展值）/ RESTRICTED_BY_TEMPLATE（每个模板自行限制子集）"
    },
    "validation_rules": {
      "type": "OBJECT",
      "description": "验证规则（根据data_type动态定义）"
    },
    "default_value": {
      "type": "ANY",
      "description": "默认值"
    }
  }
}
```

> **设计要点（与 OT_ATTRIBUTE_VALUE 的关系）**：
> - `OT_ATTRIBUTE` 是属性字典（一行 = 一个词条），`OT_ATTRIBUTE_VALUE` 是值池（一行 = 一个可选值）。两者通过 LinkType `HAS_CANDIDATE_VALUE`（§1.1.1 中 LinkType #10）连接。
> - `scope` 决定该属性是「所有品类都能用」（颜色）还是「只有某品类能用」（电池容量）。
> - `value_pool_mode` 决定值池是平台统一管理还是各模板私有限制 —— 这是 v2 文档中缺失的关键设计。

#### 2.1.4 属性值类型定义 (OT_ATTRIBUTE_VALUE)

```json
{
  "object_type": "AttributeValueType",
  "type_id": "OT_ATTRIBUTE_VALUE",
  "description": "属性值候选池的成员。一条记录 = 一个可选值（如「黑色」「128GB」）。由 OT_ATTRIBUTE 通过 HAS_CANDIDATE_VALUE link 持有。",
  "properties": {
    "attr_value_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "全局唯一，如 AV_BLACK / AV_128GB"
    },
    "attr_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_ATTRIBUTE",
      "description": "所属属性定义（一个属性下可有多个值候选）"
    },
    "value": {
      "type": "STRING",
      "is_required": true,
      "description": "取值文本（如「黑色」「128GB」）"
    },
    "alias": {
      "type": "STRING",
      "description": "别名（用于搜索 NLP 联想）"
    },
    "pool_owner": {
      "type": "ENUM",
      "values": ["PLATFORM_POOL", "CATEGORY_SCOPED_POOL", "TEMPLATE_RESTRICTED_POOL"],
      "default": "PLATFORM_POOL",
      "description": "值池归属：PLATFORM_POOL（平台全局共享）/ CATEGORY_SCOPED_POOL（仅某品类可见）/ TEMPLATE_RESTRICTED_POOL（仅某模板允许）"
    },
    "is_default": {
      "type": "BOOLEAN",
      "default": false,
      "description": "是否为该属性下的默认选中值"
    },
    "sort_order": {
      "type": "INTEGER",
      "default": 0,
      "description": "在属性值列表中的排序"
    },
    "display_meta": {
      "type": "OBJECT",
      "description": "展示元数据（与业务数据模型对齐，ATTR_COLOR 类属性有 color_hex，ATTR_SIZE 类有尺码对照表等）",
      "properties": {
        "color_hex": {
          "type": "STRING",
          "description": "颜色十六进制值（适用于颜色类属性，如 ATTR_COLOR 的值「黑色」= #1C1C1E，「白色」= #F5F5F7）"
        },
        "image_url": {
          "type": "STRING",
          "description": "属性值对应的展示图片（如颜色卡图片、尺码对照图）"
        },
        "size_guide": {
          "type": "STRING",
          "description": "尺码对照表 URL（适用于服装类尺码属性）"
        },
        "extra_data": {
          "type": "JSON",
          "description": "属性值扩展数据（如电池容量的单位 mAh、屏幕尺寸的单位 英寸，均在此存储）"
        }
      }
    }
  }
}
```

> **设计要点（与 OT_ATTRIBUTE / 商品层的关系）**：
> 1. `attr_id` FK 表明每个值必须挂在一个属性下 —— `OT_ATTRIBUTE_VALUE` 是属性字典的成员，不允许"孤儿值"。
> 2. `pool_owner` 决定该值是平台通用（如「黑色」可被手机、T 恤、家居同时引用）还是某品类专用（如「1TB」只对存储类商品有意义）。同名字面值的值在不同 scope 下可以有不同的 attr_value_id，例如：
>    - `AV_TSHIRT_BLACK` （pool_owner=TEMPLATE_RESTRICTED_POOL，专属 T 恤墨黑色 RGB=#1A1A1A）
>    - `AV_PHONE_BLACK` （pool_owner=PLATFORM_POOL，手机通用黑 RGB=#2C2C2E）
> 3. `display_meta` 扩展字段与**电商产品数据模型 v1.0**对齐：颜色类属性（ATTR_COLOR）对应 `color_hex`（十六进制色值，如「黑色」= #1C1C1E），尺码类属性对应 `size_guide`（尺码对照表 URL），数值类属性值对应 `extra_data`（如电池容量值「3561mAh」的 `{"unit": "mAh", "numeric_value": 3561}`）。
> 4. 商品实例（SPU/SKU）通过 `HAS_ATTR_VALUE` LinkType（§1.1.1 #5）引用具体的 attr_value_id，确保取值严格落在模板的 `allowed_value_refs` 内。

#### 2.1.5 品类类型定义 (OT_CATEGORY)

> **V4 路线 B 设计**：Category 是「业务归属层」，只决定 SPU 属于哪个业务分类以及引用哪个模板，**不再独立声明属性**。所有属性声明（包括必填、销售属性、值池限制、校验规则）都集中在 `OT_SPU_TEMPLATE` 上，Category 通过 `spu_template_ref` 间接继承这些规则。详见 §2.2.8 案例对比。

```json
{
  "object_type": "CategoryType",
  "type_id": "OT_CATEGORY",
  "description": "品类，业务导航分类。V4 路线 B 下，Category 不再 DECLARES_ATTRIBUTE，仅承担「业务归属 + 模板引用」职责。",
  "properties": {
    "category_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "品类唯一标识"
    },
    "category_name": {
      "type": "STRING",
      "is_required": true,
      "description": "品类名称"
    },
    "parent_category_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_CATEGORY",
      "description": "父品类ID（仅用于层级导航，不传递属性继承）"
    },
    "level": {
      "type": "INTEGER",
      "is_required": true,
      "description": "品类层级深度（用于类目树渲染）"
    },
    "path": {
      "type": "STRING",
      "description": "品类完整路径，如 /1001/1002/1003（用于类目页 URL 与面包屑）"
    },
    "spu_template_ref": {
      "type": "STRING",
      "is_foreign_key": true,
      "is_required": true,
      "references": "OT_SPU_TEMPLATE",
      "description": "V4 关键字段：Category 必须挂载一个 SPU 模板。Category 不再独立声明属性，所有属性需求通过 spu_template_ref → OT_SPU_TEMPLATE.TEMPLATE_REFERENCES_ATTR 间接声明。"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "inactive", "deprecated"],
      "default": "active"
    }
  }
}
```

> **V4 路线 B 的几个关键设计决策**：
> 1. **`spu_template_ref` 升级为强制字段**：V3 是 optional，V4 强制要求每个 Category 必须挂一个 SPU 模板，避免出现"没有模板的孤立品类"。
> 2. **删除 `inheritance_chain` 块**：V3 文档曾出现的"parent_chain / inherited_properties / overridable"被删除 —— Category 的属性继承路径完全由 `spu_template_ref` 决定，无需在 Category 上维护一份独立的继承链元数据。
> 3. **多 Category 引用同一 Template 是常态**：例如「iPhone」和「Android」两个 Category 可以同时引用 `TMPL_SMARTPHONE`，模板本身在 `TEMPLATE_REFERENCES_ATTR` 内支持微调。这样既保证品类异质性（业务人员只需新增 Category），又保证属性集中管理（属性需求收敛在 Template）。
> 4. **子 Category 可切换 spu_template_ref**：例如「配件 (1005)」是「手机数码 (1001)」的子品类，但它应引用 `TMPL_ACCESSORY` 而非 `TMPL_PHONE`。子 Category 不再"继承父 Category 的属性"，而是"挂自己的模板"。

#### 2.1.6 品牌类型定义 (OT_BRAND)

```json
{
  "object_type": "BrandType",
  "type_id": "OT_BRAND",
  "description": "品牌，描述制造商品牌的实体。",
  "properties": {
    "brand_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "brand_name": {
      "type": "STRING",
      "is_required": true
    },
    "country": {
      "type": "STRING",
      "description": "品牌所属国家/地区"
    },
    "logo_url": {
      "type": "STRING",
      "description": "品牌 Logo URL"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "inactive", "blacklisted"],
      "default": "active"
    }
  }
}
```

#### 2.1.7 SPU 的 ObjectType 定义 (OT_SPU)

> **关键区分**：OT_SPU 是 **ObjectType 定义**（规定 SPU 实例有哪些字段），不是模板。OT_SPU_TEMPLATE 是驱动它生成的规则。

```json
{
  "object_type": "SPUInstanceType",
  "type_id": "OT_SPU",
  "description": "标准产品实例类型，由 OT_SPU_TEMPLATE 驱动生成",
  "driven_by_template": "OT_SPU_TEMPLATE",
  "properties": {
    "spu_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "SPU唯一标识"
    },
    "spu_name": {
      "type": "STRING",
      "is_required": true,
      "description": "SPU名称"
    },
    "template_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_SPU_TEMPLATE",
      "description": "引用模板ID（决定该SPU拥有哪些属性）"
    },
    "brand_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_BRAND",
      "description": "归属品牌"
    },
    "primary_category_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_CATEGORY",
      "description": "主品类"
    },
    "description": {
      "type": "TEXT",
      "description": "产品描述"
    },
    "specifications": {
      "type": "JSON",
      "description": "规格参数JSON，字段由template决定"
    },
    "images": {
      "type": "ARRAY[STRING]",
      "description": "产品图片URL列表"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "PENDING_REVIEW", "ACTIVE", "OFFLINE", "DEPRECATED"],
      "default": "DRAFT",
      "description": "SPU生命周期状态"
    },
    "created_at": {
      "type": "TIMESTAMP",
      "is_required": true
    },
    "updated_at": {
      "type": "TIMESTAMP",
      "is_required": true
    }
  },
  "generated_links": {
    "GENERATES": {
      "link_id": "GENERATES",
      "target": "OT_SKU",
      "cardinality": "ONE_TO_MANY",
      "description": "SPU生成SKU实例"
    },
    "BELONGS_TO_CATEGORY": {
      "link_id": "BELONGS_TO_CATEGORY",
      "target": "OT_CATEGORY",
      "cardinality": "MANY_TO_MANY",
      "description": "SPU归属品类（主品类+关联品类）"
    },
    "HAS_BRAND": {
      "link_id": "HAS_BRAND",
      "target": "OT_BRAND",
      "cardinality": "MANY_TO_ONE",
      "description": "SPU归属品牌"
    }
  }
}
```

#### 2.1.8 SKU 的 ObjectType 定义 (OT_SKU)

> **关键区分**：OT_SKU 是 **ObjectType 定义**（规定 SKU 实例有哪些字段），不是实例。OT_SKU_TEMPLATE 是驱动它生成的规则。

```json
{
  "object_type": "SKUInstanceType",
  "type_id": "OT_SKU",
  "description": "库存单元实例类型，由 OT_SKU_TEMPLATE 驱动生成",
  "driven_by_template": "OT_SKU_TEMPLATE",
  "properties": {
    "sku_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "SKU唯一标识"
    },
    "sku_name": {
      "type": "STRING",
      "is_required": true,
      "description": "SKU名称（由SPU名称+销售属性拼接）"
    },
    "spu_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_SPU",
      "description": "归属SPU"
    },
    "sales_attrs_hash": {
      "type": "STRING",
      "is_required": true,
      "is_unique": true,
      "description": "销售属性组合的哈希值，用于唯一性约束和检索"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "PENDING", "ONLINE", "OFFLINE", "BANNED"],
      "default": "DRAFT"
    },
    "created_at": {
      "type": "TIMESTAMP",
      "is_required": true
    }
  },
  "generated_links": {
    "GENERATED_FROM_SPU": {
      "link_id": "GENERATES",
      "target": "OT_SPU",
      "cardinality": "MANY_TO_ONE",
      "description": "SKU归属SPU（GENERATES 的反向）"
    },
    "HAS_ATTR_VALUE": {
      "link_id": "HAS_ATTR_VALUE",
      "target": "OT_ATTRIBUTE_VALUE",
      "cardinality": "MANY_TO_MANY",
      "description": "SKU关联属性值"
    },
    "SOLD_BY": {
      "link_id": "SOLD_BY",
      "target": "OT_MERCHANT",
      "cardinality": "MANY_TO_MANY",
      "description": "SKU被商家认领销售（LinkProperties 沉淀为 OT_MERCHANT_SKU）"
    }
  }
}
```

#### 2.1.9 商家类型定义 (OT_MERCHANT)

```json
{
  "object_type": "MerchantType",
  "type_id": "OT_MERCHANT",
  "description": "商家实体。",
  "properties": {
    "merchant_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "merchant_name": {
      "type": "STRING",
      "is_required": true
    },
    "merchant_type": {
      "type": "ENUM",
      "values": ["self_operated", "flagship", "specialty", "personal"],
      "default": "specialty",
      "description": "商家类型"
    },
    "contact_phone": {
      "type": "STRING",
      "description": "联系电话"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "suspended", "closed"],
      "default": "active"
    },
    "created_at": {
      "type": "TIMESTAMP",
      "is_required": true
    }
  }
}
```

#### 2.1.10 仓库类型定义 (OT_WAREHOUSE)

```json
{
  "object_type": "WarehouseType",
  "type_id": "OT_WAREHOUSE",
  "description": "仓库实体，库存按仓库独立管理。",
  "properties": {
    "warehouse_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "warehouse_name": {
      "type": "STRING",
      "is_required": true
    },
    "location": {
      "type": "STRING",
      "description": "仓库地址（行政区或经纬度）"
    },
    "warehouse_type": {
      "type": "ENUM",
      "values": ["self_operated", "third_party", "merchant_managed"],
      "default": "self_operated"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "inactive", "maintenance"],
      "default": "active"
    }
  }
}
```

#### 2.1.11 价格类型定义 (OT_PRICE)

```json
{
  "object_type": "PriceType",
  "type_id": "OT_PRICE",
  "description": "价格实体，对应 MerchantSKU 的一段价格记录。",
  "properties": {
    "price_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "merchant_sku_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_MERCHANT_SKU",
      "description": "所属商家SKU"
    },
    "price_type": {
      "type": "ENUM",
      "values": ["sale", "original", "cost", "member", "promotion"],
      "default": "sale",
      "description": "价格类型"
    },
    "amount": {
      "type": "DECIMAL",
      "is_required": true,
      "validation": {"min": 0},
      "description": "价格金额（单位：元）"
    },
    "currency": {
      "type": "STRING",
      "default": "CNY"
    },
    "effective_from": {
      "type": "TIMESTAMP",
      "description": "生效时间"
    },
    "effective_to": {
      "type": "TIMESTAMP",
      "description": "失效时间"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "scheduled", "expired"],
      "default": "active"
    }
  }
}
```

#### 2.1.12 库存类型定义 (OT_INVENTORY)

```json
{
  "object_type": "InventoryType",
  "type_id": "OT_INVENTORY",
  "description": "库存实体，按仓库维度的库存明细。",
  "properties": {
    "inventory_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "merchant_sku_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_MERCHANT_SKU",
      "description": "所属商家SKU"
    },
    "warehouse_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_WAREHOUSE",
      "description": "所属仓库"
    },
    "available": {
      "type": "INTEGER",
      "default": 0,
      "description": "可用库存"
    },
    "reserved": {
      "type": "INTEGER",
      "default": 0,
      "description": "预占库存（下单未支付）"
    },
    "alert_threshold": {
      "type": "INTEGER",
      "default": 0,
      "description": "库存预警阈值"
    },
    "updated_at": {
      "type": "TIMESTAMP",
      "is_required": true
    }
  }
}
```

#### 2.1.13 商家 SKU 类型定义 (OT_MERCHANT_SKU)

> **来源说明**：OT_MERCHANT_SKU 实质是 SOLD_BY LinkType 的 linkProperties 沉淀出的独立 ObjectType。其 PK 与 SOLD_BY link 的 PK 同构（`merchant_sku_id`）。

```json
{
  "object_type": "MerchantSKUInstanceType",
  "type_id": "OT_MERCHANT_SKU",
  "description": "商家SKU实例，承载 SOLD_BY LinkType 的 linkProperties",
  "is_derived_from_link": "SOLD_BY",
  "properties": {
    "merchant_sku_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "商家侧SKU唯一标识"
    },
    "sku_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_SKU",
      "description": "平台SKU"
    },
    "merchant_id": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_MERCHANT",
      "description": "归属商家"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "ONLINE", "OFFLINE", "BANNED"],
      "default": "DRAFT"
    },
    "listing_time": {
      "type": "TIMESTAMP",
      "description": "上架时间"
    }
  },
  "generated_links": {
    "DERIVED_FROM_SOLD_BY": {
      "link_id": "SOLD_BY",
      "target": "(OT_SKU, OT_MERCHANT)",
      "description": "由 SOLD_BY linkProperties 沉淀而成"
    },
    "HAS_PRICE": {
      "link_id": "HAS_PRICE",
      "target": "OT_PRICE",
      "cardinality": "ONE_TO_MANY",
      "description": "商家SKU的多价格记录（销售价/划线价/成本价/会员价）"
    },
    "HOLDS_INVENTORY": {
      "link_id": "HOLDS_INVENTORY",
      "target": "OT_INVENTORY",
      "cardinality": "ONE_TO_MANY",
      "description": "商家SKU的多仓库库存"
    }
  }
}
```

### 2.2 第二层实例数据的建模

#### 2.2.1 品类实例 (Category Instance)

```json
{
  "object_instance": "Category",
  "instance_id": "1003",
  "type_id": "OT_CATEGORY",
  "type_definition_ref": "§2.1.5",
  "properties": {
    "category_id": "1003",
    "category_name": "iPhone",
    "parent_category_id": "1002",
    "level": 3,
    "path": "/1001/1002/1003",
    "spu_template_ref": "TMPL_IPHONE",
    "status": "active"
  }
  // V4 路线 B: 删除了 V3 的 inherited_values 块。
  // Category 不再独立继承属性；属性需求由 spu_template_ref 指向的 TMPL_IPHONE 模板声明。
  // 若需查看 iPhone 品类下 SPU 需具备的属性，请查询：
  //   MATCH (t:SPUTemplate {template_id: 'TMPL_IPHONE'})-[:TEMPLATE_REFERENCES_ATTR]->(a:Attribute)
  //   RETURN t, a
}
```

#### 2.2.2 SPU 实例 (SPU Instance)

> 第二层的"实例"是 **Object Instance**，对应第一层定义的 **Object Type**（如 OT_SPU）。一个 SPU 实例 = OT_SPU 类型的一条行记录。

```json
{
  "object_instance": "SPU Instance",
  "instance_id": "SPU20260001",
  "type_id": "OT_SPU",
  "type_definition_ref": "§2.1.7",
  "template_ref": "TMPL_IPHONE",
  "template_definition_ref": "§2.1.1",
  "properties": {
    "spu_id": "SPU20260001",
    "spu_name": "Apple iPhone 16",
    "template_id": "TMPL_IPHONE",
    "brand_id": "B001",
    "primary_category_id": "1003",
    "description": "官方正品iPhone 16",
    "specifications": {
      "chip": "A18",
      "screen": "6.1英寸",
      "battery": "3561mAh"
    },
    "images": ["主图1.jpg", "详情图1.jpg"],
    "status": "DRAFT",
    "created_at": "2026-07-26T10:00:00Z",
    "updated_at": "2026-07-26T10:00:00Z"
  },
  "attribute_values": {
    "ATTR001": "Apple",
    "ATTR002": "iPhone 16",
    "ATTR007": "6.1英寸",
    "ATTR008": "3561mAh",
    "ATTR009": "2025"
  },
  "derived_sku_count": 20,
  "status_note": "待商家填充价格"
}
```

#### 2.2.3 SKU 实例 (SKU Instance)

> SKU 实例对应 OT_SKU 类型（§2.1.8）。`merchant_bindings` 里的价格和库存是 SOLD_BY LinkType 的 linkProperties 沉淀（见 OT_MERCHANT_SKU §2.1.13）。

```json
{
  "object_instance": "SKU Instance",
  "instance_id": "SKU202600001",
  "type_id": "OT_SKU",
  "type_definition_ref": "§2.1.8",
  "template_ref": "TMPL_IPHONE_SKU",
  "template_definition_ref": "§2.1.2",
  "parent_spu_ref": "SPU20260001",
  "properties": {
    "sku_id": "SKU202600001",
    "sku_name": "iPhone 16 128GB 黑色 公开版",
    "spu_id": "SPU20260001",
    "sales_attrs_hash": "<color:black|capacity:128GB|standard:public>",
    "status": "ONLINE",
    "created_at": "2026-07-26T10:00:00Z"
  },
  "sales_attrs": {
    "颜色": "黑色",
    "容量": "128GB",
    "制式": "公开版"
  },
  "_links": {
    "GENERATED_FROM_SPU": [
      {
        "target": "SPU20260001",
        "link_instance_id": "LINK001"
      }
    ],
    "SOLD_BY": [
      {
        "target": "M20260001",
        "merchant_sku_id": "MSKU001",
        "status": "ONLINE"
      },
      {
        "target": "M20260002",
        "merchant_sku_id": "MSKU002",
        "status": "ONLINE"
      }
    ]
  }
}
```

> 注：`SOLD_BY` link 上的 `merchant_sku_id`、`status` 是 linkProperties 沉淀。`salePrice` 等真正价格字段位于 OT_MERCHANT_SKU → OT_PRICE 的 `HAS_PRICE` link（见 §2.2.4）。

#### 2.2.4 商家 SKU 实例 (MerchantSKU Instance)

```json
{
  "object_instance": "MerchantSKU Instance",
  "instance_id": "MSKU001",
  "type_id": "OT_MERCHANT_SKU",
  "type_definition_ref": "§2.1.13",
  "properties": {
    "merchant_sku_id": "MSKU001",
    "sku_id": "SKU202600001",
    "merchant_id": "M20260001",
    "status": "ONLINE",
    "listing_time": "2026-07-26T10:00:00Z"
  },
  "_links": {
    "HAS_PRICE": [
      {
        "target": "PRICE001",
        "price_type": "sale",
        "amount": 6299.00,
        "status": "active"
      },
      {
        "target": "PRICE002",
        "price_type": "original",
        "amount": 6999.00,
        "status": "active"
      }
    ],
    "HOLDS_INVENTORY": [
      {
        "target": "INV001",
        "warehouse_id": "WH001",
        "available": 50,
        "reserved": 5,
        "alert_threshold": 10
      }
    ]
  }
}
```

#### 2.2.5 商家实例 (Merchant Instance)

```json
{
  "object_instance": "Merchant",
  "instance_id": "M20260001",
  "type_id": "OT_MERCHANT",
  "type_definition_ref": "§2.1.9",
  "properties": {
    "merchant_id": "M20260001",
    "merchant_name": "店小二旗舰店",
    "merchant_type": "flagship",
    "contact_phone": "400-100-1001",
    "status": "active",
    "created_at": "2026-07-26T10:00:00Z"
  }
}
```

#### 2.2.6 仓库实例 (Warehouse Instance)

```json
{
  "object_instance": "Warehouse",
  "instance_id": "WH001",
  "type_id": "OT_WAREHOUSE",
  "type_definition_ref": "§2.1.10",
  "properties": {
    "warehouse_id": "WH001",
    "warehouse_name": "华东中心仓",
    "location": "上海市青浦区",
    "warehouse_type": "self_operated",
    "status": "active"
  }
}
```

#### 2.2.7 库存实例 (Inventory Instance)

```json
{
  "object_instance": "Inventory",
  "instance_id": "INV001",
  "type_id": "OT_INVENTORY",
  "type_definition_ref": "§2.1.12",
  "properties": {
    "inventory_id": "INV001",
    "merchant_sku_id": "MSKU001",
    "warehouse_id": "WH001",
    "available": 50,
    "reserved": 5,
    "alert_threshold": 10,
    "updated_at": "2026-07-26T10:00:00Z"
  },
  "_links": {
    "LOCATED_AT": [
      {
        "target": "WH001"
      }
    ],
    "HOLDS_INVENTORY": [
      {
        "source": "MSKU001"
      }
    ]
  }
}
```

#### 2.2.8 属性三层模型协同示例（iPhone vs T 恤双案例）

> **与电商产品数据模型 v1.0 对齐说明**：本节的 iPhone 案例与电商产品数据模型 §2 完整对齐：
> - **销售属性**（scope=sales）= ATTR001 机身颜色 / ATTR002 存储容量 / ATTR003 网络制式 / ATTR004 标配类型 —— 驱动 SKU 笛卡尔积组合（5色×4容量=20 SKU）
> - **基本属性**（scope=required）= ATTR006 上市年份 / ATTR007 屏幕尺寸 / ATTR008 电池容量 + 本节补充 ATTR_CHIP（A18）/ ATTR_RAM（8GB）/ ATTR_RESOLUTION（2556×1179）/ ATTR_WEIGHT（170g）—— SPU 级展示字段，不参与 SKU 组合
> - **颜色值** `AV_BLACK.display_meta.color_hex = #1C1C1E` 与电商产品数据模型 §2.6 完全一致
> - **SKU 组合矩阵**（5颜色 × 4容量 × 1制式 × 1类型 = 20 个 SKU）与电商产品数据模型 §2.5 完全一致
>
> 电商产品数据模型是本节案例的**实现来源**，两者应保持同步更新。

> 本节是 OT_ATTRIBUTE / OT_ATTRIBUTE_VALUE / Template 三层关系的最关键示例：用两个完全不同的品类（手机与服饰）演示模板如何引用平台属性字典，并通过 `allowed_value_refs` 限制值池子集。

**第 1 层：平台全局属性字典（OT_ATTRIBUTE）**

```json
[
  {
    "attr_id": "ATTR_COLOR",
    "attr_name": "颜色",
    "data_type": "ENUM",
    "scope": "PLATFORM_GLOBAL",
    "value_pool_mode": "EXTENSIBLE"
  },
  {
    "attr_id": "ATTR_CAPACITY",
    "attr_name": "容量",
    "data_type": "ENUM",
    "scope": "CATEGORY_SCOPED",
    "applicable_categories_hint": ["手机", "笔记本", "存储设备"],
    "value_pool_mode": "FIXED_GLOBAL"
  },
  {
    "attr_id": "ATTR_MATERIAL",
    "attr_name": "材质",
    "data_type": "ENUM",
    "scope": "CATEGORY_SCOPED",
    "applicable_categories_hint": ["服饰", "家纺"]
  },
  {
    "attr_id": "ATTR_SIZE",
    "attr_name": "尺码",
    "data_type": "ENUM",
    "scope": "CATEGORY_SCOPED",
    "applicable_categories_hint": ["服饰", "鞋类"]
  }
]
```

**第 2 层：平台全局值池（OT_ATTRIBUTE_VALUE，通过 HAS_CANDIDATE_VALUE #11 挂在属性下）**

```json
// ATTR_COLOR 的值池（共有 12 个候选值）
[
  { "attr_value_id": "AV_BLACK",       "attr_id": "ATTR_COLOR", "value": "黑色", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_WHITE",       "attr_id": "ATTR_COLOR", "value": "白色", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_PINK",        "attr_id": "ATTR_COLOR", "value": "粉色", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_BLUE",        "attr_id": "ATTR_COLOR", "value": "蓝色", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_TIFFANY_BLUE","attr_id": "ATTR_COLOR", "value": "Tiffany 蓝", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_CAMEL",       "attr_id": "ATTR_COLOR", "value": "驼色", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_BURGUNDY",    "attr_id": "ATTR_COLOR", "value": "酒红", "pool_owner": "PLATFORM_POOL" },
  { "attr_value_id": "AV_MILITARY_GREEN","attr_id": "ATTR_COLOR","value": "军绿", "pool_owner": "PLATFORM_POOL" },
  // ... 共 12 个值
]

// ATTR_CAPACITY 的值池（专属于存储类）
[
  { "attr_value_id": "AV_128GB",   "attr_id": "ATTR_CAPACITY", "value": "128GB" },
  { "attr_value_id": "AV_256GB",   "attr_id": "ATTR_CAPACITY", "value": "256GB" },
  { "attr_value_id": "AV_512GB",   "attr_id": "ATTR_CAPACITY", "value": "512GB" },
  { "attr_value_id": "AV_1TB",     "attr_id": "ATTR_CAPACITY", "value": "1TB" }
]

// ATTR_SIZE 的值池（专属于服饰）
[
  { "attr_value_id": "AV_S",  "attr_id": "ATTR_SIZE", "value": "S" },
  { "attr_value_id": "AV_M",  "attr_id": "ATTR_SIZE", "value": "M" },
  { "attr_value_id": "AV_L",  "attr_id": "ATTR_SIZE", "value": "L" },
  { "attr_value_id": "AV_XL", "attr_id": "ATTR_SIZE", "value": "XL" }
]
```

**第 3 层：模板通过 LinkType #11 `TEMPLATE_REFERENCES_ATTR` 引用属性字典，并限制值池子集**

```json
// 手机模板 TMPL_PHONE（与电商产品数据模型 v1.0 §2.4 完全对齐）
{
  "template_id": "TMPL_PHONE",
  "TEMPLATE_REFERENCES_ATTR": [
    // === 基本属性（scope=required）：SPU级展示，不参与SKU组合 ===
    { "attr_ref": "OT_ATTRIBUTE/ATTR_BRAND",     "scope": "required", "cardinality": "SINGLE",
      "overrides": { "must_be_in_category_whitelist": true } },
    { "attr_ref": "OT_ATTRIBUTE/ATTR_MODEL",     "scope": "required" },
    { "attr_ref": "OT_ATTRIBUTE/ATTR_CHIP",       "scope": "required" },   // 如 A18
    { "attr_ref": "OT_ATTRIBUTE/ATTR_RAM",        "scope": "required" },   // 如 8GB
    { "attr_ref": "OT_ATTRIBUTE/ATTR_SCREEN_SIZE","scope": "required" },   // 如 6.1英寸
    { "attr_ref": "OT_ATTRIBUTE/ATTR_RESOLUTION", "scope": "required" },   // 如 2556×1179
    { "attr_ref": "OT_ATTRIBUTE/ATTR_BATTERY",    "scope": "required" },   // 如 3561mAh
    { "attr_ref": "OT_ATTRIBUTE/ATTR_WEIGHT",     "scope": "required" },   // 如 170g
    { "attr_ref": "OT_ATTRIBUTE/ATTR_LAUNCH_YEAR","scope": "optional" },   // 如 2025

    // === 销售属性（scope=sales）：参与SKU笛卡尔积组合 ===
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_COLOR",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": [
        "OT_ATTRIBUTE_VALUE/AV_BLACK",
        "OT_ATTRIBUTE_VALUE/AV_WHITE",
        "OT_ATTRIBUTE_VALUE/AV_PINK",
        "OT_ATTRIBUTE_VALUE/AV_BLUE"
        // 故意剔除 Tiffany 蓝、驼色、酒红、军绿 —— iPhone 模板只允许这 4 色
      ]
    },
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_CAPACITY",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": [
        "OT_ATTRIBUTE_VALUE/AV_128GB",
        "OT_ATTRIBUTE_VALUE/AV_256GB",
        "OT_ATTRIBUTE_VALUE/AV_512GB"
        // iPhone 16 不出 1TB 版本，所以剔除 AV_1TB
      ]
    },
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_NETWORK_TYPE",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": ["OT_ATTRIBUTE_VALUE/AV_PUBLIC_VERSION"]
    },
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_BUNDLE_TYPE",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": ["OT_ATTRIBUTE_VALUE/AV_RETAIL_EDITION"]
    }
  ]
}

// T 恤模板 TMPL_TSHIRT（scope=optional 示例：售后服务；scope=required 示例：材质）
{
  "template_id": "TMPL_TSHIRT",
  "TEMPLATE_REFERENCES_ATTR": [
    // === 基本属性（scope=required）：SPU级展示，不参与SKU组合 ===
    { "attr_ref": "OT_ATTRIBUTE/ATTR_BRAND",      "scope": "required" },
    { "attr_ref": "OT_ATTRIBUTE/ATTR_MATERIAL",    "scope": "required" },   // 如 纯棉
    { "attr_ref": "OT_ATTRIBUTE/ATTR_LAUNCH_YEAR", "scope": "optional" },   // 可选属性示例

    // === 销售属性（scope=sales）：参与SKU笛卡尔积组合 ===
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_COLOR",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": [
        "OT_ATTRIBUTE_VALUE/AV_BLACK",
        "OT_ATTRIBUTE_VALUE/AV_WHITE",
        "OT_ATTRIBUTE_VALUE/AV_CAMEL",
        "OT_ATTRIBUTE_VALUE/AV_BURGUNDY",
        "OT_ATTRIBUTE_VALUE/AV_MILITARY_GREEN"
        // T 恤模板剔除粉色、蓝色（不适合 T 恤），保留更多大地色
      ]
    },
    {
      "attr_ref": "OT_ATTRIBUTE/ATTR_SIZE",
      "scope": "sales",
      "is_combination_key": true,
      "allowed_value_refs": [
        "OT_ATTRIBUTE_VALUE/AV_S",
        "OT_ATTRIBUTE_VALUE/AV_M",
        "OT_ATTRIBUTE_VALUE/AV_L",
        "OT_ATTRIBUTE_VALUE/AV_XL"
      ]
    }
  ]
}
```

**关键观察**：
- **同一属性 `ATTR_COLOR` 在两个模板里**：`allowed_value_refs` 完全不一样 —— 手机用「黑/白/粉/蓝」，T 恤用「黑/白/驼/酒红/军绿」
- **`ATTR_CAPACITY`（容量）只有手机模板引用**，T 恤模板根本看不到这个属性（虽然它在平台字典里）
- **`ATTR_SIZE`（尺码）只有 T 恤模板引用**，手机模板根本看不到这个属性
- **值池本身（OT_ATTRIBUTE_VALUE）保持平台唯一**：`AV_BLACK` 是同一条记录，不会因为模板不同而复制

**第 4 层：商品实例通过 LinkType #5 `HAS_ATTR_VALUE` 引用值池**

> **本节 iPhone 案例与电商产品数据模型 v1.0 §2.5 完全对齐**：颜色/容量/制式/标配类型 = `scope=sales`（销售属性，驱动 SKU 组合）；屏幕尺寸/电池容量/芯片/运行内存/分辨率/重量 = `scope=required`（基本属性，SPU 级描述字段）；ATTU001 值 AV_BLACK 的 `display_meta.color_hex=#1C1C1E` 与 v1.0 §2.6 完全一致。

```json
// SPU 实例「iPhone 16」（受 TMPL_PHONE 驱动）
{
  "spu_id": "SPU_IPHONE16",
  "template_id": "TMPL_PHONE",
  "description": "Apple iPhone 16，搭载A18芯片，6.1英寸超视网膜XDR显示屏，支持灵动岛，USB-C接口",
  "images": [
    "https://cdn.example.com/spu/spu_iphone16_main.jpg",
    "https://cdn.example.com/spu/spu_iphone16_detail1.jpg"
  ],

  // 基本属性（scope=required）：SPU级展示字段，不参与SKU组合
  "specifications": {
    "ATTR_BRAND": "B001_APPLE",
    "ATTR_MODEL": "iPhone 16",
    "ATTR_CHIP": "A18",                        // scope=required，基本属性
    "ATTR_RAM": "8GB",                         // scope=required，基本属性
    "ATTR_SCREEN_SIZE": "6.1英寸",             // scope=required，基本属性
    "ATTR_RESOLUTION": "2556×1179",            // scope=required，基本属性
    "ATTR_BATTERY": "3561mAh",                 // scope=required，基本属性
    "ATTR_WEIGHT": "170g",                      // scope=required，基本属性
    // 以下为 scope=sales：参与SKU笛卡尔积组合的属性
    "ATTR_COLOR": ["AV_BLACK", "AV_WHITE", "AV_PINK", "AV_BLUE"],
    "ATTR_CAPACITY": ["AV_128GB", "AV_256GB", "AV_512GB"]
  },

  // 销售属性值引用（scope=sales，驱动SKU生成）
  "HAS_ATTR_VALUE": [
    { "target": "OT_ATTRIBUTE_VALUE/AV_BLACK", "display_meta": { "color_hex": "#1C1C1E" } },
    { "target": "OT_ATTRIBUTE_VALUE/AV_128GB" }
  ]
}

// 对应的 AttributeValue 实例（补全 display_meta.color_hex）
{
  "attr_value_id": "AV_BLACK",
  "attr_id": "ATTR_COLOR",
  "value": "黑色",
  "display_meta": {
    "color_hex": "#1C1C1E",
    "image_url": "https://cdn.example.com/colors/iphone_black.png"
  }
}
{ "attr_value_id": "AV_WHITE", "attr_id": "ATTR_COLOR", "value": "白色", "display_meta": { "color_hex": "#F5F5F7" } }
{ "attr_value_id": "AV_PINK",  "attr_id": "ATTR_COLOR", "value": "粉色",  "display_meta": { "color_hex": "#FCC8D1" } }
{ "attr_value_id": "AV_BLUE",  "attr_id": "ATTR_COLOR", "value": "蓝色",  "display_meta": { "color_hex": "#5DADE2" } }
{ "attr_value_id": "AV_128GB", "attr_id": "ATTR_CAPACITY", "value": "128GB",
  "display_meta": { "extra_data": { "unit": "GB", "numeric_value": 128 } } }
{ "attr_value_id": "AV_256GB", "attr_id": "ATTR_CAPACITY", "value": "256GB",
  "display_meta": { "extra_data": { "unit": "GB", "numeric_value": 256 } } }
{ "attr_value_id": "AV_512GB", "attr_id": "ATTR_CAPACITY", "value": "512GB",
  "display_meta": { "extra_data": { "unit": "GB", "numeric_value": 512 } } }

// SPU 实例「优衣库纯棉 T 恤」（受 TMPL_TSHIRT 驱动）
{
  "spu_id": "SPU_TSHIRT_001",
  "template_id": "TMPL_TSHIRT",
  "specifications": {
    "ATTR_COLOR": ["AV_BLACK", "AV_WHITE", "AV_CAMEL", "AV_BURGUNDY", "AV_MILITARY_GREEN"],
    "ATTR_SIZE": ["AV_S", "AV_M", "AV_L", "AV_XL"]
  },
  "HAS_ATTR_VALUE": [
    { "target": "OT_ATTRIBUTE_VALUE/AV_CAMEL" },
    { "target": "OT_ATTRIBUTE_VALUE/AV_L" }
  ]
}
```

**校验机制（业务规则自动执行）**：
- 当商家尝试为 iPhone 16 添加 SKU 时填了「Tiffany 蓝」 → 系统拒绝（不在 `allowed_value_refs`）
- 当商家尝试为 T 恤添加 SKU 时填了「粉色」 → 系统拒绝（不在 `allowed_value_refs`）
- 当品牌方尝试为 iPhone 16 填尺码「S/M/L」 → 系统拒绝（iPhone 模板根本没引用 ATTR_SIZE）
- 当品牌方尝试给笔记本电脑填电池容量「3561mAh」 → 系统拒绝（值池里只有 GB/TB 容量）

**这种三层设计的实际收益**：

| 场景 | 没有三层模型 | 有三层模型 |
|------|------------|----------|
| 新增「5G」属性 | 每个模板都要重新定义一遍 | 平台字典加一行，所有模板立即可用 |
| 修改「黑色」的值文字 | 每个模板/品类下都要改 | 改 `AV_BLACK.value` 一处，全平台生效 |
| T 恤想用军绿色 | 新建一个 T 恤专属属性 | `AV_MILITARY_GREEN` 已存在，T 恤模板通过 `allowed_value_refs` 引入 |
| 跨品类比价 | 每个品类属性名不一致，无法对齐 | 属性字典是平台统一锚点，可跨品类聚合 |

### 2.3 映射关系构建

#### 2.3.1 元数据到实例的映射表

| 映射关系 | 源 | 目标 | 映射类型 | 说明 |
|---------|-----|------|---------|------|
| Category → SPUTemplate | 品类实例 | SPU 模板 | N:1 | 品类引用其适用的 SPU 模板（OT_CATEGORY.spu_template_ref，**V4 强制字段**） |
| **SPUTemplate → Attribute** | SPU 模板 | OT_ATTRIBUTE | **N:N** | **V4 唯一属性声明入口**：模板通过 LinkType #11 `TEMPLATE_REFERENCES_ATTR` 引用属性字典，允许通过 `allowed_value_refs` 限制值池子集 |
| **Attribute → AttributeValue** | OT_ATTRIBUTE | OT_ATTRIBUTE_VALUE | **1:N** | 属性字典通过 LinkType #10 `HAS_CANDIDATE_VALUE` 挂载值池候选 |
| SPU → SKU | SPU 实例 | SKU 实例 | 1:N | SPU 实例化生成 SKU 实例（GENERATES link #4） |
| **SPU/SKU → AttributeValue** | SPU/SKU 实例 | OT_ATTRIBUTE_VALUE | **M:N** | 商品实例通过 LinkType #5 `HAS_ATTR_VALUE` 引用值池成员；**取值必须落在模板的 `allowed_value_refs` 内** |
| SKU → Merchant | SKU 实例 | 商家实例 | M:N | SKU 被商家认领（SOLD_BY link，沉淀为 OT_MERCHANT_SKU） |
| MerchantSKU → Price | 商家 SKU | 价格 | 1:N | 商家定价（每个商家每个价格类型独立） |
| MerchantSKU → Inventory | 商家 SKU | 库存 | 1:N | 商家库存按仓库独立管理 |
| Inventory → Warehouse | 库存实例 | 仓库实例 | M:1 | 库存所属仓库（LOCATED_AT link） |

> **V4 关键变更**：
> - 删除了 V3 的「Category → Attribute」行 —— V4 下 Category 不再独立声明属性，属性声明的**唯一入口是 SPU 模板**
> - 链接 LinkType 编号从 #11/#12 调整为 #10/#11（详见 §1.1.1）

#### 2.3.2 继承关系映射（V4 路线 B：只继承业务归属，属性由模板声明）

> **V4 关键变更**：V3 文档的本节曾展示"ROOT → 手机数码 → 智能手机 → iPhone"四层品类 + 每层累加属性 的继承链。**V4 路线 B 下，这条继承链只用于业务导航，不再传递任何属性**。所有属性需求收敛在 OT_SPU_TEMPLATE 上，Category 只是引用模板。

```
V4 路线 B 的品类继承关系映射：

ROOT_CATEGORY (根品类)
    │
    ├── 业务归属继承：status (active), base_permissions
    │
    ▼
手机数码 (1001)
    │
    ├── 业务归属继承：+ 类目页 URL path
    │
    ├── spu_template_ref = "TMPL_DIGITAL"     ← V4 关键：此处挂总模板
    │
    ├── ▼
    │ 智能手机 (1002)
    │    │
    │    ├── 业务归属继承：+ 类目页 URL path
    │    │
    │    ├── spu_template_ref = "TMPL_SMARTPHONE"  ← 子品类切换模板
    │    │
    │    ├── ▼
    │    │    iPhone (1003)
    │    │    │
    │    │    ├── 业务归属继承：+ 类目页 URL path
    │    │    │
    │    │    ├── spu_template_ref = "TMPL_IPHONE"   ← iPhone 专属模板
    │    │    │
    │    │    └── 属性需求：从 TMPL_IPHONE.TEMPLATE_REFERENCES_ATTR 拉取
    │    │         （不是从父 Category 1002 继承）
    │    │
    │    └── ▼
    │         Android (1004)
    │              │
    │              ├── spu_template_ref = "TMPL_ANDROID"  ← 可与 iPhone 共用 TMPL_SMARTPHONE，
    │              │                                        也可切到 TMPL_ANDROID
    │              │
    │              └── 属性需求：从 TMPL_ANDROID 拉取
    │
    └── ▼
         配件 (1005)
              │
              ├── spu_template_ref = "TMPL_ACCESSORY"  ← 父是"手机数码"但
              │                                     模板完全独立
              │
              └── 属性需求：从 TMPL_ACCESSORY 拉取（不继承父类目的手机属性）
```

**V4 继承关系设计要点**：

| 维度 | V3 行为 | V4 行为（路线 B） |
|------|---------|-----------------|
| **业务归属（导航、URL、面包屑）** | 通过 `PARENT_OF` link 继承 | **保留**，完全不变 |
| **状态（active/inactive）** | 通过 `parent_chain` 继承 | 保留，业务归属范畴 |
| **属性（颜色、容量、尺码）** | 通过 Category 链 + DECLARES_ATTRIBUTE 累加继承 | **删除**，属性只在 Template 上声明 |
| **模板引用（spu_template_ref）** | 子可覆盖父 | **保留**，且 V4 强制非空 |
| **权限（audit_rules、base_permissions）** | 通过 `inherited_properties` 继承 | 保留业务归属范畴 |
| **销售属性 / 必填 / 值池限制** | 双重声明（Category + Template） | **只在 Template 上声明** |

> **工程实践建议**：父 Category 挂的"总模板"可以较宽（声明所有可能的属性），子 Category 切换到的"专模板"可以从总模板中精选子集。但**子模板不是从父模板继承来的** —— 它们是各自独立的 OT_SPU_TEMPLATE 节点。模板之间的关系（"继承 / 派生"）通过 §2.1.2 SKU 模板的 `parent_spu_template_ref` 表达，不通过 Category。

---

## 三、角色协同设计

### 3.1 角色模型与职责划分

| 角色 | Palantir 对应 | 职责范围 | 操作权限 |
|------|--------------|---------|---------|
| **平台运营** | Platform Admin | 品类结构、SPU/SKU 模板定义、规则配置 | 全局写 |
| **品类经理** | Domain Expert | 特定品类下的 SPU 管理、为新品类选择/切换 spu_template_ref | 品类级写（V4：不能直接定义属性，只能在已有模板中选择） |
| **品牌方** | Data Provider | 品牌产品信息提交、SPU 创建 | 品牌级写 |
| **商家（店小二）** | Data Consumer/Contributor | SKU 认领、定价、库存 | 商家级写 |
| **消费者** | Data Consumer | 浏览、购买、评价 | 只读 |
| **Agent 系统** | Automated Agent | 数据聚合、推理、自动化决策 | 场景化权限 |

> **V4 角色职责变更**：品类经理的"特定品类下的 SPU 管理"不再包含"属性定义"职能 —— 属性定义集中在平台运营与 OT_SPU_TEMPLATE 上。品类经理的核心动作是"为新品类选模板 / 切换模板 / 审核 SPU 完整性"，而非"配置属性白名单"。

### 3.2 基于角色的数据视图设计

#### 3.2.1 平台运营视角

```json
{
  "role": "PLATFORM_ADMIN",
  "data_view": {
    "visible_layers": ["META", "INSTANCE"],
    "visible_object_types": ["ALL"],
    "accessible_categories": ["ALL"],
    "can_modify": {
      "category_structure": true,
      "spu_template_ref": true,
      "spu_sku_templates": true,
      "validation_rules": true,
      "spu_instances": true,
      "sku_instances": true,
      "merchant_data": true
    }
  },
  "dashboard": {
    "primary_metrics": [
      "平台SKU总量",
      "待审核SPU数",
      "品类覆盖率",
      "商家活跃度"
    ],
    "alerts": [
      "异常价格波动",
      "库存预警",
      "新品待上架"
    ]
  }
}
```

> **V4 角色职责变更要点**：
> - `attribute_templates: true` 改为更精确的 `spu_sku_templates: true` —— 平台运营可定义/编辑 OT_SPU_TEMPLATE 与 OT_SKU_TEMPLATE（V4 唯一属性声明入口）
> - 新增 `spu_template_ref: true` —— 平台运营可调整 Category 与 Template 的引用关系
> - 品类经理与品牌方不再有"定义/修改属性"的权限，只能在 V4 路线 B 既定的模板下提交商品
> - 详细权限矩阵见 §3.4（v3 规划，本节为概要）
```

#### 3.2.2 品类经理视角

```json
{
  "role": "CATEGORY_MANAGER",
  "data_view": {
    "visible_layers": ["META", "INSTANCE"],
    "visible_object_types": ["OT_CATEGORY", "OT_SPU", "OT_SKU", "OT_ATTRIBUTE", "OT_ATTRIBUTE_VALUE"],
    "accessible_category_ids": ["1003"],
    "can_modify": {
      "category_structure": false,
      "attribute_templates": true,
      "spu_instances": true,
      "sku_instances": true,
      "merchant_data": false
    }
  },
  "workspace": {
    "focused_categories": ["iPhone"],
    "tasks": [
      "审核品牌方提交的SPU",
      "为新品类挑选/切换 spu_template_ref（V4 路线 B：不能直接定义属性，只能在已有模板中选择）",
      "监控SKU生成状态"
    ]
  }
}
```

#### 3.2.3 商家视角

```json
{
  "role": "MERCHANT",
  "merchant_id": "M20260001",
  "data_view": {
    "visible_layers": ["INSTANCE"],
    "visible_object_types": ["OT_SPU", "OT_SKU", "OT_MERCHANT_SKU", "OT_PRICE", "OT_INVENTORY"],
    "accessible_categories": ["ALL"],
    "can_modify": {
      "own_merchant_skus": true,
      "own_prices": true,
      "own_inventory": true
    }
  },
  "workspace": {
    "my_skus": {
      "status": "filters",
      "filters": ["在售", "待上架", "已下架"]
    },
    "tasks": [
      "选择要售卖的SPU",
      "设置价格策略",
      "管理库存",
      "处理订单"
    ]
  }
}
```

### 3.3 角色协同流程

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         多角色协同流程图                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────┐                                                       │
│  │    平台运营      │                                                       │
│  │  Platform Ops   │                                                       │
│  └────────┬────────┘                                                       │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  阶段1：品类与模板定义（V4 路线 B：模板是属性声明的唯一入口）        │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 平台运营：创建/维护品类结构（OT_CATEGORY）                         │  │
│  │  • 平台运营：定义 SPU/SKU 模板（OT_SPU_TEMPLATE / OT_SKU_TEMPLATE）   │  │
│  │  • 平台运营：Category 挂载 spu_template_ref（强制）                  │  │
│  │  • 平台运营：配置验证规则                                              │  │
│  │                                                                     │  │
│  │  （V3 时代的"定义品类属性模板"已删除 —— 不存在 Category 级模板）     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│           │                                                                │
│           ├──────────────────────────────────┐                            │
│           │                                  │                             │
│           ▼                                  ▼                             │
│  ┌─────────────────┐              ┌─────────────────┐                      │
│  │    品类经理      │              │    品牌方        │                      │
│  │ Category Mgr    │              │  Brand Owner    │                      │
│  └────────┬────────┘              └────────┬────────┘                      │
│           │                                  │                             │
│           ▼                                  ▼                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  阶段2：SPU创建与审核                                                │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 品类经理：审核品牌方提交的SPU申请                                  │  │
│  │  • 品牌方：提交SPU信息（型号、规格、图片）                              │  │
│  │  • 系统：自动生成SKU候选列表                                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────┐                                                       │
│  │    商家         │                                                       │
│  │   店小二        │                                                       │
│  └────────┬────────┘                                                       │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  阶段3：商家认领与运营                                                │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 商家选择要售卖的SKU                                                 │  │
│  │  • 设置商家专属价格（OT_MERCHANT_SKU → OT_PRICE）                     │  │
│  │  • 绑定库存仓库（OT_MERCHANT_SKU → OT_INVENTORY → OT_WAREHOUSE）      │  │
│  │  • 商品上架销售                                                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────┐                                                       │
│  │    消费者        │                                                       │
│  │   Customer      │                                                       │
│  └────────┬────────┘                                                       │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  阶段4：消费与反馈                                                    │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 浏览商品（多商家比价）                                              │  │
│  │  • 下单购买                                                           │  │
│  │  • 评价反馈                                                           │  │
│  │  • 退货退款                                                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 冲突处理机制

| 冲突类型 | 触发场景 | 处理策略 | 优先级 |
|---------|---------|---------|--------|
| **模板属性值域冲突**（V4 替换原"品类属性覆盖冲突"） | 子模板或 Category 切到新模板后，新模板值域与原模板不一致 | 校验规则：新模板值域必须是旧模板的子集（或经审核批准扩展） | 硬校验 |
| SPU重名冲突 | 不同品牌方提交同名SPU | 品牌隔离 + 自动后缀 | 软校验 |
| 价格异常冲突 | 商家定价超出合理范围 | 价格预警 + 人工审核 | 软校验 |
| 库存超卖 | 多订单并发扣减库存 | 分布式锁 + 乐观锁重试 | 硬校验 |
| 品类归属冲突 | SPU可能属于多个品类 | 主品类 + 关联品类双归属 | 软校验 |

> **V4 变更说明**：原"品类属性覆盖冲突"行被替换为"模板属性值域冲突"行。V4 路线 B 下，Category 不再独立声明属性，属性继承路径消失，**唯一的属性声明入口在 Template**。当一个 Category 切换 spu_template_ref 时，系统需要校验新模板的 `allowed_value_refs` 是否是原模板的子集，避免出现"已经在 SPU 上填了的值突然非法"。

---

## 四、图数据库设计与构建

> ⚠️ **关键前提澄清**：图数据库的「边(Edge)」是 **LinkType 的物理落地形式**，而不是 LinkType 本身。LinkType 是 Ontology 层的 schema 概念（需要被注册、版本化、权限控制），而图数据库的边是其 backing storage。两者关系类似「类 vs 表」—— 类定义在代码层，表存在数据库层。

### 4.1 图模型总体设计

#### 4.1.1 节点类型定义（对应 ObjectType）

| 节点类型 | Label | 对应 ObjectType | 核心属性 |
|---------|-------|----------------|---------|
| 品类节点 | `:Category` | OT_CATEGORY | category_id, name, level, path |
| 品牌节点 | `:Brand` | OT_BRAND | brand_id, name, country |
| SPU 节点 | `:SPU` | OT_SPU | spu_id, name, status |
| SKU 节点 | `:SKU` | OT_SKU | sku_id, sales_attrs_hash |
| 属性节点 | `:Attribute` | OT_ATTRIBUTE | attr_id, name, data_type |
| 属性值节点 | `:AttributeValue` | OT_ATTRIBUTE_VALUE | attr_value_id, value |
| 商家节点 | `:Merchant` | OT_MERCHANT | merchant_id, name |
| 商家 SKU 节点 | `:MerchantSKU` | OT_MERCHANT_SKU | merchant_sku_id, status |
| 仓库节点 | `:Warehouse` | OT_WAREHOUSE | warehouse_id, location |
| 价格节点 | `:Price` | OT_PRICE | price_id, amount, price_type |
| 库存节点 | `:Inventory` | OT_INVENTORY | inventory_id, available, reserved |

#### 4.1.2 边类型定义（对应 LinkType 的物理落地）

| 边类型 | From | To | 对应 LinkType | 描述 | 边属性 |
|-------|------|-----|--------------|------|-------|
| `:PARENT_OF` | Category | Category | PARENT_OF | 品类父子关系 | rank |
| `:BELONGS_TO` | SPU | Category | BELONGS_TO_CATEGORY | SPU 归属品类 | is_primary |
| `:BELONGS_TO` | SPU | Brand | HAS_BRAND | SPU 归属品牌 | — |
| **`:HAS_CANDIDATE_VALUE`** | **Attribute** | **AttributeValue** | **HAS_CANDIDATE_VALUE (#10)** | **属性字典挂载值池** | **sort_order, is_default** |
| **`:TEMPLATE_REFERENCES_ATTR`** | **SPUTemplate / SKUTemplate** | **Attribute** | **TEMPLATE_REFERENCES_ATTR (#11)** | **V4 唯一属性声明入口**：模板引用属性字典，限制值池子集 | **scope, allowed_value_refs[], overrides{}** |

> **V4 变更**：
> - 删除原 V3 的 `:DECLARES` 边（Category → Attribute），V4 路线 B 下 Category 不再向 Attribute 直接声明属性
> - LinkType 编号从 #11/#12 调整为 #10/#11（与 §1.1.1 一致）

> **关键观察**：§4.1.2 中 `:HAS_ATTR_VALUE` 出现了两次（SPU 端与 SKU 端），这是有意为之 —— SPU 与 SKU 都通过同一种 LinkType 引用属性值，但两侧的语义不同：
> - **SKU 端的 HAS_ATTR_VALUE**：必填、可作为销售属性（参与比价、库存匹配）
> - **SPU 端的 HAS_ATTR_VALUE**：可选、非销售属性（仅作为商品描述，如「材质」「产地」）
>
> 该 LinkType 在 Palantir 范式中通过 `cardinality` 字段区分两种使用场景，图数据库落地时通过方向语义区分。

### 4.2 图数据库 Schema（类 Cypher 定义）

```cypher
// ============== 节点定义 ==============

// 品类节点
CREATE CONSTRAINT category_id_unique IF NOT EXISTS
FOR (c:Category) REQUIRE c.category_id IS UNIQUE;

CREATE INDEX category_level IF NOT EXISTS
FOR (c:Category) ON (c.level);

// 品牌节点
CREATE CONSTRAINT brand_id_unique IF NOT EXISTS
FOR (b:Brand) REQUIRE b.brand_id IS UNIQUE;

// SPU 节点
CREATE CONSTRAINT spu_id_unique IF NOT EXISTS
FOR (s:SPU) REQUIRE s.spu_id IS UNIQUE;

CREATE INDEX spu_category IF NOT EXISTS
FOR (s:SPU) ON (s.primary_category_id);

CREATE INDEX spu_brand IF NOT EXISTS
FOR (s:SPU) ON (s.brand_id);

// SKU 节点
CREATE CONSTRAINT sku_id_unique IF NOT EXISTS
FOR (k:SKU) REQUIRE k.sku_id IS UNIQUE;

CREATE INDEX sku_spu IF NOT EXISTS
FOR (k:SKU) ON (k.spu_id);

// 商家节点
CREATE CONSTRAINT merchant_id_unique IF NOT EXISTS
FOR (m:Merchant) REQUIRE m.merchant_id IS UNIQUE;

// 商家 SKU 节点
CREATE CONSTRAINT merchant_sku_id_unique IF NOT EXISTS
FOR (ms:MerchantSKU) REQUIRE ms.merchant_sku_id IS UNIQUE;

CREATE INDEX merchant_sku_sku IF NOT EXISTS
FOR (ms:MerchantSKU) ON (ms.sku_id);

// 属性节点
CREATE CONSTRAINT attr_id_unique IF NOT EXISTS
FOR (a:Attribute) REQUIRE a.attr_id IS UNIQUE;

// 属性值节点
CREATE CONSTRAINT attr_value_id_unique IF NOT EXISTS
FOR (av:AttributeValue) REQUIRE av.attr_value_id IS UNIQUE;

// 仓库节点
CREATE CONSTRAINT warehouse_id_unique IF NOT EXISTS
FOR (w:Warehouse) REQUIRE w.warehouse_id IS UNIQUE;

// 价格节点
CREATE CONSTRAINT price_id_unique IF NOT EXISTS
FOR (p:Price) REQUIRE p.price_id IS UNIQUE;

// 库存节点
CREATE CONSTRAINT inventory_id_unique IF NOT EXISTS
FOR (i:Inventory) REQUIRE i.inventory_id IS UNIQUE;

// ============== 关系定义 ==============

// 品类层级关系
CREATE INDEX category_parent IF NOT EXISTS
FOR ()-[r:PARENT_OF]->() ON (r.rank);

// SPU-Category 归属
CREATE INDEX spu_category_link IF NOT EXISTS
FOR ()-[r:BELONGS_TO]->() ON (r.is_primary);

// SKU 生成关系
CREATE INDEX sku_generation IF NOT EXISTS
FOR ()-[r:GENERATES]->() ON (r.combination_key);

// SOLD_BY 链接
CREATE INDEX sold_by_status IF NOT EXISTS
FOR ()-[r:SOLD_BY]->() ON (r.status);

// HAS_PRICE 链接
CREATE INDEX has_price_type IF NOT EXISTS
FOR ()-[r:HAS_PRICE]->() ON (r.price_type);

// 属性 ↔ 属性值候选池（HAS_CANDIDATE_VALUE）
CREATE INDEX attr_candidate_sort IF NOT EXISTS
FOR ()-[r:HAS_CANDIDATE_VALUE]->() ON (r.sort_order);

CREATE INDEX attr_candidate_default IF NOT EXISTS
FOR ()-[r:HAS_CANDIDATE_VALUE]->() ON (r.is_default);

// 模板 ↔ 属性字典（TEMPLATE_REFERENCES_ATTR）
CREATE INDEX template_refs_scope IF NOT EXISTS
FOR ()-[r:TEMPLATE_REFERENCES_ATTR]->() ON (r.scope);
```

### 4.3 核心图查询模式

#### 4.3.1 品类继承路径查询

```cypher
// 查询 iPhone 品类的完整继承路径
MATCH path = (root:Category {name: 'ROOT'})-[:PARENT_OF*]->(c:Category {name: 'iPhone'})
RETURN path,
       [node IN nodes(path) | node.name] AS category_chain
```

**结果示例：**
```
ROOT → 手机数码 → 智能手机 → iPhone
```

#### 4.3.2 SKU 生成链路追溯

```cypher
// 追溯 SKU202600001 的完整生成链路（V4 路线 B）
MATCH (t:SPUTemplate {template_id: 'TMPL_IPHONE'})-[:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute)
MATCH (spu:SPU {spu_id: 'SPU20260001'})-[:BELONGS_TO]->(c:Category {name: 'iPhone'})
MATCH (c)-[:USES_TEMPLATE]->(t)                                     // V4: Category → Template 单向
MATCH (spu)-[:GENERATES]->(sku:SKU {sku_id: 'SKU202600001'})
OPTIONAL MATCH (sku)-[:HAS_ATTR_VALUE]->(av:AttributeValue)
RETURN spu, c, t, attr, sku, collect(av) AS attribute_values
```

#### 4.3.3 商家商品多跳查询

```cypher
// 查询商家 M20260001 的所有在售商品及价格
MATCH (m:Merchant {merchant_id: 'M20260001'})
      <-[:SOLD_BY]-(sku:SKU)
      -[:HAS_ATTR_VALUE]->(av:AttributeValue)
MATCH (sku)<-[:HOLDS_INVENTORY]-(ms:MerchantSKU {merchant_id: 'M20260001'})
      -[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale' AND p.status = 'active'
MATCH (sku)-[:GENERATES]-(spu:SPU)-[:BELONGS_TO]->(c:Category)
RETURN m.merchant_name AS 商家,
       spu.spu_name AS 商品名称,
       [av IN collect(av) | av.value] AS 规格,
       p.amount AS 售价
ORDER BY p.amount
```

#### 4.3.4 图聚类分析：相似商品推荐

```cypher
// 基于属性相似度查找相似商品
MATCH (target:SKU {sku_id: 'SKU202600001'})-[:HAS_ATTR_VALUE]->(av1:AttributeValue)
MATCH (other:SKU)-[:HAS_ATTR_VALUE]->(av2:AttributeValue)
WHERE av1.attr_id = av2.attr_id
  AND av1.value = av2.value
  AND other <> target
WITH target, other, count(*) AS shared_attrs
WHERE shared_attrs >= 3
MATCH (target)-[:GENERATES]-(spu1:SPU)
MATCH (other)-[:GENERATES]-(spu2:SPU)
MATCH (other)<-[:HOLDS_INVENTORY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale'
RETURN spu1.spu_name AS 原商品,
       spu2.spu_name AS 相似商品,
       shared_attrs AS 共同属性数,
       p.amount AS 相似商品价格
ORDER BY shared_attrs DESC
LIMIT 10
```

#### 4.3.5 属性三层模型查询（业务校验示例）

> 以下查询演示属性三层模型如何在图数据库中支持业务规则校验，对应 §2.2.8 的 iPhone + T 恤案例。

**查询 1：iPhone 16 的销售属性值池（值池子集计算）**

```cypher
// 查询 "iPhone 16" 受 TMPL_IPHONE 限制后的颜色可选值
MATCH (c:Category {name: 'iPhone'})-[:USES_TEMPLATE]->(t:SPUTemplate {template_id: 'TMPL_IPHONE'})
MATCH (t)-[refs:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute {attr_id: 'ATTR_COLOR'})
WHERE refs.scope = 'sales'

// 模板允许的值（值池子集）
UNWIND refs.allowed_value_refs AS allowed_ref
MATCH (av:AttributeValue {attr_value_id: allowed_ref})

// 属性全局值池（用于对比）
MATCH (attr)-[:HAS_CANDIDATE_VALUE]->(all_av:AttributeValue)

RETURN attr.attr_name AS 属性,
       collect(DISTINCT av.value) AS 模板允许值,
       collect(DISTINCT all_av.value) AS 全局值池,
       size(collect(DISTINCT all_av.value)) - size(collect(DISTINCT av.value)) AS 被屏蔽值数量
```

**业务价值**：运营可一眼看到"全局有 12 个颜色，模板屏蔽了 8 个"。

**查询 2：商家 SKU 提交的属性值校验**

```cypher
// 校验商家为 iPhone 16 黑色 SKU 提交的属性值是否在模板允许范围
// 假设商家误填了「Tiffany 蓝」（AV_TIFFANY_BLUE）
MATCH (sku:SKU {sku_id: 'SKU_TEST'})-[:HAS_ATTR_VALUE]->(av:AttributeValue)
MATCH (sku)-[:GENERATED_FROM_SPU]->(spu:SPU {spu_id: 'SPU_IPHONE16'})
MATCH (spu)-[:BELONGS_TO]->(c:Category)-[:USES_TEMPLATE]->(t:SPUTemplate {template_id: 'TMPL_IPHONE'})
MATCH (t)-[refs:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute)
WHERE av.attr_id = attr.attr_id

// 检查 av 是否在 allowed_value_refs 中
WITH av, refs, attr,
     [v IN refs.allowed_value_refs WHERE v = av.attr_value_id] AS match_check

RETURN
    av.value AS 商家填值,
    attr.attr_name AS 属性,
    size(match_check) AS 是否合法,         // 0 = 非法，1 = 合法
    CASE size(match_check)
        WHEN 0 THEN '拒绝：值不在模板 allowed_value_refs 中'
        ELSE '通过'
    END AS 校验结果
```

**业务价值**：商家填了不在模板允许范围内的值，系统立刻拒绝，无需人工审核。

**查询 3：跨品类属性聚合（找全平台所有"黑色"商品）**

```cypher
// 全平台所有"黑色"商品（无论手机、T 恤、家电），展示属性字典的跨品类价值
MATCH (av:AttributeValue {value: '黑色', attr_id: 'ATTR_COLOR'})<-[:HAS_CANDIDATE_VALUE]-(attr:Attribute)
MATCH (av)<-[r:HAS_ATTR_VALUE]-(sku:SKU)
MATCH (sku)-[:GENERATED_FROM_SPU]->(spu:SPU)
MATCH (spu)-[:BELONGS_TO]->(c:Category)
MATCH (sku)<-[:HOLDS_INVENTORY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale' AND p.status = 'active'

RETURN spu.spu_name AS 商品,
       c.category_name AS 品类,
       p.amount AS 价格
ORDER BY p.amount
LIMIT 50
```

**业务价值**：Agent 跨品类比价、商品聚合页"全平台黑色商品"，都依赖属性字典的全局唯一性。

### 4.4 图数据结构示例

> **V4 路线 B 图结构变化**：
> - ❌ 删除原 V3 的 `:Category -[:DECLARES]-> :Attribute` 直接连线
> - ✅ 改为两步链路：`:Category -[:USES_TEMPLATE]-> :SPUTemplate -[:TEMPLATE_REFERENCES_ATTR]-> :Attribute`
> - **与电商产品数据模型 v1.0 对齐**：SPU 节点补 `description`/`images`/`specifications`（基本属性）字段；AttributeValue 节点补 `display_meta.color_hex` 字段

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                  电商产品图数据示例（V4 路线 B：Category → Template → Attribute）│
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   ┌─────────────┐    USES_TEMPLATE   ┌──────────────────┐                       │
│   │ :Category   │◀═══════════════════▶│ :SPUTemplate     │  ── TEMPLATE_REFS  ──▶│
│   │ iPhone      │   spu_template_ref  │ TMPL_IPHONE      │     ATTR (#11)       │
│   │ level: 3    │                    │ (属性声明唯一入口)│                       │
│   └──────┬──────┘                    └──────────────────┘                       │
│          │ PARENT_OF                                                           │
│          ▲                                                                     │
│   ┌─────────────┐    PARENT_OF    ┌─────────────┐                              │
│   │ :Category   │◀────────────────│ :Category   │                              │
│   │ 智能手机     │                 │ 手机数码     │                              │
│   │ level: 2    │                 │ level: 1    │                              │
│   └─────────────┘                 └─────────────┘                              │
│                                                                                │
│          │ BELONGS_TO                          │ HAS_BRAND                     │
│          ▼                                     ▼                              │
│   ┌─────────────────────────────────────────────────────┐                     │
│   │ :SPU iPhone 16 (SPU001)                            │                     │
│   │  description: "Apple iPhone 16，搭载A18芯片..."    │                     │
│   │  images: ["main.jpg", "detail1.jpg"]              │                     │
│   │  ─────────────────────────────────────────────     │                     │
│   │  specifications（基本属性，scope=required）:         │                     │
│   │    chip: A18 | ram: 8GB | screen: 6.1英寸        │                     │
│   │    resolution: 2556×1179 | battery: 3561mAh       │                     │
│   │  ─────────────────────────────────────────────     │                     │
│   │  driven by: TMPL_IPHONE (GENERATES ×20 SKU)       │                     │
│   └──────┬──────────────────────────────────────────────┘                     │
│          │ GENERATES (×20)                                                   │
│          ▼                                                                     │
│   ┌─────────────┐  HAS_ATTR_VALUE   ┌──────────────────────────────┐        │
│   │ :SKU 128G黑 │─────────────────▶│ :AttributeValue              │        │
│   │ SKU001      │                   │ 黑色/128GB                  │        │
│   └──────┬──────┘                   │ display_meta:               │        │
│          │ SOLD_BY                   │   color_hex: #1C1C1E (黑色) │        │
│          ▼                           │   extra_data: {GB: 128}     │        │
│   ┌────────────────────┐            └──────────────────────────────┘        │
│   │ :MerchantSKU MSKU001│──── HAS_PRICE ───▶ :Price ¥6299 (sale)            │
│   │ M20260001 + SKU001 │──── HAS_PRICE ───▶ :Price ¥6999 (original)         │
│   └──────┬─────────────┘                                                      │
│          │ HOLDS_INVENTORY                                                    │
│          ▼                                                                     │
│   ┌─────────────┐    LOCATED_AT    ┌─────────────┐                            │
│   │ :Inventory  │─────────────────▶│ :Warehouse  │                            │
│   │ 华东仓 50件  │                  │ 华东中心仓   │                            │
│   └─────────────┘                  └─────────────┘                            │
│          │ SOLD_BY 另一端                                                     │
│          ▼                                                                     │
│   ┌─────────────┐                                                              │
│   │ :Merchant   │  (M20260001 店小二旗舰店)                                    │
│   └─────────────┘                                                              │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**V4 关键 Cypher 查询：查"iPhone 品类下 SPU 需具备的所有属性"**

```cypher
// 旧 V3 查询（已废弃）: MATCH (c:Category {name: 'iPhone'})-[:DECLARES]->(a:Attribute)
// V4 新查询（属性声明唯一入口）:
MATCH (c:Category {name: 'iPhone'})-[:USES_TEMPLATE]->(t:SPUTemplate)
MATCH (t)-[refs:TEMPLATE_REFERENCES_ATTR]->(a:Attribute)
RETURN c.category_name AS 品类,
       t.template_id AS 模板,
       a.attr_id AS 属性ID,
       a.attr_name AS 属性名,
       refs.scope AS 作用域
ORDER BY refs.scope, a.attr_id
```

### 4.5 图数据库选型建议

| 图数据库 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| **Neo4j** | 通用场景，中小规模 | 生态成熟，Cypher易用 | 分布式扩展性一般 |
| **Amazon Neptune** | 云原生，大规模 | 与AWS生态集成好 | 查询语言较复杂 |
| **TigerGraph** | 超大规模，分析型 | 性能优秀，支持GSQL | 生态较新 |
| **Dgraph** | 超大规模，实时 | 分布式原生支持，GraphQL接口 | 生态较小 |
| **Apache AGE** | PostgreSQL扩展 | 可复用PG生态 | 功能较基础 |

**推荐选型：**
- 初创/中小平台：Neo4j Community/Aura
- 中大型平台：TigerGraph 或 Neo4j Enterprise
- 云原生架构：Amazon Neptune + Lambda

---

## 五、Agent 消费场景与应用

### 5.1 Agent 能力分层

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Agent 能力分层架构                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    L4: 智能决策层 (Decision)                          │  │
│  │  ═══════════════════════════════════════════════════════════════   │  │
│  │  • 自动定价策略生成                                                    │  │
│  │  • 库存调拨建议                                                        │  │
│  │  • 品类扩张规划                                                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    L3: 推理分析层 (Reasoning)                        │  │
│  │  ═══════════════════════════════════════════════════════════════   │  │
│  │  • 商品相似度分析                                                      │  │
│  │  • 销售预测                                                            │  │
│  │  • 异常检测                                                            │  │
│  │  • 竞争分析                                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    L2: 语义检索层 (Retrieval)                        │  │
│  │  ═══════════════════════════════════════════════════════════════   │  │
│  │  • 自然语言商品查询                                                    │  │
│  │  • 多跳关系推理查询                                                    │  │
│  │  • 跨品类属性筛选                                                      │  │
│  │  • 上下文理解                                                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    L1: 数据访问层 (Data Access)                      │  │
│  │  ═══════════════════════════════════════════════════════════════   │  │
│  │  • 图数据库查询                                                        │  │
│  │  • 关系路径遍历                                                        │  │
│  │  • 属性过滤                                                            │  │
│  │  • 聚合统计                                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    Graph: 图数据层                                   │  │
│  │  Category / Brand / SPU / SKU / Merchant / Inventory / ...           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 核心消费场景

#### 5.2.1 场景一：智能商品搜索与推荐

**场景描述：** 用户通过自然语言搜索商品，Agent 需要理解查询意图并返回精准结果。

**Agent 工作流：**
```
用户查询: "我要买一台256G的黑色iPhone16，价格不要太贵"

     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  L2 语义理解层                                                           │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  意图识别：                                                              │
│  • 商品类型：iPhone 16 (品类: iPhone → SPU: Apple iPhone 16)             │
│  • 规格约束：256GB + 黑色 (销售属性筛选)                                  │
│  • 价格意图：低价优先                                                     │
│                                                                         │
│  实体提取：                                                              │
│  • Category: iPhone                                                     │
│  • Brand: Apple                                                         │
│  • SPU: iPhone 16                                                       │
│  • SalesAttr: {容量:256GB, 颜色:黑色}                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  L1 图查询层                                                             │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  MATCH 查询：                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ MATCH (c:Category {name: 'iPhone'})                               │  │
│  │ MATCH (spu:SPU)-[:BELONGS_TO]->(c)                               │  │
│  │ MATCH (spu)-[:GENERATES]->(sku:SKU)                              │  │
│  │ MATCH (sku)-[:HAS_ATTR_VALUE]->(av:AttributeValue)                │  │
│  │ WHERE av.value IN ['256GB', '黑色']                               │  │
│  │ WITH sku, spu, count(DISTINCT av.value) AS match_score            │  │
│  │ WHERE match_score = 2                                             │  │
│  │ MATCH (ms:MerchantSKU)-[:HOLDS_INVENTORY]->(sku)                 │  │
│  │ MATCH (ms)-[:HAS_PRICE]->(p:Price)                               │  │
│  │ WHERE p.price_type = 'sale' AND p.status = 'active'              │  │
│  │ MATCH (sku)-[:SOLD_BY]->(m:Merchant)                             │  │
│  │ RETURN spu.spu_name, sku.sku_id, p.amount, m.merchant_name       │  │
│  │ ORDER BY p.amount ASC                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  返回结果                                                                │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  1. iPhone 16 256GB 黑色 - 店小二旗舰店 - ¥6299                         │
│  2. iPhone 16 256GB 黑色 - 数码专营店   - ¥6199  ← 推荐                 │
│  3. iPhone 16 256GB 黑色 - 苹果直营店   - ¥7499                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 场景二：商家智能运营助手

**场景描述：** 店小二需要了解竞品情况、调整定价策略、管理库存。

**Agent 能力矩阵：**

| 能力 | 输入 | Agent 操作 | 输出 |
|------|------|-----------|------|
| **竞品分析** | SKU ID | 遍历同类 SPU 的 SKU，比较价格和销量 | 竞品价格表、差距分析 |
| **智能定价** | SKU + 目标利润率 | 分析竞品价格带，建议最优定价 | 定价建议（含理由） |
| **库存预警** | 商家 ID | 分析库存周转，预测断货风险 | 补货建议清单 |
| **商品上新** | 新 SPU 链接 | 自动填充商品信息，一键铺货 | 上架草稿 |

**Agent 对话示例：**
```
用户: 帮我分析一下我的iPhone 16 256GB黑色的竞争力

Agent:
┌─────────────────────────────────────────────────────────────────────────┐
│  竞争力分析报告                                                          │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  📊 基本信息                                                             │
│  • 你的商品：iPhone 16 256GB 黑色                                        │
│  • 你的售价：¥6299（成本¥5550，利润¥749，利润率11.9%）                      │
│                                                                         │
│  📈 竞品分析                                                             │
│  ┌──────────────┬────────┬────────┬────────┬────────────────┐            │
│  │ 商家         │ 价格   │ 库存   │ 销量   │ 评价           │            │
│  ├──────────────┼────────┼────────┼────────┼────────────────┤            │
│  │ 数码专营店   │ ¥6199  │ 30件   │ 128    │ ⭐4.8          │ ← 最低价  │
│  │ 你的店铺     │ ¥6299  │ 50件   │ 95     │ ⭐4.7          │            │
│  │ 苹果直营店   │ ¥7499  │ 100件  │ 256    │ ⭐4.9          │ ← 最热销  │
│  └──────────────┴────────┴────────┴────────┴────────────────┘            │
│                                                                         │
│  💡 建议                                                                │
│  1. 你的库存充足(50件)，但价格偏高100元，建议降价至¥6249以提升竞争力         │
│  2. 数码专营店销量最高，可能有稳定的供应链优势，建议关注对方动态              │
│  3. 苹果直营店虽然价格最高但销量最好，说明品牌信任度很重要                   │
│                                                                         │
│  🎯 操作建议                                                            │
│  [ ] 降价至¥6249  [ ] 优化商品描述  [ ] 提升客服响应  [ ] 取消关注          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.3 场景三：品类运营分析

**场景描述：** 品类经理需要了解品类健康度、商品覆盖率、商家活跃度。

**图分析查询：**

```cypher
// 品类健康度分析
MATCH (c:Category {name: 'iPhone'})

// 1. SPU 数量
OPTIONAL MATCH (spu:SPU)-[:BELONGS_TO]->(c)
WITH c, count(DISTINCT spu) AS spu_count

// 2. SKU 覆盖率
OPTIONAL MATCH (spu)-[:GENERATES]->(sku:SKU)
WITH c, spu_count, count(DISTINCT sku) AS sku_count

// 3. 商家覆盖率
OPTIONAL MATCH (sku)-[:SOLD_BY]->(m:Merchant)
WITH c, spu_count, sku_count, count(DISTINCT m) AS merchant_count

// 4. 平均价格带
OPTIONAL MATCH (sku)<-[:HOLDS_INVENTORY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale' AND p.status = 'active'
WITH c, spu_count, sku_count, merchant_count,
     avg(p.amount) AS avg_price,
     min(p.amount) AS min_price,
     max(p.amount) AS max_price

RETURN c.name AS 品类,
       spu_count AS SPU数量,
       sku_count AS SKU数量,
       merchant_count AS 商家数量,
       min_price AS 最低价,
       avg_price AS 平均价,
       max_price AS 最高价,
       (max_price - min_price) / min_price * 100 AS 价格带宽百分比
```

**输出报告：**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           iPhone 品类分析报告                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 商品规模                                                             │
│  • SPU 数量：1 (iPhone 16)                                              │
│  • SKU 数量：20 (全规格覆盖)                                              │
│  • 商家数量：15                                                         │
│                                                                         │
│  💰 价格分布                                                             │
│  • 最低价：¥5999 (128GB)                                                │
│  • 平均价：¥7824                                                        │
│  • 最高价：¥10299 (1TB)                                                 │
│  • 价格带宽：71.7%                                                      │
│                                                                         │
│  📊 健康度指标                                                           │
│  • SKU 覆盖率：100% (所有规格组合)                                         │
│  • 商家活跃度：73% (11/15 商家在售)                                        │
│  • 价格健康度：🟢 正常                                                   │
│                                                                         │
│  ⚠️ 待优化项                                                             │
│  1. 缺少 iPhone 16 Pro 系列 SPU                                         │
│  2. 部分 512GB/1TB 规格商家覆盖不足                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.4 场景四：跨品类智能联想

**场景描述：** 用户浏览某商品时，Agent 自动推荐相关配件和服务。

**图推理查询：**

```cypher
// 基于购买路径的配件推荐
MATCH (current:SKU {sku_id: 'SKU202600001'})  // iPhone 16 128GB
MATCH (current)-[:GENERATES]-(spu:SPU)-[:BELONGS_TO]->(c:Category)

// 查找同品类下、同品牌配件（简化为品类名匹配）
OPTIONAL MATCH (acc_spu:SPU)-[:BELONGS_TO]->(acc_c:Category)
WHERE acc_c.name CONTAINS '配件' OR acc_c.name CONTAINS '保护'

RETURN
    current.sku_id AS 当前商品,
    collect(DISTINCT acc_spu.spu_name)[..5] AS 推荐配件
```

### 5.3 Agent 工具集设计

| 工具名称 | 描述 | 输入 | 输出 |
|---------|------|------|------|
| `search_products` | 商品搜索 | 自然语言/结构化查询 | 商品列表 |
| `get_product_detail` | 商品详情 | SKU ID | 完整商品信息 |
| `analyze_competition` | 竞品分析 | SKU ID / 商家 ID | 分析报告 |
| `suggest_price` | 定价建议 | SKU ID + 策略 | 建议价格 |
| `check_inventory` | 库存查询 | SKU ID + 商家 ID | 库存状态 |
| `track_category_health` | 品类健康 | 品类 ID | 健康度报告 |
| `find_accessories` | 配件推荐 | SKU ID | 配件列表 |
| `batch_update_price` | 批量调价 | 商家 ID + 调整策略 | 更新结果 |

### 5.4 RAG 增强方案

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           RAG 增强架构                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ 用户查询     │───▶│ Query理解   │───▶│ 图检索      │                     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                     │
│                                               │                            │
│                                               ▼                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        知识库增强层                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │ 商品知识库   │  │ 规则知识库   │  │ 案例知识库   │  │ 政策知识库   │ │  │
│  │  │ (向量索引)  │  │ (规则引擎)  │  │ (历史经验)  │  │ (平台规则)  │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                           LLM 推理生成                               │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ Prompt: 整合图查询结果 + 知识库检索 + 用户上下文              │   │  │
│  │  │         → 生成最终回复                                       │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│                             ┌─────────────┐                                │
│                             │ Agent 回复   │                                │
│                             └─────────────┘                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、总结与实施建议

### 6.1 核心设计原则

| 原则 | 说明 | 应用 |
|------|------|------|
| **语义分层** | 元数据与实例数据分离 | 第一层定义规则，第二层存储实例 |
| **继承显式化** | 品类属性继承关系显式建模 | 支持层级追溯和覆盖 |
| **关系优先** | 优先用关系表达语义 | 充分利用图数据库能力 |
| **角色隔离** | 不同角色看到不同视图 | 数据权限与业务权限分离 |
| **Agent Ready** | 从设计之初考虑 Agent 消费 | 结构化查询 + 自然语言接口 |
| **LinkType 一等公民** | 关系与对象都是 schema | 注册、版本化、权限控制 |

### 6.2 实施路线图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           实施路线图                                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Phase 1: 基础建模 (4-6周)                                                  │
│  ────────────────────────────────────────────────────────────────────      │
│  • 定义核心 ObjectType（Category / Brand / Attribute / AttributeValue /     │
│    SPU / SKU / Merchant / Warehouse / Price / Inventory / MerchantSKU）     │
│  • 设计图数据库 Schema                                                       │
│  • 实现基础 CRUD API                                                         │
│  • 迁移现有数据到图模型                                                      │
│                           │                                                 │
│                           ▼                                                 │
│  Phase 2: 角色协同 (3-4周)                                                   │
│  ────────────────────────────────────────────────────────────────────      │
│  • 实现权限系统                                                              │
│  • 开发角色专属工作台                                                        │
│  • 构建协同流程引擎                                                          │
│                           │                                                 │
│                           ▼                                                 │
│  Phase 3: Agent 能力 (4-6周)                                                  │
│  ────────────────────────────────────────────────────────────────────      │
│  • 部署 L1 数据访问 Agent                                                    │
│  • 开发 L2 语义检索能力                                                      │
│  • 构建 L3 推理分析模型                                                      │
│  • 集成 RAG 增强                                                            │
│                           │                                                 │
│                           ▼                                                 │
│  Phase 4: 智能应用 (4-8周)                                                   │
│  ────────────────────────────────────────────────────────────────────      │
│  • 智能搜索推荐                                                              │
│  • 商家运营助手                                                              │
│  • 品类运营分析                                                              │
│  • 智能定价与库存优化                                                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 技术栈建议

| 层级 | 推荐技术 | 说明 |
|------|---------|------|
| **图数据库** | Neo4j / TigerGraph | 核心数据存储 |
| **向量数据库** | Pinecone / Milvus | RAG增强 |
| **应用框架** | FastAPI / NestJS | API服务 |
| **LLM** | GPT-4 / Claude | Agent推理 |
| **缓存层** | Redis | 热数据缓存 |
| **消息队列** | Kafka | 事件驱动 |

---

## 附录 A：电商产品数据模型 ↔ Palantir V4 概念映射表

> **本附录新增于 V4.1（2026-07-27）**，根据 `电商产品数据模型.md`（v1.0）对齐。
>
> 本表建立两份文档之间的**双向概念映射**，帮助工程师在「传统电商数据模型」与「Palantir 语义建模方案 V4」之间建立一一对应关系。两份文档应保持同步更新。

### A.1 核心实体映射

| 电商产品数据模型（v1.0） | Palantir V4 对应 | 说明 |
|------------------------|-----------------|------|
| `Category` 品类 | `OT_CATEGORY` | V4 路线 B 下仅承担「业务归属 + 模板引用」职责 |
| `Brand` 品牌 | `OT_BRAND` | 完全对齐 |
| `SPU` 标准产品单元 | `OT_SPU` | V4 中 `description`/`images` 字段与 v1.0 §2.3 完全对齐 |
| `SKU` 库存量单位 | `OT_SKU` | 完全对齐 |
| `Attribute Template` 属性模板 | `OT_SPU_TEMPLATE` | **核心映射**：v1.0 的 `attributes[]` 列表 = V4 的 `TEMPLATE_REFERENCES_ATTR` link |
| `Attribute Value` 属性值 | `OT_ATTRIBUTE_VALUE` | V4 新增 `display_meta.color_hex`/`extra_data` 等展示元数据 |
| `Sales Attribute` 销售属性 | `scope=sales` + `is_combination_key=true` | **关键映射**：销售属性驱动 SKU 笛卡尔积组合 |
| `Basic Attribute` 基本属性 | `scope=required` | SPU 级展示字段，不参与 SKU 组合 |
| `Optional Attribute` 可选属性 | `scope=optional` | SPU 级可选字段 |
| `Product Desc` 商品描述 | `OT_SPU.description`（TEXT） | 富文本描述字段 |
| `Product Image` 商品图片 | `OT_SPU.images`（ARRAY[STRING]） | URL 列表 |
| `Price` 价格 | `OT_PRICE` | 完全对齐 |
| `Inventory` 库存 | `OT_INVENTORY` | 完全对齐 |

### A.2 关键字段映射

| 电商产品数据模型（v1.0）字段 | Palantir V4 对应字段 | 说明 |
|----------------------------|---------------------|------|
| `template.attributes[].is_sales_attr` | `TEMPLATE_REFERENCES_ATTR.scope` | `true` → `scope=sales` |
| `template.attributes[].is_required` | `TEMPLATE_REFERENCES_ATTR.scope` | `true` → `scope=required` |
| `template.attributes[].options` | `TEMPLATE_REFERENCES_ATTR.allowed_value_refs` | 值池子集限制 |
| `sku.sales_attrs`（颜色:黑色;容量:128GB） | `OT_SKU` + `HAS_ATTR_VALUE` link | 每组属性值 = 一个 `attr_value_id` |
| `attr_value.color_hex` | `OT_ATTRIBUTE_VALUE.display_meta.color_hex` | 颜色十六进制（如 #1C1C1E） |
| `attr_value`（3561mAh） | `OT_ATTRIBUTE_VALUE.display_meta.extra_data` | 含 `unit: mAh, numeric_value: 3561` |
| `spu.description` | `OT_SPU.description` | 富文本产品描述 |
| `spu.images[]` | `OT_SPU.images` | 图片 URL 列表 |
| `sku_id` | `OT_SKU.sku_id` | 完全对齐 |
| `merchant_sku_id` | `OT_MERCHANT_SKU.merchant_sku_id` | 完全对齐 |
| `sku.price / sku.cost_price` | `OT_MERCHANT_SKU` → `HAS_PRICE` → `OT_PRICE` | 三跳关系（商户 SKU → 价格节点 → 价格值） |
| `sku.stock` | `OT_MERCHANT_SKU` → `HOLDS_INVENTORY` → `OT_INVENTORY` | 三跳关系（商户 SKU → 库存边 → 库存节点） |

### A.3 关键业务逻辑映射

| 业务逻辑（电商产品数据模型） | Palantir V4 实现方式 |
|--------------------------|---------------------|
| 销售属性驱动 SKU 笛卡尔积组合（5色×4容量=20 SKU） | `scope=sales` + `is_combination_key=true` 的属性组合，通过 `GENERATES` link 自动生成 SKU 实例 |
| 基本属性在 SPU 级展示（屏幕尺寸/电池容量/芯片） | `scope=required` 的属性值记录在 `OT_SPU.specifications` 中，不生成独立 SKU |
| 属性模板绑定到品类 | `OT_CATEGORY.spu_template_ref` 强制引用一个 `OT_SPU_TEMPLATE` |
| 商家定价（销售价/划线价/成本价） | `OT_MERCHANT_SKU` → `HAS_PRICE` → `OT_PRICE`，通过 `price_type` 区分 `sale_price / original_price / cost_price` |
| 库存按仓库独立管理 | `OT_MERCHANT_SKU` → `HOLDS_INVENTORY` → `OT_INVENTORY`，`LOCATED_AT` → `OT_WAREHOUSE` |
| 颜色值展示元数据（色卡图、十六进制） | `OT_ATTRIBUTE_VALUE.display_meta.color_hex` / `image_url` |
| 数值类属性值（电池容量/屏幕尺寸） | `OT_ATTRIBUTE_VALUE.display_meta.extra_data` 含 `unit` 和 `numeric_value`，支持前端格式化展示 |

### A.4 SKU 组合数量计算公式

电商产品数据模型 §2.5 给出了具体案例（5色×4容量×1制式×1类型=20 SKU），Palantir V4 的等价值量：

```
SKU 总数 = Π (scope=sales 且 is_combination_key=true 的各属性 allowed_value_refs 长度)

iPhone 案例：
  = count(ATTR_COLOR.allowed_value_refs)   // 4（黑/白/粉/蓝）
  × count(ATTR_CAPACITY.allowed_value_refs)  // 3（128GB/256GB/512GB）
  × count(ATTR_NETWORK_TYPE.allowed_value_refs)  // 1（公开版）
  × count(ATTR_BUNDLE_TYPE.allowed_value_refs)    // 1（零售版）
  = 4 × 3 × 1 × 1 = 12  ← 实际是 4×3=12，与电商产品数据模型不完全一致，
                              这是因为本案例未引用 ATTR003（网络制式）和 ATTR004（标配类型）
                              作为 is_combination_key=true 的属性。
                              电商产品数据模型 §2.5 中 ATTR003/004 也都是 is_sales_attr=true，
                              若在 Palantir 模板中将它们也设为 is_combination_key=true，
                              则自动生成 5×4×1×1=20 个 SKU（与电商产品数据模型一致）。
```

### A.5 同步维护约定

| 场景 | 维护方 | 同步规则 |
|------|--------|---------|
| 新增属性（颜色/容量等） | 平台运营定义 `OT_ATTRIBUTE` | 同时在电商产品数据模型 §2.4 新增一行 `attr_id` 记录 |
| 修改属性值池（如新增「深青色」） | 平台运营修改 `OT_ATTRIBUTE_VALUE` | 同时更新电商产品数据模型 §2.4 `options` 列 |
| 新增销售属性到模板 | 平台运营编辑 `OT_SPU_TEMPLATE.TEMPLATE_REFERENCES_ATTR` | 重新计算 SKU 组合数量，更新 §2.5 组合矩阵 |
| SPU 新增基本属性（如新增「芯片」字段） | 品类经理编辑 `OT_SPU.specifications` | 同步更新电商产品数据模型 §2.3 SPU 数据行 |
| SKU 属性值展示元数据变更 | 平台运营修改 `OT_ATTRIBUTE_VALUE.display_meta` | 同步更新电商产品数据模型 §2.6 `color_hex` / `extra_data` |

---

## 附录：修订记录

| 版本 | 日期 | 主要变更 | 归档位置 |
|------|------|---------|---------|
| V1 | 2026-07-26 | 初始版本 | `docs/history/Palantir范式电商语义建模方案_V1.md` |
| V2 | 2026-07-26 | **结构性 / 完备性 / 一致性 三轮审计重写**：① 重画 §1.2 架构图，完整呈现 10 个 ObjectType + 10 个 LinkType，删除凭空出现的 `CategoryType / BrandType / AttrType / WarehouseType / SKUInstanceType` 节点；② §2.1 节补全缺失的 OT_BRAND / OT_MERCHANT / OT_WAREHOUSE / OT_ATTRIBUTE_VALUE / OT_PRICE / OT_INVENTORY 定义；③ §2.1.2 补 OT_SKU_TEMPLATE 的 `applicable_categories` 反向引用；④ §2.1 节章节统一标题为「ObjectType 定义 (OT_XXX)」；⑤ §2.2 实例字段与 schema 对齐（`category_id` → `primary_category_id` 等）；⑥ §2.2.3 仓库链接改为 `target: INV_xxx` 走 Inventory 而非直连 Warehouse；⑦ §4.1.1 节点表补 OT_MERCHANT_SKU / OT_ATTRIBUTE_VALUE / OT_PRICE / OT_INVENTORY / OT_WAREHOUSE 节点；⑧ §4.1.2 边表明确 From 节点到节点，补 MerchantSKU 节点；⑨ §4.3.3 / §5.2.1 / §5.2.3 查询里 `:SELLS` 替换为 `:SOLD_BY`，方向修正为 `(:SKU)-[:SOLD_BY]->(:Merchant)`，价格经 `(:MerchantSKU)-[:HAS_PRICE]->(:Price)`；⑩ §3.2.x 角色表 `visible_object_types` 改用 `OT_XXX` 命名；⑪ 全部 OT_xxx 引用补全定义或明确标注「v3 规划」 | `docs/history/Palantir范式电商语义建模方案_V2.md` |
| V3 | 2026-07-26 | **补全模板 ↔ 属性字典 ↔ 属性值池 三层关系设计闭环**：① §1.1.1 LinkType 清单新增 `#11 HAS_CANDIDATE_VALUE`（属性字典→值池）和 `#12 TEMPLATE_REFERENCES_ATTR`（模板→属性字典，linkProperties 含 `allowed_value_refs`），将 LinkType 数从 10 提升到 12；② §2.1.1 / §2.1.2 模板定义的 `property_groups` / `sales_attribute_definitions` 改为 `required_attribute_refs` / `sales_attribute_rules`，从"写死属性"改为"引用 OT_ATTRIBUTE 全局属性字典"；③ §2.1.3 OT_ATTRIBUTE 新增 `scope`（PLATFORM_GLOBAL / CATEGORY_SCOPED / TEMPLATE_LOCAL）与 `value_pool_mode`（FIXED_GLOBAL / EXTENSIBLE / RESTRICTED_BY_TEMPLATE）两个核心字段；④ §2.1.4 OT_ATTRIBUTE_VALUE 新增 `pool_owner`（PLATFORM_POOL / CATEGORY_SCOPED_POOL / TEMPLATE_RESTRICTED_POOL）与 `is_default`；⑤ §1.2 架构图重画，在第一层 B 区补齐"模板 ↔ 属性字典 ↔ 值池"三层连线，新增 HAS_CANDIDATE_VALUE 与 TEMPLATE_REFERENCES_ATTR 两个 LinkType 标注；⑥ §2.2.8 新增「属性三层模型协同示例（iPhone vs T 恤双案例）」，用同一属性 ATTR_COLOR 在两个模板里 allowed_value_refs 不同 + 跨品类比价 两个场景演示设计收益；⑦ §2.3.1 元数据到实例映射表更新，补 N:N 映射与"取值必须落在模板 allowed_value_refs 内"约束；⑧ §4.1.2 边表新增 `:HAS_CANDIDATE_VALUE` 与 `:TEMPLATE_REFERENCES_ATTR`，并补充 `:HAS_ATTR_VALUE` 在 SPU 与 SKU 两侧的不同语义；⑨ §4.2 Cypher Schema 新增三个索引（attr_candidate_sort / attr_candidate_default / template_refs_scope）；⑩ §4.3.5 新增「属性三层模型查询」三个 Cypher 业务示例（值池子集计算 / 商家 SKU 提交校验 / 跨品类属性聚合） | `docs/history/Palantir范式电商语义建模方案_V2.md` |
| **V4** | **2026-07-26** | **路线 B（Template-Centric）重构：Category 退化为"业务归属 + 模板引用"，OT_SPU_TEMPLATE 成为属性声明的唯一入口**：① §1.1.1 LinkType 清单**删除**原 LinkType #6 `DECLARES_ATTRIBUTE`（Category → Attribute），LinkType 总数从 12 降为 **11**，原 #11/#12 顺位调整为 #10/#11；② §2.1.5 OT_CATEGORY 简化，**删除 `inheritance_chain` 块**（parent_chain / inherited_properties / overridable），`spu_template_ref` 升级为**强制非空字段**；③ §2.1.3 OT_ATTRIBUTE **删除 `is_sales_attribute` 与 `is_inheritable` 字段** —— 是否销售属性、是否继承这两个语义在 V4 下由 Template 决定，不在全局属性字典上；④ §2.2.1 品类实例 **删除 `inherited_values` 块**（不再"从父 Category 继承属性"）；⑤ §2.2.8 OT_ATTRIBUTE 示例中删除 `is_sales_attribute` 字段；⑥ §2.3.1 元数据到实例映射表**删除 "Category → Attribute" 行**，"SPUTemplate → Attribute" 加粗标注为"V4 唯一属性声明入口"；⑦ §2.3.2 继承关系映射重画 —— 业务归属（status / URL / 面包屑）保留继承，**属性不再沿 Category 链累加继承**；⑧ §1.2 / §4.4 架构图与图数据结构示例中**删除 Category-Attribute 直接连线**，改为 Category → SPUTemplate → Attribute 两步链路（`:USES_TEMPLATE` + `:TEMPLATE_REFERENCES_ATTR`）；⑨ §4.1.2 边表**删除 `:DECLARES` 行**，LinkType 编号 #11/#12 → #10/#11；⑩ §4.3.2 SKU 生成链路追溯 Cypher 中 `[:DECLARES]` 改为 `[:TEMPLATE_REFERENCES_ATTR]` 链路；⑪ §3.1 / §3.2.x 角色表调整 —— 平台运营 can_modify 中 `attribute_templates` 改为更精确的 `spu_sku_templates` + 新增 `spu_template_ref`；品类经理职责从"属性定义"改为"为新品类选/切换 spu_template_ref"；⑫ §3.4 冲突处理"品类属性覆盖冲突"行**替换**为"模板属性值域冲突"（Category 切换模板时新模板值域必须是旧模板子集）；⑬ §3.3 角色协同流程图阶段 1 改写为"V4 路线 B：模板是属性声明的唯一入口"；⑭ 新增正文 V4 设计原则提示框（§1 / §1.1.1 / §2.1.5 / §2.2.8 / §2.3.1 / §2.3.2 / §3 / §4.4 多处） | `docs/Palantir范式电商语义建模方案.md` |

---

*文档结束*

