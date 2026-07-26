# 基于 Palantir 范式的电商产品语义建模方案

> **文档版本**: v1.0  
> **创建时间**: 2026-07-26  
> **核心主题**: 两层语义模型设计、Graph构建与Agent消费场景

---

## 一、Palantir 范式解读与电商映射

### 1.1 Palantir 核心概念回顾

| Palantir 概念 | 定义 | 电商场景映射 |
|--------------|------|------------|
| **Object Type** | 对象的类型定义（实体/事件） | 品类、品牌、SPU、SKU、商家、仓库 |
| **Property Type** | 对象类型的属性定义（含基础类型、约束） | 品类的"名称"、SKU的"价格"等 |
| **Object Instance** | ObjectType 的具体实例 | 具体SPU（如iPhone 16）、具体商家（如店小二旗舰店） |
| **Link Type** | **连接两个 ObjectType 的关系类型定义（与 ObjectType 平级的一等公民）** | "品类-PARENT_OF-品类"、"SPU-GENERATES-SKU"、"SKU-SOLD_BY-商家" |
| **Interface Type** | 多 ObjectType 可实现的共享 shape（类似接口/抽象类） | "Inspectable"、"Sellable"、"InventoryHoldable" |
| **Action Type** | 可对 Object 执行的可写操作（含参数、返回、权限） | 上架、定价、下单、调拨 |
| **Backing Datasource** | ObjectType / LinkType 背后的物理数据源（数据集/流） | 关系数据库表、流式管道 |

### 1.1.1 LinkType 详解（核心补充）

Palantir 中 LinkType 与 ObjectType 平级，是 Ontology 的一等公民，不是附属品。其官方定义为：

> "A link type is the **schema definition of a relationship between two object types**. A link refers to a single instance of that relationship between two objects in the same Ontology."

LinkType 有四个关键特征：

| 特征 | 说明 | 电商映射举例 |
|------|------|------------|
| **双向 (bidirectional)** | 一个 LinkType 永远有两端，两端可独立遍历，命名可不同 | `SPU ↔ SKU` 一侧叫 `generatesSkus`，另一侧叫 `generatedFromSpu` |
| **可自连接 (self-link)** | 两端可以是同一个 ObjectType | `Category ↔ Category` 的 `PARENT_OF` |
| **可带属性 (link-side properties)** | LinkType 自身可声明 PropertyType（Palantir 中通过 Shared Property Type 实现） | `MerchantSKU` 上的价格、库存数 |
| **可独立 backing datasource** | 多对多关系可由专门的 LinkType datasource 支撑 | `MerchantSKU` 这张关系表 |

#### 电商场景的 LinkType 清单

```
电商领域 LinkType（与 ObjectType 平级定义）：

┌────────────────────────────────────────────────────────────────────────────┐
│                            LinkType 注册表                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. Category ↔ Category                                                    │
│     • link_id:   PARENT_OF                                                │
│     • A-side:    parentCategory (显示名: "父品类")                          │
│     • B-side:    subCategories (显示名: "子品类集合")                       │
│     • properties: rank(顺序)、inherit_strategy(继承策略)                    │
│     • backing:   category.category_parent_id 外键                         │
│                                                                            │
│  2. Category ↔ SPU                                                        │
│     • link_id:   BELONGS_TO_CATEGORY                                      │
│     • A-side:    spusInCategory                                           │
│     • B-side:    primaryCategory / alsoInCategories                       │
│     • properties: is_primary(是否主品类)                                   │
│                                                                            │
│  3. SPU ↔ Brand                                                            │
│     • link_id:   HAS_BRAND                                                │
│     • A-side:    brandedProducts                                          │
│     • B-side:    brand                                                    │
│     • properties: (无)                                                     │
│                                                                            │
│  4. SPU ↔ SKU                                                              │
│     • link_id:   GENERATES                                                │
│     • A-side:    generatedSkus                                            │
│     • B-side:    generatedFromSpu                                         │
│     • properties: combination_key(组合标识)                                │
│                                                                            │
│  5. SKU ↔ AttributeValue                                                   │
│     • link_id:   HAS_ATTR_VALUE                                           │
│     • A-side:    attrValues                                               │
│     • B-side:    belongsToSku                                             │
│     • properties: (无)                                                     │
│                                                                            │
│  6. Category ↔ Attribute (模板属性)                                         │
│     • link_id:   DECLARES_ATTRIBUTE                                        │
│     • A-side:    declaredAttributes                                        │
│     • B-side:    applicableCategories                                      │
│     • properties: is_required, is_sales_attr, is_inheritable               │
│                                                                            │
│  7. SKU ↔ Merchant                                                         │
│     • link_id:   SOLD_BY (带属性，可独立 datasource)                       │
│     • A-side:    sellers                                                  │
│     • B-side:    soldSkus                                                 │
│     • properties: merchant_sku_id, status, listing_time                    │
│     • backing:   merchant_sku 表 (M:N 关系表)                              │
│                                                                            │
│  8. MerchantSKU ↔ Price                                                    │
│     • link_id:   HAS_PRICE                                                │
│     • properties: sale_price, original_price, cost_price, price_type       │
│                                                                            │
│  9. MerchantSKU ↔ Inventory                                                │
│     • link_id:   HOLDS_INVENTORY                                           │
│     • A-side:    inventoryItems                                           │
│     • B-side:    heldByMerchantSku                                        │
│     • properties: warehouse_id, available, reserved, alert_threshold       │
│     • backing:   inventory 表                                              │
│                                                                            │
│  10. Inventory ↔ Warehouse                                                  │
│      • link_id:   LOCATED_AT                                               │
│      • A-side:    stockholdings                                            │
│      • B-side:    warehouse                                                │
│      • properties: (无)                                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

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

> ⚠️ 关键认知修正：在 Palantir 范式下，**关系是有"schema"的**，不是 Graph DB 里随便创建一条边那么简单。LinkType 本身需要被版本化、被注册、被权限控制。这也是为什么原文档 1.1 的表格存在缺陷 —— 我把 LinkType 当作"附属概念"，忽略了它与 ObjectType 平级的核心地位。

### 1.2 电商语义两层模型架构

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    Palantir 范式下的电商语义两层模型                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                     第一层：元数据层 (Meta Layer)                        │   │
│  │  ═══════════════════════════════════════════════════════════════════   │   │
│  │                                                                         │   │
│  │  对应 Palantir 的 Object Type 定义                                            │   │
│  │                                                                             │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                     第一层 A：模板类型（电商特有，元数据的元数据）           │ │   │
│  │  │  — 这层是电商特有的，Palantir 原生 Ontology 中没有对应物                   │ │   │
│  │  │  — 作用：品类运营定义"某类 SPU 必须有哪些属性"，本质是"类型的类型"           │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                             │   │
│  │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    │   │
│  │  │   CategoryType   │    │   BrandType      │    │   AttrType       │    │   │
│  │  │   品类类型定义     │    │   品牌类型定义    │    │   属性类型定义    │    │   │
│  │  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘    │   │
│  │           │                       │                       │              │   │
│  │           └───────────────────────┼───────────────────────┘              │   │
│  │                                   ▼                                      │   │
│  │                    ┌──────────────────────────────┐                       │   │
│  │                    │      SPUTemplateType        │                       │   │
│  │                    │   SPU模板类型（标准产品模板）  │                       │   │
│  │                    │   - 规定必须有哪些属性        │                       │   │
│  │                    │   - 规定属性的数据类型         │                       │   │
│  │                    │   - 规定属性的约束规则         │                       │   │
│  │                    └───────────────┬──────────────┘                       │   │
│  │                                    │                                      │   │
│  │                    ┌───────────────┴───────────────┐                      │   │
│  │                    ▼                               ▼                      │   │
│  │  ┌──────────────────────────┐    ┌──────────────────────────┐             │   │
│  │  │   SKUTemplateType       │    │   WarehouseType         │             │   │
│  │  │   SKU模板类型            │    │   仓库类型定义            │             │   │
│  │  └──────────────────────────┘    └──────────────────────────┘             │   │
│  │                                                                             │   │
│  │  ═══════════════════════════════════════════════════════════════════════════ │   │
│  │  第一层 B：ObjectType 定义（对应 Palantir 原生概念）                              │   │
│  │  ═══════════════════════════════════════════════════════════════════════════ │   │
│  │                                                                             │   │
│  │  ┌──────────────────────────┐    ┌──────────────────────────┐               │   │
│  │  │   OT_SPU                │    │   OT_SKU                │               │   │
│  │  │   SPU的对象类型定义       │    │   SKU的对象类型定义       │               │   │
│  │  │   ← OT_SPU 是 schema，   │    │   ← OT_SKU 是 schema，   │               │   │
│  │  │     不是模板！            │    │     不是实例！            │               │   │
│  │  │   它的 properties 由     │    │   它的 properties 由     │               │   │
│  │  │   SPUTemplate 驱动生成    │    │   SKUTemplate 驱动生成    │               │   │
│  │  └────────┬─────────────────┘    └──────────────┬────────────┘               │   │
│  │           │ GENERATES (LinkType)                      │                     │   │
│  │           └────────────────────────────────────────────┘                     │   │
│  │                                ▼                                              │   │
│  │                     ┌──────────────────────────┐                             │   │
│  │                     │   OT_MerchantSKU         │                             │   │
│  │                     │   (SOLD_BY link 的       │                             │   │
│  │                     │    linkProperties 沉淀)  │                             │   │
│  │                     └──────────────────────────┘                             │   │
│  │                                                                             │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                             │
│                                      │ 实例化（填入具体值）                           │
│                                      ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                     第二层：Object Instance（对应 Palantir 原生概念）           │   │
│  │  ═══════════════════════════════════════════════════════════════════════════   │   │
│  │                                                                             │   │
│  │  ┌──────────────────────┐         ┌──────────────────────┐                 │   │
│  │  │   SPU Instance       │         │   SKU Instance       │                 │   │
│  │  │   SPU20260001        │ GENERATES│ SKU202600001        │                 │   │
│  │  │   "Apple iPhone 16"  │────────▶│ "128GB 黑色 公开版" │                 │   │
│  │  │   ← type_id: "OT_SPU"│         │ ← type_id: "OT_SKU"  │                 │   │
│  │  └──────────────────────┘         └──────────────────────┘                 │   │
│  │                                                                             │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、数据与映射构建方案

### 2.1 第一层元数据的建模

> **本节说明**：第一层包含**两套**类型定义：
> - **模板类型**（A）：SPUTemplate、SKUTemplate — 电商特有的"元数据的元数据"，规定"某类 SPU 有哪些属性"
> - **ObjectType**（B）：OT_SPU、OT_SKU — Palantir 原生概念，对应"实例的数据结构"，由模板驱动生成
>
> **重要区分**：OT_SPU ≠ SPUTemplate。OT_SPU 是 ObjectType 定义（表格的列），SPUTemplate 是驱动它生成的规则（表格模板的 Word 模板文件）。

#### 2.1.1 品类类型定义 (CategoryType)

```json
{
  "object_type": "CategoryType",
  "type_id": "OT_CATEGORY",
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
      "description": "父品类ID（支持层级继承）"
    },
    "level": {
      "type": "INTEGER",
      "is_required": true,
      "description": "品类层级深度"
    },
    "path": {
      "type": "STRING",
      "description": "品类完整路径，如 /1001/1002/1003"
    },
    "spu_template_ref": {
      "type": "STRING",
      "is_foreign_key": true,
      "references": "OT_SPU_TEMPLATE",
      "description": "关联的SPU模板"
    },
    "status": {
      "type": "ENUM",
      "values": ["active", "inactive", "deprecated"],
      "default": "active"
    }
  },
  "inheritance_chain": {
    "parent_chain": ["ROOT_CATEGORY"],
    "inherited_properties": ["status", "audit_rules"],
    "overridable": ["spu_template_ref"]
  }
}
```

#### 2.1.2 SPU模板类型 (SPUTemplateType)

```json
{
  "object_type": "SPUTemplateType",
  "type_id": "OT_SPU_TEMPLATE",
  "properties": {
    "template_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "template_name": {
      "type": "STRING",
      "is_required": true
    },
    "applicable_categories": {
      "type": "ARRAY[STRING]",
      "references": ["OT_CATEGORY"],
      "description": "适用的品类列表（支持多品类共用模板）"
    }
  },
  "property_groups": {
    "required_attributes": {
      "description": "必填属性组",
      "attributes": [
        {
          "attr_id": "ATTR001",
          "attr_name": "品牌",
          "data_type": "REFERENCE",
          "ref_type": "OT_BRAND",
          "validation_rules": {
            "must_be_in_category_whitelist": true
          }
        },
        {
          "attr_id": "ATTR002",
          "attr_name": "产品名称",
          "data_type": "STRING",
          "validation_rules": {
            "max_length": 200,
            "pattern": "^[\\u4e00-\\u9fa5a-zA-Z0-9\\s]+$"
          }
        }
      ]
    },
    "optional_attributes": {
      "description": "可选属性组",
      "attributes": []
    }
  },
  "sales_attribute_definitions": {
    "description": "销售属性定义（影响SKU组合）",
    "attributes": [
      {
        "attr_id": "ATTR_SALES_001",
        "attr_name": "颜色",
        "is_combination_key": true,
        "options_source": "ENUM",
        "options": []
      }
    ]
  }
}
```

#### 2.1.3 SKU模板类型 (SKUTemplateType)

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
      "references": "OT_SPU_TEMPLATE",
      "description": "引用父级 SPU 模板（SKU 模板是 SPU 模板的销售属性子集）"
    },
    "sales_attribute_rules": {
      "type": "ARRAY[OBJECT]",
      "description": "销售属性组合规则",
      "items": {
        "attr_id": {
          "type": "STRING",
          "references": "OT_ATTRIBUTE"
        },
        "attr_name": {
          "type": "STRING"
        },
        "is_combination_key": {
          "type": "BOOLEAN",
          "default": false,
          "description": "是否参与 SKU 笛卡尔积组合"
        },
        "options_source": {
          "type": "ENUM",
          "values": ["ENUM", "DYNAMIC_FROM_SPU"],
          "description": "选项来源：枚举值 或 从 SPU 实例动态获取"
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

#### 2.1.4 属性类型定义 (AttributeType)

```json
{
  "object_type": "AttributeType",
  "type_id": "OT_ATTRIBUTE",
  "properties": {
    "attr_id": {
      "type": "STRING",
      "is_primary_key": true
    },
    "attr_name": {
      "type": "STRING",
      "is_required": true
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
    "is_sales_attribute": {
      "type": "BOOLEAN",
      "default": false,
      "description": "是否销售属性（影响SKU生成）"
    },
    "is_inheritable": {
      "type": "BOOLEAN",
      "default": true,
      "description": "是否可从父品类继承"
    },
    "is_required": {
      "type": "BOOLEAN",
      "default": false
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

> **元数据层结构说明**：第一层实际上包含**两套平行的 Object Type**，而非一套：
> - **模板类型**（Template）：SPUTemplate、SKUTemplate，用于定义"规则"和"结构"，本质上是元数据的元数据
> - **实例类型**（Instance）：OT_SPU、OT_SKU，用于定义"实例的数据结构"，由对应模板驱动生成
>
> 两者关系：OT_SPU_TEMPLATE 规定 OT_SPU 拥有哪些属性列，OT_SKU_TEMPLATE 规定 OT_SKU 拥有哪些属性列。

#### 2.1.5 SPU的ObjectType定义 (SPUInstanceType → OT_SPU)

> **关键区分**：此处的 `OT_SPU` 是 **ObjectType 定义**（规定 SPU 实例有哪些字段），不是模板。
> SPUTemplateType (OT_SPU_TEMPLATE) 是驱动它生成的规则。

```json
{
  "object_type": "SPUInstanceType",
  "type_id": "OT_SPU",
  "description": "标准产品实例类型，由 SPUTemplate 驱动生成",
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
      "target": "OT_SKU",
      "cardinality": "ONE_TO_MANY",
      "description": "SPU生成SKU实例"
    },
    "BELONGS_TO_CATEGORY": {
      "target": "OT_CATEGORY",
      "cardinality": "MANY_TO_MANY",
      "description": "SPU归属品类（主品类+关联品类）"
    },
    "HAS_BRAND": {
      "target": "OT_BRAND",
      "cardinality": "MANY_TO_ONE",
      "description": "SPU归属品牌"
    }
  }
}
```

#### 2.1.6 SKU的ObjectType定义 (SKUInstanceType → OT_SKU)

> **关键区分**：此处的 `OT_SKU` 是 **ObjectType 定义**（规定 SKU 实例有哪些字段），不是实例。
> SKUTemplateType (OT_SKU_TEMPLATE) 是驱动它生成的规则。

```json
{
  "object_type": "SKUInstanceType",
  "type_id": "OT_SKU",
  "description": "库存单元实例类型，由 SKUTemplate 驱动生成",
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
      "target": "OT_SPU",
      "cardinality": "MANY_TO_ONE",
      "description": "SKU归属SPU"
    },
    "HAS_ATTR_VALUE": {
      "target": "OT_ATTRIBUTE_VALUE",
      "cardinality": "MANY_TO_MANY",
      "description": "SKU关联属性值"
    },
    "SOLD_BY": {
      "target": "OT_MERCHANT",
      "cardinality": "MANY_TO_MANY",
      "description": "SKU被商家认领销售（LinkProperties沉淀在SOLD_BY上）"
    }
  }
}
```

#### 2.1.7 商家SKU实例类型 (MerchantSKUInstanceType)

```json
{
  "object_type": "MerchantSKUInstanceType",
  "type_id": "OT_MERCHANT_SKU",
  "description": "商家SKU实例，实质是 SOLD_BY LinkType 的 linkProperties 沉淀为独立 ObjectType",
  "is_derived_from_link": "SOLD_BY",
  "link_properties": {
    "merchant_sku_id": {
      "type": "STRING",
      "is_primary_key": true,
      "description": "商家侧SKU唯一标识"
    },
    "status": {
      "type": "ENUM",
      "values": ["DRAFT", "ONLINE", "OFFLINE", "BANNED"],
      "default": "DRAFT"
    },
    "sale_price": {
      "type": "DECIMAL",
      "is_required": true,
      "validation": {"min": 0},
      "description": "销售价（单位：元）"
    },
    "original_price": {
      "type": "DECIMAL",
      "description": "划线价"
    },
    "cost_price": {
      "type": "DECIMAL",
      "description": "成本价"
    },
    "total_inventory": {
      "type": "INTEGER",
      "default": 0,
      "description": "总库存"
    },
    "listing_time": {
      "type": "TIMESTAMP",
      "description": "上架时间"
    }
  },
  "reference_keys": {
    "sku_id": {
      "type": "STRING",
      "references": "OT_SKU"
    },
    "merchant_id": {
      "type": "STRING",
      "references": "OT_MERCHANT"
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
  "type": "OT_CATEGORY",
  "properties": {
    "category_id": "1003",
    "category_name": "iPhone",
    "parent_category_id": "1002",
    "level": 3,
    "path": "/1001/1002/1003",
    "spu_template_ref": "TMPL_IPHONE"
  },
  "inherited_values": {
    "from_parent_1002": {
      "status": "active",
      "audit_rules": "需要品牌授权"
    },
    "from_root": {
      "status": "active"
    }
  }
}
```

#### 2.2.2 SPU实例 (SPU Instance)

> 第二层的"实例"是 **Object Instance**，对应第一层定义的 **Object Type**（如 OT_SPU）。一个 SPU 实例 = OT_SPU 类型的一条行记录。

```json
{
  "_type_definition_ref": "OT_SPU (见 2.1.5)",    // ← 引用第一层定义的类型
  "object_instance": "SPU Instance",
  "instance_id": "SPU20260001",
  "type_id": "OT_SPU",
  "template_ref": "TMPL_IPHONE",                  // ← 引用 OT_SPU_TEMPLATE (见 2.1.2)
  "properties": {
    "spu_id": "SPU20260001",
    "spu_name": "Apple iPhone 16",
    "brand_id": "B001",
    "category_id": "1003",
    "description": "官方正品iPhone 16",
    "specifications": {
      "chip": "A18",
      "screen": "6.1英寸",
      "battery": "3561mAh"
    },
    "images": ["主图1.jpg", "详情图1.jpg"]
  },
  "attribute_values": {
    "ATTR001": "Apple",
    "ATTR002": "iPhone 16",
    "ATTR007": "6.1英寸",
    "ATTR008": "3561mAh",
    "ATTR009": "2025"
  },
  "derived_sku_count": 20,
  "status": "待商家填充价格"
}
```

#### 2.2.3 SKU实例 (SKU Instance)

> SKU 实例对应 OT_SKU 类型（见 2.1.6）。`merchant_bindings` 里的价格和库存实际是 SOLD_BY LinkType 的 linkProperties，通过 `SOLD_BY` link 关联到 OT_MERCHANT。

```json
{
  "_type_definition_ref": "OT_SKU (见 2.1.6)",       // ← 引用第一层定义的类型
  "object_instance": "SKU Instance",
  "instance_id": "SKU202600001",
  "type_id": "OT_SKU",
  "template_ref": "TMPL_IPHONE_SKU",                // ← 引用 OT_SKU_TEMPLATE (见 2.1.3)
  "parent_spu_ref": "SPU20260001",                  // ← GENERATED_FROM_SPU link
  "properties": {
    "sku_id": "SKU202600001",
    "sku_name": "iPhone 16 128GB 黑色 公开版",
    "sales_attrs": {
      "颜色": "黑色",
      "容量": "128GB",
      "制式": "公开版"
    }
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
        "merchantSkuId": "MSKU001",
        "status": "ONLINE",
        "salePrice": 6299.00,
        "originalPrice": 6999.00,
        "_inventoryLinks": [
          {
            "target": "WH001",
            "availableStock": 50
          }
        ]
      },
      {
        "target": "M20260002",
        "merchantSkuId": "MSKU002",
        "status": "ONLINE",
        "salePrice": 6199.00,
        "_inventoryLinks": [
          {
            "target": "WH002",
            "availableStock": 30
          }
        ]
      }
    ]
  }
}
```

> 注：`SOLD_BY` 里的 `salePrice`、`status` 等字段本质是 LinkType 的 linkProperties，不是 SKU 自己的属性。通过遍历 `SOLD_BY` link 可以访问所有商家的报价。
```

### 2.3 映射关系构建

#### 2.3.1 元数据到实例的映射表

| 映射关系 | 源 | 目标 | 映射类型 | 说明 |
|---------|-----|------|---------|------|
| Category→SPUTemplate | 品类实例 | SPU模板 | N:1 | 品类引用其适用的SPU模板 |
| SPUTemplate→Attribute | SPU模板 | 属性定义 | 1:N | 模板规定包含哪些属性 |
| Category→Attribute | 品类实例 | 属性实例 | 继承+覆盖 | 子品类继承父品类属性，可覆盖 |
| SPU→SKU | SPU实例 | SKU实例 | 1:N | SPU实例化生成SKU实例 |
| SKU→MerchantSKU | SKU实例 | 商家SKU | 1:N | 一个平台SKU被多个商家售卖 |
| MerchantSKU→Price | 商家SKU | 价格 | 1:1 | 商家定价（每个商家的价格独立） |
| MerchantSKU→Inventory | 商家SKU | 库存 | 1:N | 商家库存按仓库独立管理 |

#### 2.3.2 继承关系映射（品类属性继承）

```
品类继承关系映射：

ROOT_CATEGORY (根品类)
    │
    ├── 继承链：status, audit_rules, base_permissions
    │
    ▼
手机数码 (1001)
    │
    ├── 继承链：+ 基础属性定义模板
    │
    ├── ▼
    │ 智能手机 (1002)
    │    │
    │    ├── 继承链：+ 智能手机特有属性
    │    │
    │    ├── ▼
    │    │    iPhone (1003)
    │    │    │
    │    │    ├── 继承链：+ iPhone特有属性
    │    │    │
    │    │    └── 可覆盖：spu_template_ref
    │    │
    │    └── ▼
    │         Android (1004)
    │              │
    │              └── 继承链：+ Android特有属性
    │
    └── ▼
         配件 (1005)
              │
              └── 独立的属性模板
```

---

## 三、角色协同设计

### 3.1 角色模型与职责划分

| 角色 | Palantir 对应 | 职责范围 | 操作权限 |
|------|--------------|---------|---------|
| **平台运营** | Platform Admin | 品类结构、属性模板、规则配置 | 全局写 |
| **品类经理** | Domain Expert | 特定品类下的SPU管理、属性定义 | 品类级写 |
| **品牌方** | Data Provider | 品牌产品信息提交、SPU创建 | 品牌级写 |
| **商家（店小二）** | Data Consumer/Contributor | SKU认领、定价、库存 | 商家级写 |
| **消费者** | Data Consumer | 浏览、购买、评价 | 只读 |
| **Agent系统** | Automated Agent | 数据聚合、推理、自动化决策 | 场景化权限 |

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
      "attribute_templates": true,
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

#### 3.2.2 品类经理视角

```json
{
  "role": "CATEGORY_MANAGER",
  "data_view": {
    "visible_layers": ["META", "INSTANCE"],
    "visible_object_types": ["CATEGORY", "SPU", "SKU", "ATTRIBUTE"],
    "accessible_categories": ["1003"],  // 限定iPhone品类
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
      "定义新品类属性",
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
    "visible_object_types": ["SPU", "SKU", "PRICE", "INVENTORY", "ORDER"],
    "accessible_categories": ["ALL"],  // 可查看所有品类下的SPU
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
│  │  阶段1：品类与模板定义                                                │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 创建/维护品类结构                                                  │  │
│  │  • 定义品类属性模板                                                   │  │
│  │  • 配置验证规则和继承关系                                              │  │
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
│  │  • 设置商家专属价格                                                    │  │
│  │  • 绑定库存仓库                                                        │  │
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
| 品类属性覆盖冲突 | 子品类覆盖父品类属性时值域不一致 | 校验规则：子品类值域必须是父品类的子集 | 硬校验 |
| SPU重名冲突 | 不同品牌方提交同名SPU | 品牌隔离 + 自动后缀 | 软校验 |
| 价格异常冲突 | 商家定价超出合理范围 | 价格预警 + 人工审核 | 软校验 |
| 库存超卖 | 多订单并发扣减库存 | 分布式锁 + 乐观锁重试 | 硬校验 |
| 品类归属冲突 | SPU可能属于多个品类 | 主品类 + 关联品类双归属 | 软校验 |

---

## 四、图数据库设计与构建

> **⚠️ 关键前提澄清**：图数据库的「边(Edge)」是 **LinkType 的物理落地形式**，而不是 LinkType 本身。LinkType 是 Ontology 层的 schema 概念（需要被注册、版本化、权限控制），而图数据库的边是其 backing storage。两者关系类似「类 vs 表」——类定义在代码层，表存在数据库层。

### 4.1 图模型总体设计

#### 4.1.1 节点类型定义（对应 ObjectType）

| 节点类型 | Label | 对应电商概念 | 核心属性 |
|---------|-------|-------------|---------|
| 品类节点 | `:Category` | 品类分类 | category_id, name, level, path |
| 品牌节点 | `:Brand` | 品牌 | brand_id, name, country |
| SPU节点 | `:SPU` | 标准产品 | spu_id, name, status |
| SKU节点 | `:SKU` | 库存单元 | sku_id, sales_attrs_hash |
| 属性节点 | `:Attribute` | 属性定义 | attr_id, name, data_type |
| 属性值节点 | `:AttributeValue` | 属性值 | value_id, value |
| 商家节点 | `:Merchant` | 商家 | merchant_id, name |
| 仓库节点 | `:Warehouse` | 仓库 | warehouse_id, location |
| 价格节点 | `:Price` | 价格 | price_id, amount, currency |
| 库存节点 | `:Inventory` | 库存 | inventory_id, quantity |

#### 4.1.2 边类型定义（对应 LinkType 的物理落地）

| 边类型 | From | To | 描述 | 属性 |
|-------|------|-----|------|------|
| `:PARENT_OF` | Category | Category | 品类父子关系 | rank |
| `:HAS_ATTRIBUTE` | Category/SPU | Attribute | 拥有属性定义 | is_required, is_sales_attr |
| `:ATTRIBUTE_VALUE` | SPU/SKU | AttributeValue | 属性值 | - |
| `:BELONGS_TO` | SPU | Category | SPU归属品类 | is_primary |
| `:BELONGS_TO` | SPU | Brand | SPU归属品牌 | - |
| `:GENERATES` | SPU | SKU | SPU生成SKU | combination_key |
| `:SOLD_BY` | SKU | Merchant | SKU被商家销售 | merchant_sku_id |
| `:HAS_PRICE` | MerchantSKU | Price | 商家SKU定价 | - |
| `:HAS_INVENTORY` | MerchantSKU | Inventory | 商家库存 | warehouse_id |
| `:LOCATED_AT` | Inventory | Warehouse | 库存所在仓库 | - |

### 4.2 图数据库Schema（类 Cypher 定义）

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

// SPU节点
CREATE CONSTRAINT spu_id_unique IF NOT EXISTS
FOR (s:SPU) REQUIRE s.spu_id IS UNIQUE;

CREATE INDEX spu_category IF NOT EXISTS
FOR (s:SPU) ON (s.category_id);

CREATE INDEX spu_brand IF NOT EXISTS
FOR (s:SPU) ON (s.brand_id);

// SKU节点
CREATE CONSTRAINT sku_id_unique IF NOT EXISTS
FOR (k:SKU) REQUIRE k.sku_id IS UNIQUE;

CREATE INDEX sku_spu IF NOT EXISTS
FOR (k:SKU) ON (k.spu_id);

// 商家节点
CREATE CONSTRAINT merchant_id_unique IF NOT EXISTS
FOR (m:Merchant) REQUIRE m.merchant_id IS UNIQUE;

// 属性节点
CREATE CONSTRAINT attr_id_unique IF NOT EXISTS
FOR (a:Attribute) REQUIRE a.attr_id IS UNIQUE;

// ============== 关系定义 ==============

// 品类层级关系
CREATE INDEX category_parent IF NOT EXISTS
FOR ()-[r:PARENT_OF]->() ON (r.rank);

// SPU-Category归属
CREATE INDEX spu_category_link IF NOT EXISTS
FOR ()-[r:BELONGS_TO]->() 
WHERE r:SPU_CATEGORY OR type(r) = 'BELONGS_TO'
ON ()-[r]->() ON (r.is_primary);

// SKU生成关系
CREATE INDEX sku_generation IF NOT EXISTS
FOR ()-[r:GENERATES]->() ON (r.combination_key);
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

#### 4.3.2 SKU生成链路追溯

```cypher
// 追溯SKU202600001的完整生成链路
MATCH (c:Category {name: 'iPhone'})-[:HAS_ATTRIBUTE]->(attr:Attribute)
MATCH (spu:SPU {spu_id: 'SPU20260001'})-[:BELONGS_TO]->(c)
MATCH (spu)-[:GENERATES]->(sku:SKU {sku_id: 'SKU202600001'})
OPTIONAL MATCH (sku)-[:ATTRIBUTE_VALUE]->(av:AttributeValue)
RETURN spu, c, attr, sku, collect(av) AS attribute_values
```

#### 4.3.3 商家商品多跳查询

```cypher
// 查询商家M20260001的所有在售商品及价格
MATCH (m:Merchant {merchant_id: 'M20260001'})
      -[:SELLS]->(sku:SKU)
      -[:HAS_PRICE]->(p:Price)
WHERE p.status = 'active'
OPTIONAL MATCH (sku)-[:ATTRIBUTE_VALUE]->(av:AttributeValue)
OPTIONAL MATCH (sku)-[:GENERATES]->(spu:SPU)-[:BELONGS_TO]->(c:Category)
RETURN m.merchant_name AS 商家,
       spu.spu_name AS 商品名称,
       [av IN collect(av) WHERE av.attr_name IN ['颜色', '容量'] | av.value] AS 规格,
       p.sale_price AS 售价,
       p.original_price AS 划线价
ORDER BY p.sale_price
```

#### 4.3.4 图聚类分析：相似商品推荐

```cypher
// 基于属性相似度查找相似商品
MATCH (target:SKU {sku_id: 'SKU202600001'})
MATCH (target)-[:ATTRIBUTE_VALUE]->(av1:AttributeValue)
MATCH (other:SKU)-[:ATTRIBUTE_VALUE]->(av2:AttributeValue)
WHERE av1.attr_id = av2.attr_id 
  AND av1.value = av2.value
  AND other <> target
WITH target, other, count(*) AS shared_attrs
WHERE shared_attrs >= 3
MATCH (target)-[:GENERATES]->(spu1:SPU)
MATCH (other)-[:GENERATES]->(spu2:SPU)
RETURN spu1.spu_name AS 原商品,
       spu2.spu_name AS 相似商品,
       shared_attrs AS 共同属性数,
       [(other)-[:HAS_PRICE]->(p:Price) | p.sale_price][0] AS 相似商品价格
ORDER BY shared_attrs DESC
LIMIT 10
```

### 4.4 图数据结构示例

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           电商产品图数据示例                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│                              ┌─────────────┐                                    │
│                              │ :Category   │                                    │
│                              │ 手机数码     │                                    │
│                              │ level: 1    │                                    │
│                              └──────┬──────┘                                    │
│                                     │ PARENT_OF                                 │
│                                     ▼                                           │
│                              ┌─────────────┐                                    │
│                              │ :Category   │                                    │
│                              │ 智能手机     │                                    │
│                              │ level: 2    │                                    │
│                              └──────┬──────┘                                    │
│                                     │ PARENT_OF                                 │
│                                     ▼                                           │
│                              ┌─────────────┐                                    │
│                              │ :Category   │                                    │
│                              │ iPhone      │◀──────────┐                        │
│                              │ level: 3    │           │                        │
│                              └──────┬──────┘           │ HAS_ATTRIBUTE          │
│                                     │                  │                        │
│                    ┌────────────────┼────────────────┘                        │
│                    │                │                                         │
│                    │ BELONGS_TO     │ BELONGS_TO                              │
│                    ▼                ▼                                         │
│           ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│           │ :Brand      │    │ :SPU        │    │ :Attribute  │              │
│           │ Apple       │◀───│ iPhone 16   │────│ 颜色        │              │
│           │             │    │ SPU001      │    │             │              │
│           └─────────────┘    └──────┬──────┘    └─────────────┘              │
│                                     │ GENERATES                                │
│                                     │ (×20 SKU)                                │
│                                     ▼                                          │
│    ┌────────────────────────────────────────────────────────────────────┐      │
│    │                                                                    │      │
│    │   ┌─────────┐  ┌─────────┐  ┌─────────┐       ┌─────────┐       │      │
│    │   │ :SKU    │  │ :SKU    │  │ :SKU    │  ...  │ :SKU    │       │      │
│    │   │ 128G黑  │  │ 256G黑  │  │ 128G白  │       │ 1TB群青  │       │      │
│    │   └────┬────┘  └────┬────┘  └────┬────┘       └────┬────┘       │      │
│    │        │            │            │                  │            │      │
│    │        │ ATTRIBUTE_VALUE        │                  │            │      │
│    │        ▼            ▼            ▼                  ▼            │      │
│    │   ┌─────────────────────────────────────────────────────────┐   │      │
│    │   │  :AttributeValue                                        │   │      │
│    │   │  {颜色:黑色, 容量:128GB, 制式:公开版}                    │   │      │
│    │   └─────────────────────────────────────────────────────────┘   │      │
│    │                                                                    │      │
│    └────────────────────────────────────────────────────────────────────┘      │
│                                     │                                          │
│                                     │ SOLD_BY                                  │
│                                     ▼                                          │
│    ┌────────────────────────────────────────────────────────────────────┐      │
│    │                                                                    │      │
│    │        ┌─────────────┐         ┌─────────────┐                   │      │
│    │        │ :Merchant   │         │ :Merchant   │                   │      │
│    │        │ 店小二旗舰店 │         │ 数码专营店   │                   │      │
│    │        └──────┬──────┘         └──────┬──────┘                   │      │
│    │               │                         │                          │      │
│    │               ├─────────────────────────┤                          │      │
│    │               │                         │                          │      │
│    │        ┌──────┴──────┐           ┌──────┴──────┐                  │      │
│    │        │ HAS_PRICE   │           │ HAS_PRICE   │                  │      │
│    │        │ ¥6299       │           │ ¥6199       │                  │      │
│    │        └──────┬──────┘           └──────┬──────┘                  │      │
│    │               │                         │                          │      │
│    │        ┌──────┴──────┐           ┌──────┴──────┐                  │      │
│    │        │ HAS_INVENTORY         │ HAS_INVENTORY                  │      │
│    │        └──────┬──────┘           └──────┬──────┘                  │      │
│    │               │                         │                          │      │
│    │        ┌──────┴──────┐           ┌──────┴──────┐                  │      │
│    │        │ :Inventory  │           │ :Inventory  │                  │      │
│    │        │ 华东仓 50件 │           │ 华南仓 30件  │                  │      │
│    │        └──────┬──────┘           └──────┬──────┘                  │      │
│    │               │                         │                          │      │
│    │               │ LOCATED_AT              │ LOCATED_AT               │      │
│    │               ▼                         ▼                          │      │
│    │        ┌─────────────┐           ┌─────────────┐                  │      │
│    │        │ :Warehouse  │           │ :Warehouse  │                  │      │
│    │        │ 华东仓       │           │ 华南仓       │                  │      │
│    │        └─────────────┘           └─────────────┘                  │      │
│    │                                                                    │      │
│    └────────────────────────────────────────────────────────────────────┘      │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
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
│  │  Category / Brand / SPU / SKU / Merchant / Inventory                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 核心消费场景

#### 5.2.1 场景一：智能商品搜索与推荐

**场景描述：** 用户通过自然语言搜索商品，Agent需要理解查询意图并返回精准结果。

**Agent工作流：**
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
│  │ MATCH (sku)-[:ATTRIBUTE_VALUE]->(av:AttributeValue)              │  │
│  │ WHERE av.value IN ['256GB', '黑色']                               │  │
│  │ WITH sku, spu, count(DISTINCT av.value) AS match_score            │  │
│  │ WHERE match_score = 2                                             │  │
│  │ MATCH (m:Merchant)-[:SELLS]->(sku)                               │  │
│  │ MATCH (sku)-[:HAS_PRICE]->(p:Price)                              │  │
│  │ RETURN spu.spu_name, sku.sku_id, p.sale_price, m.merchant_name  │  │
│  │ ORDER BY p.sale_price ASC                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  返回结果                                                                │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  1. iPhone 16 256GB 黑色 - 店小二旗舰店 - ¥7299                         │
│  2. iPhone 16 256GB 黑色 - 数码专营店   - ¥7199  ← 推荐                 │
│  3. iPhone 16 256GB 黑色 - 苹果直营店   - ¥7499                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 场景二：商家智能运营助手

**场景描述：** 店小二需要了解竞品情况、调整定价策略、管理库存。

**Agent能力矩阵：**

| 能力 | 输入 | Agent操作 | 输出 |
|------|------|---------|------|
| **竞品分析** | SKU ID | 遍历同类SPU的SKU，比较价格和销量 | 竞品价格表、差距分析 |
| **智能定价** | SKU + 目标利润率 | 分析竞品价格带，建议最优定价 | 定价建议（含理由） |
| **库存预警** | 商家ID | 分析库存周转，预测断货风险 | 补货建议清单 |
| **商品上新** | 新SPU链接 | 自动填充商品信息，一键铺货 | 上架草稿 |

**Agent对话示例：**
```
用户: 帮我分析一下我的iPhone 16 256GB黑色的竞争力

Agent:
┌─────────────────────────────────────────────────────────────────────────┐
│  竞争力分析报告                                                          │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  📊 基本信息                                                             │
│  • 你的商品：iPhone 16 256GB 黑色                                        │
│  • 你的售价：¥7299（成本¥6550，利润¥749，利润率10.3%）                      │
│                                                                         │
│  📈 竞品分析                                                             │
│  ┌──────────────┬────────┬────────┬────────┬────────────────┐            │
│  │ 商家         │ 价格   │ 库存   │ 销量   │ 评价           │            │
│  ├──────────────┼────────┼────────┼────────┼────────────────┤            │
│  │ 数码专营店   │ ¥7199  │ 30件   │ 128    │ ⭐4.8          │ ← 最低价  │
│  │ 你的店铺     │ ¥7299  │ 50件   │ 95     │ ⭐4.7          │            │
│  │ 苹果直营店   │ ¥7499  │ 100件  │ 256    │ ⭐4.9          │ ← 最热销  │
│  └──────────────┴────────┴────────┴────────┴────────────────┘            │
│                                                                         │
│  💡 建议                                                                │
│  1. 你的库存充足(50件)，但价格偏高100元，建议降价至¥7249以提升竞争力         │
│  2. 数码专营店销量最高，可能有稳定的供应链优势，建议关注对方动态              │
│  3. 苹果直营店虽然价格最高但销量最好，说明品牌信任度很重要                   │
│                                                                         │
│  🎯 操作建议                                                            │
│  [ ] 降价至¥7249  [ ] 优化商品描述  [ ] 提升客服响应  [ ] 取消关注          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.3 场景三：品类运营分析

**场景描述：** 品类经理需要了解品类健康度、商品覆盖率、商家活跃度。

**图分析查询：**

```cypher
// 品类健康度分析
MATCH (c:Category {name: 'iPhone'})

// 1. SPU数量
OPTIONAL MATCH (spu:SPU)-[:BELONGS_TO]->(c)
WITH c, count(DISTINCT spu) AS spu_count

// 2. SKU覆盖率
OPTIONAL MATCH (spu)-[:GENERATES]->(sku:SKU)
WITH c, spu_count, count(DISTINCT sku) AS sku_count

// 3. 商家覆盖率
OPTIONAL MATCH (sku)-[:SOLD_BY]->(m:Merchant)
WITH c, spu_count, sku_count, count(DISTINCT m) AS merchant_count

// 4. 平均价格带
OPTIONAL MATCH (sku)-[:HAS_PRICE]->(p:Price)
WITH c, spu_count, sku_count, merchant_count, 
     avg(p.sale_price) AS avg_price,
     min(p.sale_price) AS min_price,
     max(p.sale_price) AS max_price

RETURN c.name AS 品类,
       spu_count AS SPU数量,
       sku_count AS SKU数量,
       merchant_count AS 商家数量,
       min_price AS 最低价,
       avg_price AS 平均价,
       max_price AS 最高价,
       (max_price - min_price) / min_price * 100 AS 价格带宽百分号
```

**输出报告：**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           iPhone 品类分析报告                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 商品规模                                                             │
│  • SPU数量：1 (iPhone 16)                                               │
│  • SKU数量：20 (全规格覆盖)                                              │
│  • 商家数量：15                                                         │
│                                                                         │
│  💰 价格分布                                                             │
│  • 最低价：¥5999 (128GB)                                                │
│  • 平均价：¥7824                                                        │
│  • 最高价：¥10299 (1TB)                                                 │
│  • 价格带宽：71.7%                                                      │
│                                                                         │
│  📊 健康度指标                                                           │
│  • SKU覆盖率：100% (所有规格组合)                                         │
│  • 商家活跃度：73% (11/15商家在售)                                        │
│  • 价格健康度：🟢 正常                                                   │
│                                                                         │
│  ⚠️ 待优化项                                                             │
│  1. 缺少iPhone 16 Pro系列SPU                                            │
│  2. 部分512GB/1TB规格商家覆盖不足                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.4 场景四：跨品类智能联想

**场景描述：** 用户浏览某商品时，Agent自动推荐相关配件和服务。

**图推理查询：**

```cypher
// 基于购买路径的配件推荐
MATCH (current:SKU {sku_id: 'SKU202600001'})  // iPhone 16 128GB
MATCH (current)-[:GENERATES]->(spu:SPU)-[:BELONGS_TO]->(c:Category)

// 查找同品牌配件
OPTIONAL MATCH (acc_spu:SPU)-[:BELONGS_TO]->(acc_c:Category)<-[:PARENT_OF*]-(c)
WHERE acc_c.name CONTAINS '配件' OR acc_c.name CONTAINS '保护'

// 查找互补品类
OPTIONAL MATCH (comp_c:Category)-[:PARENT_OF*]->(c)
WHERE comp_c.name CONTAINS '贴膜' OR comp_c.name CONTAINS '耳机'

RETURN 
    current.sku_id AS 当前商品,
    collect(DISTINCT acc_spu.spu_name)[..5] AS 推荐配件,
    collect(DISTINCT comp_c.name)[..3] AS 相关品类
```

### 5.3 Agent工具集设计

| 工具名称 | 描述 | 输入 | 输出 |
|---------|------|------|------|
| `search_products` | 商品搜索 | 自然语言/结构化查询 | 商品列表 |
| `get_product_detail` | 商品详情 | SKU ID | 完整商品信息 |
| `analyze_competition` | 竞品分析 | SKU ID / 商家ID | 分析报告 |
| `suggest_price` | 定价建议 | SKU ID + 策略 | 建议价格 |
| `check_inventory` | 库存查询 | SKU ID + 商家ID | 库存状态 |
| `track_category_health` | 品类健康 | 品类ID | 健康度报告 |
| `find_accessories` | 配件推荐 | SKU ID | 配件列表 |
| `batch_update_price` | 批量调价 | 商家ID + 调整策略 | 更新结果 |

### 5.4 RAG增强方案

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
| **Agent Ready** | 从设计之初考虑Agent消费 | 结构化查询 + 自然语言接口 |

### 6.2 实施路线图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           实施路线图                                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Phase 1: 基础建模 (4-6周)                                                  │
│  ────────────────────────────────────────────────────────────────────      │
│  • 定义核心Object Type (Category, Brand, SPU, SKU)                          │
│  • 设计图数据库Schema                                                       │
│  • 实现基础CRUD API                                                         │
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
│  Phase 3: Agent能力 (4-6周)                                                  │
│  ────────────────────────────────────────────────────────────────────      │
│  • 部署L1数据访问Agent                                                       │
│  • 开发L2语义检索能力                                                        │
│  • 构建L3推理分析模型                                                        │
│  • 集成RAG增强                                                              │
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

## 附录：修订记录

| 版本 | 日期 | 主要变更 | 归档位置 |
|------|------|---------|---------|
| V1 | 2026-07-26 | 初始版本（已归档至此版本） | `docs/history/Palantir范式电商语义建模方案_V1.md` |

---

*文档结束*
