# 电商语义模型 OpenSPG/KAG 落地实现方案

> **文档版本**: v2.0
> **创建时间**: 2026-07-26
> **更新时间**: 2026-07-27
> **上游文档**: `docs/Palantir范式电商语义建模方案.md`（**V4.1 版本，路线 B：Template-Centric**）
> **同步更新说明**：本文档 v2.0 与上游 Palantir V4.1 同步，主要变更：① LinkType 从 12 降为 11（删除 `DECLARES_ATTRIBUTE`，`USES_TEMPLATE` 取而代之）；② SPGType 新增 `SPU.images` 与 `AttributeValue.display_meta`（对应电商产品数据模型 v1.0）；③ 所有查询模板同步更新。
> **核心主题**: 将 Palantir 范式的电商双层语义模型映射到 OpenSPG 知识图谱引擎，覆盖 Schema 定义、实例数据注入、Agent 高效消费三大环节
> **关联引擎**: OpenSPG（Semantic-enhanced Programmable Graph）+ KAG（基于 OpenSPG 的逻辑形式引导推理框架）

---

## 一、总体架构与映射思路

### 1.1 为什么选择 OpenSPG/KAG

OpenSPG 是蚂蚁集团开源的语义增强可编程图谱引擎，KAG 是构建于其上的逻辑形式引导推理框架。两者的核心能力刚好对应本方案的关键需求：

| Palantir 范式核心需求 | OpenSPG/KAG 对应能力 |
|--------------------|---------------------|
| Schema 是一等公民，需注册/版本化/权限控制 | `knext.schema` 完整支持 SPGType 注册、版本管理、Commit 流程 |
| LinkType 与 ObjectType 平级 | `Relation` 与 `SPGType` 一等公民，由 Schema 驱动 |
| 双层模型：元数据层 + 实例层 | `SPGType`（Concept/Entity 定义）+ Graph Store（实例数据） |
| 属性三层模型 + allowed_value_refs 校验 | Schema 约束 + 节点关系 `allowed_value_refs` 属性 + 校验器 |
| Agent 高效消费 + 多跳推理 | KAG kg-solver（Planning / Reasoning / Retrieval / Numerical 四算子） |
| 知识与原文双向链接 | Knowledge-Chunk Mutual Indexing |

### 1.2 双层模型在 OpenSPG 中的整体映射

Palantir 文档的核心抽象是**两层语义模型**：
- **第一层（元数据层）**：OT_SPU_TEMPLATE / OT_SKU_TEMPLATE 等"模板类型" + 11 类 ObjectType 定义 + 11 个 LinkType（**V4 删除 DECLARES_ATTRIBUTE**）
- **第二层（实例层）**：商品、商家、SKU、价格等具体实例

在 OpenSPG 中，这一抽象有清晰对应：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenSPG 中的电商双层模型                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  第一层：Schema 定义层 (knext.schema)                          │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  【A. 模板类型】SPGType (Concept 概念层)                      │  │
│  │  ┌────────────────┐     ┌────────────────┐                   │  │
│  │  │ SPUTemplate    │     │ SKUTemplate    │                   │  │
│  │  │ (Concept)      │     │ (Concept)      │                   │  │
│  │  └────────────────┘     └────────────────┘                   │  │
│  │           │引用关系              │引用关系                     │  │
│  │           ▼                    ▼                             │  │
│  │  【B. ObjectType 定义】SPGType (Entity 实体层)                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │Category  │ │ Brand    │ │ SPU      │ │ SKU      │       │  │
│  │  │(Entity)  │ │(Entity)  │ │(Entity)  │ │(Entity)  │       │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  │                                                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │  │
│  │  │Attribute │ │AttrValue │ │ Merchant │                     │  │
│  │  │(Entity)  │ │(Entity)  │ │(Entity)  │                     │  │
│  │  └──────────┘ └──────────┘ └──────────┘                     │  │
│  │                                                               │  │
│  │  【Relation 关系定义】                                         │  │
│  │  BELONGS_TO / GENERATES / HAS_ATTR_VALUE / SOLD_BY /         │  │
│  │  HAS_CANDIDATE_VALUE / TEMPLATE_REFERENCES_ATTR              │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              │ 实例化 (kg-builder)                  │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  第二层：实例数据层 (Graph Store)                             │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  实体实例：                                                   │  │
│  │  • iPhone (Category) → Apple (Brand)                         │  │
│  │  • iPhone 16 (SPU) → 128GB黑色 (SKU)                        │  │
│  │  • 店小二旗舰店 (Merchant)                                   │  │
│  │                                                               │  │
│  │  关系实例：                                                   │  │
│  │  • iPhone -[PARENT_OF]-> 智能手机                           │  │
│  │  • iPhone16 -[GENERATES]-> SKU001                           │  │
│  │  • SKU001 -[SOLD_BY]-> 店小二旗舰店                         │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**关键映射规则**：
- `OT_SPU_TEMPLATE / OT_SKU_TEMPLATE`（Palantir 模板类型） → `SPGType(type_enum=Concept)`
- `OT_CATEGORY / OT_BRAND / OT_SPU / ...`（Palantir ObjectType） → `SPGType(type_enum=Entity)`
- Palantir 11 个 LinkType（V4） → 11 个 `Relation`，通过 `s-to-o`（主体-谓词-客体）连接对应类型
- `allowed_value_refs` 等 linkProperties → 存储在边属性上（边是 SPG 中的实体）
- **V4 重要变更**：删除 `DECLARES_ATTRIBUTE`（原 LinkType #6），**V4 路线 B 下 `USES_TEMPLATE`（Category → SPUTemplate）是属性声明的唯一入口**，通过 `TEMPLATE_REFERENCES_ATTR` 再指向 Attribute
- 实例化通过 `kg-builder` 完成，受 Schema 约束

---

## 二、第一层 Schema 定义

### 2.1 用 knext.schema 定义 SPG 类型

```python
from knext.schema.model.spg_type import SPGType, SPGTypeEnum
from knext.schema.model.property import Property
from knext.schema.model.relation import Relation

# ========== 模板类型（Concept 概念层）==========

spu_template = SPGType(
    name="SPUTemplate",
    name_zh="SPU模板",
    type_enum=SPGTypeEnum.Concept  # 概念类型 - 元数据的元数据
)
spu_template.add_property(Property(name="template_id", data_type="Text", is_primary_key=True))
spu_template.add_property(Property(name="template_name", data_type="Text"))
spu_template.add_property(Property(name="required_attrs", data_type="Text"))  # JSON引用OT_ATTRIBUTE
spu_template.add_property(Property(name="sales_attrs", data_type="Text"))   # 销售属性+allowed_value_refs

sku_template = SPGType(
    name="SKUTemplate",
    name_zh="SKU模板",
    type_enum=SPGTypeEnum.Concept
)
sku_template.add_property(Property(name="template_id", data_type="Text", is_primary_key=True))
sku_template.add_property(Property(name="template_name", data_type="Text"))
sku_template.add_property(Property(name="parent_spu_template_ref", data_type="Text"))

# ========== 实体类型（Entity 实体层）==========

category = SPGType(name="Category", name_zh="品类", type_enum=SPGTypeEnum.Entity)
category.add_property(Property(name="category_id", data_type="Text", is_primary_key=True))
category.add_property(Property(name="category_name", data_type="Text"))
category.add_property(Property(name="parent_category_id", data_type="Text"))
category.add_property(Property(name="level", data_type="Int"))
category.add_property(Property(name="path", data_type="Text"))

brand = SPGType(name="Brand", name_zh="品牌", type_enum=SPGTypeEnum.Entity)
brand.add_property(Property(name="brand_id", data_type="Text", is_primary_key=True))
brand.add_property(Property(name="brand_name", data_type="Text"))
brand.add_property(Property(name="country", data_type="Text"))

spu = SPGType(name="SPU", name_zh="标准产品", type_enum=SPGTypeEnum.Entity)
spu.add_property(Property(name="spu_id", data_type="Text", is_primary_key=True))
spu.add_property(Property(name="spu_name", data_type="Text"))
spu.add_property(Property(name="template_id", data_type="Text"))
spu.add_property(Property(name="brand_id", data_type="Text"))
spu.add_property(Property(name="primary_category_id", data_type="Text"))
spu.add_property(Property(name="description", data_type="Text"))
spu.add_property(Property(name="images", data_type="Text"))    # JSON数组，URL列表，对应电商产品数据模型v1.0
spu.add_property(Property(name="specifications", data_type="Text"))   # JSON，基本属性(scope=required)+销售属性
spu.add_property(Property(name="status", data_type="Text"))

sku = SPGType(name="SKU", name_zh="库存单元", type_enum=SPGTypeEnum.Entity)
sku.add_property(Property(name="sku_id", data_type="Text", is_primary_key=True))
sku.add_property(Property(name="sku_name", data_type="Text"))
sku.add_property(Property(name="spu_id", data_type="Text"))
sku.add_property(Property(name="sales_attrs_hash", data_type="Text"))
sku.add_property(Property(name="status", data_type="Text"))

attribute = SPGType(name="Attribute", name_zh="属性", type_enum=SPGTypeEnum.Entity)
attribute.add_property(Property(name="attr_id", data_type="Text", is_primary_key=True))
attribute.add_property(Property(name="attr_name", data_type="Text"))
attribute.add_property(Property(name="data_type", data_type="Text"))
attribute.add_property(Property(name="scope", data_type="Text"))  # PLATFORM_GLOBAL / CATEGORY_SCOPED

attribute_value = SPGType(name="AttributeValue", name_zh="属性值", type_enum=SPGTypeEnum.Entity)
attribute_value.add_property(Property(name="attr_value_id", data_type="Text", is_primary_key=True))
attribute_value.add_property(Property(name="attr_id", data_type="Text"))
attribute_value.add_property(Property(name="value", data_type="Text"))
# display_meta: 展示元数据，对应电商产品数据模型v1.0的color_hex/size_guide/extra_data
attribute_value.add_property(Property(name="display_meta", data_type="Text"))  # JSON: {color_hex, image_url, size_guide, extra_data}

merchant = SPGType(name="Merchant", name_zh="商家", type_enum=SPGTypeEnum.Entity)
merchant.add_property(Property(name="merchant_id", data_type="Text", is_primary_key=True))
merchant.add_property(Property(name="merchant_name", data_type="Text"))
merchant.add_property(Property(name="merchant_type", data_type="Text"))

merchant_sku = SPGType(name="MerchantSKU", name_zh="商家SKU", type_enum=SPGTypeEnum.Entity)
merchant_sku.add_property(Property(name="merchant_sku_id", data_type="Text", is_primary_key=True))
merchant_sku.add_property(Property(name="sku_id", data_type="Text"))
merchant_sku.add_property(Property(name="merchant_id", data_type="Text"))
merchant_sku.add_property(Property(name="status", data_type="Text"))

warehouse = SPGType(name="Warehouse", name_zh="仓库", type_enum=SPGTypeEnum.Entity)
warehouse.add_property(Property(name="warehouse_id", data_type="Text", is_primary_key=True))
warehouse.add_property(Property(name="warehouse_name", data_type="Text"))
warehouse.add_property(Property(name="location", data_type="Text"))

price = SPGType(name="Price", name_zh="价格", type_enum=SPGTypeEnum.Entity)
price.add_property(Property(name="price_id", data_type="Text", is_primary_key=True))
price.add_property(Property(name="merchant_sku_id", data_type="Text"))
price.add_property(Property(name="price_type", data_type="Text"))
price.add_property(Property(name="amount", data_type="Double"))

inventory = SPGType(name="Inventory", name_zh="库存", type_enum=SPGTypeEnum.Entity)
inventory.add_property(Property(name="inventory_id", data_type="Text", is_primary_key=True))
inventory.add_property(Property(name="merchant_sku_id", data_type="Text"))
inventory.add_property(Property(name="warehouse_id", data_type="Text"))
inventory.add_property(Property(name="available", data_type="Int"))
inventory.add_property(Property(name="reserved", data_type="Int"))
inventory.add_property(Property(name="alert_threshold", data_type="Int"))
```

### 2.2 关系（Relation）定义

Palantir 文档共定义了 11 个 LinkType（V4），下面给出完整的 Relation 声明：

```python
# ========== 核心 LinkType → Relation（V4 共 11 个）==========

# 1. PARENT_OF：品类自连接（层级继承）
PARENT_OF = Relation(
    name="PARENT_OF",
    name_zh="父类",
    object_type_name="Category"
)

# 2. BELONGS_TO_CATEGORY：SPU 归属品类（多分类）
BELONGS_TO = Relation(
    name="BELONGS_TO",
    name_zh="归属于",
    object_type_name="Category"
)

# 3. HAS_BRAND：SPU 归属品牌
HAS_BRAND = Relation(
    name="HAS_BRAND",
    name_zh="属于品牌",
    object_type_name="Brand"
)

# 4. GENERATES：SPU 生成 SKU
GENERATES = Relation(
    name="GENERATES",
    name_zh="生成SKU",
    object_type_name="SKU"
)

# 5. HAS_ATTR_VALUE：商品关联属性值（SPU/SKU 端共享 LinkType）
HAS_ATTR_VALUE = Relation(
    name="HAS_ATTR_VALUE",
    name_zh="拥有属性值",
    object_type_name="AttributeValue"
)

# 6. SOLD_BY：SKU 被商家销售（沉淀 MerchantSKU）
SOLD_BY = Relation(
    name="SOLD_BY",
    name_zh="被销售",
    object_type_name="Merchant"
)

# 7. HAS_PRICE：MerchantSKU 关联价格
HAS_PRICE = Relation(
    name="HAS_PRICE",
    name_zh="拥有价格",
    object_type_name="Price"
)

# 8. HOLDS_INVENTORY：MerchantSKU 持有库存
HOLDS_INVENTORY = Relation(
    name="HOLDS_INVENTORY",
    name_zh="持有库存",
    object_type_name="Inventory"
)

# 9. LOCATED_AT：库存所属仓库
LOCATED_AT = Relation(
    name="LOCATED_AT",
    name_zh="位于",
    object_type_name="Warehouse"
)

# 10. HAS_CANDIDATE_VALUE：属性字典挂载值池（属性三层模型关键）
HAS_CANDIDATE_VALUE = Relation(
    name="HAS_CANDIDATE_VALUE",
    name_zh="拥有候选值",
    object_type_name="AttributeValue"
)

# 11. TEMPLATE_REFERENCES_ATTR：模板引用属性字典（含 allowed_value_refs）
TEMPLATE_REFERENCES_ATTR = Relation(
    name="TEMPLATE_REFERENCES_ATTR",
    name_zh="引用属性",
    object_type_name="Attribute"
)

# === V4 新增 Relation ===
# 12. USES_TEMPLATE：Category 使用/引用 SPUTemplate（V4 路线 B：替代已删除的 DECLARES_ATTRIBUTE）
USES_TEMPLATE = Relation(
    name="USES_TEMPLATE",
    name_zh="使用模板",
    object_type_name="SPUTemplate",
    description="V4 路线 B：Category 不再 DECLARES_ATTRIBUTE，而是通过 USES_TEMPLATE 引用 SPUTemplate，属性声明收敛在 Template 层"
)
```

### 2.3 提交 Schema 到 OpenSPG

```python
from knext.schema.client import SchemaClient

schema_client = SchemaClient(host_addr="http://localhost:8887", project_id=1)

# 提交 Concept 类型（模板层）
schema_client.add_concept_type(spu_template)
schema_client.add_concept_type(sku_template)

# 提交 Entity 类型
for entity_type in [category, brand, spu, sku, attribute, attribute_value,
                   merchant, merchant_sku, warehouse, price, inventory]:
    schema_client.add_entity_type(entity_type)

# 提交所有 Relation（V4 共 11 个 Relation）
all_relations = [
    PARENT_OF, BELONGS_TO, HAS_BRAND, GENERATES,
    HAS_ATTR_VALUE, SOLD_BY, HAS_PRICE,
    HOLDS_INVENTORY, LOCATED_AT,
    HAS_CANDIDATE_VALUE, TEMPLATE_REFERENCES_ATTR, USES_TEMPLATE
]
for rel in all_relations:
    schema_client.add_relation(rel)

# 提交 Schema（进入版本管理、权限控制）
schema_client.commit_draft()
```

> **关键观察**：Schema 一旦 commit，所有 kg-builder 的数据导入、Agent 的图查询、kg-solver 的推理都必须遵循这套类型约束。这是 Palantir 范式中"LinkType 一等公民"和"Schema 注册/版本化"在 OpenSPG 中的具体落地。

### 2.4 关键设计对应关系速查表

| 文档概念 | OpenSPG 实现 | 关键机制 |
|---------|-------------|---------|
| **双层模型** | Schema Layer + Instance Layer | `SPGType` (Concept/Entity) + Graph Store |
| **模板类型** | SPGType with `type_enum=Concept` | 元数据层 - 元数据的元数据 |
| **ObjectType** | SPGType with `type_enum=Entity` | 实体类型定义 |
| **LinkType** | `Relation` | 关系类型一等公民 |
| **属性三层模型** | Attribute + AttributeValue + Template links | `HAS_CANDIDATE_VALUE` + `TEMPLATE_REFERENCES_ATTR` + `allowed_value_refs` |
| **Schema 约束** | `knext.schema` | 确保知识构建符合领域专家定义 |
| **Agent 消费** | kg-solver 混合推理引擎 | 逻辑形式引导的 4 类算子 |

---

## 三、双层图查询模板

OpenSPG 提供 `knext.graph` SDK 与底层图存储交互。以下是 Palantir 范式下几个核心查询的实现：

```python
from knext.graph.client import GraphClient

graph_client = GraphClient(host_addr="http://localhost:8887", project_id=1)

# ========== 第一层查询：Schema 层面（继承、模板关系）==========

# 1. 品类属性继承链（V4 路线 B：属性从 USES_TEMPLATE → TEMPLATE_REFERENCES_ATTR 查询，不再从 Category DECLARES）
def query_category_inheritance(category_name):
    query = f"""
    MATCH (root:Category)-[:PARENT_OF*]->(c:Category {{name: '{category_name}'}})
    MATCH (c)-[:USES_TEMPLATE]->(t:SPUTemplate)
    MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute)
    RETURN root.name AS 根品类, c.name AS 当前品类,
           t.template_id AS 模板,
           collect({{attr: attr.attr_name, scope: r.scope}}) AS 属性列表
    """
    return graph_client.exec_query(query)

# 2. 模板引用的属性及值池子集（属性三层模型查询）
def query_template_attr_pool(template_id, attr_id):
    query = f"""
    MATCH (t:SPUTemplate {{template_id: '{template_id}'}})
    MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute {{attr_id: '{attr_id}'}})
    MATCH (attr)-[:HAS_CANDIDATE_VALUE]->(av:AttributeValue)
    WHERE av.attr_value_id IN r.allowed_value_refs
    RETURN attr.attr_name AS 属性名,
           collect(av.value) AS 模板允许值,
           r.allowed_value_refs AS 值池子集
    """
    return graph_client.exec_query(query)

# ========== 第二层查询：实例层面 ==========

# 3. SKU 完整生成链路追溯（V4 路线 B：通过 Category → USES_TEMPLATE → TEMPLATE_REFERENCES_ATTR 查询属性）
def trace_sku_generation(sku_id):
    query = f"""
    MATCH (spu:SPU)-[:GENERATES]->(sku:SKU {{sku_id: '{sku_id}'}})
    MATCH (spu)-[:BELONGS_TO]->(c:Category)-[:USES_TEMPLATE]->(t:SPUTemplate)
    MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute)
    OPTIONAL MATCH (sku)-[:HAS_ATTR_VALUE]->(av:AttributeValue)
    RETURN spu.spu_name AS SPU名称,
           sku.sku_name AS SKU名称,
           t.template_id AS 模板,
           collect({{attr: attr.attr_name, scope: r.scope}}) AS 属性定义,
           collect(av.value) AS 销售属性
    """
    return graph_client.exec_query(query)

# 4. 商家商品多跳查询（带价格）
def query_merchant_products(merchant_id):
    query = f"""
    MATCH (m:Merchant {{merchant_id: '{merchant_id}'}})<-[:SOLD_BY]-(sku:SKU)
    MATCH (sku)-[:GENERATES]-(spu:SPU)-[:BELONGS_TO]->(c:Category)
    MATCH (sku)-[:SOLD_BY]->(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
    WHERE p.price_type = 'sale'
    RETURN m.merchant_name AS 商家,
           spu.spu_name AS 商品名,
           sku.sku_name AS SKU名,
           p.amount AS 售价
    ORDER BY p.amount
    """
    return graph_client.exec_query(query)

# 5. 验证 SKU 属性值是否在模板允许范围内（属性三层模型核心校验）
def validate_sku_attrs(sku_id, submitted_values):
    """
    submitted_values: [{"attr_id": "ATTR_COLOR", "attr_value_id": "AV_TIFFANY_BLUE"}, ...]
    """
    checks = []
    for val in submitted_values:
    # V4 路线 B：Category → USES_TEMPLATE → SPUTemplate → TEMPLATE_REFERENCES_ATTR
    query = f"""
    MATCH (sku:SKU {{sku_id: '{sku_id}'}})-[:GENERATES]-(spu:SPU)
    MATCH (spu)-[:BELONGS_TO]->(c:Category)-[:USES_TEMPLATE]->(t:SPUTemplate)
    MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute {{attr_id: '{val['attr_id']}'}})
        WITH attr, r, '{val['attr_value_id']}' AS submitted
        RETURN submitted,
               attr.attr_name AS 属性,
               r.allowed_value_refs AS 允许值池,
               submitted IN r.allowed_value_refs AS is_valid
        """
        result = graph_client.exec_query(query)
        checks.append({
            "submitted_value": val,
            "validation": result
        })
    return checks
```

---

## 四、第二层实例数据注入方案（基于 kg-builder）

OpenSPG 把第二层实例数据搞进图谱，本质是调用 **kg-builder** 的知识构建能力。根据数据源类型与业务场景，分为 **4 条主路径**：

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          实例数据注入全景                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  数据源                                                                      │
│  ┌──────────┬──────────┬──────────┬──────────┐                            │
│  │ 关系数据库 │ 流式事件 │ 文档/文本 │ 手工录入  │                            │
│  │ MySQL    │ Kafka    │ PDF/Word │ 管理后台  │                            │
│  │ PG       │ Pulsar   │ Markdown │         │                            │
│  └──┬───────┴────┬─────┴────┬─────┴────┬─────┘                            │
│     │            │          │          │                                   │
│     ▼            ▼          ▼          ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  路径 1: 结构化映射导入（DB → SPG）                                  │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  工具：DataBuilder + SPG-Builder Mapping DSL                          │  │
│  │  适用：已有 MySQL/PG 表，需要同步到图谱（最常见）                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  路径 2: 流式事件订阅（Kafka → SPG）                                 │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  工具：StreamBuilder + Kafka Connector                                │  │
│  │  适用：业务事件（如订单、库存变更）近实时入图                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  路径 3: 非结构化抽取（文本 → SPG）                                  │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  工具：Extractor + LLM + Schema 约束                                  │  │
│  │  适用：商品描述、合同、政策文档等知识抽取                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  路径 4: API 写入（应用 → SPG）                                     │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  工具：knext.graph + REST API                                        │  │
│  │  适用：业务前台直接落图（如商家上架、运营维护）                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│                       │                                                    │
│                       ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Schema 校验（knext.schema）                                         │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • 实体类型匹配（Category 实例必须是 Category 类型）                   │  │
│  │  • 必填字段校验（spu_id 不能为空）                                    │  │
│  │  • 关系端点校验（GENERATES 起点必须是 SPU）                          │  │
│  │  • 业务规则校验（属性值必须在 allowed_value_refs 内）                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                       │                                                    │
│                       ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Graph Store（TuGraph / GDB）                                       │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  最终落盘的实例子图 + 索引                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 路径 1：结构化映射导入（最常用）

电商场景中最常见的是把 MySQL 里的品类、品牌、SPU、SKU、商家、价格、库存表导入到图谱。OpenSPG 提供 **DataBuilder + Mapping DSL**。

#### 4.1.1 Mapping DSL 概览

Mapping DSL 是一个声明式 JSON 配置文件，描述「表字段 → SPG 实体 / 关系」的映射规则。例如 `spu_mapping.json`：

```json
{
  "job_name": "spu_import",
  "source": {
    "type": "MYSQL",
    "connection": "jdbc:mysql://10.0.0.1:3306/ecommerce",
    "table": "spu",
    "incremental_column": "updated_at"
  },
  "target": {
    "spg_type": "SPU"
  },
  "field_mappings": [
    {
      "source_column": "spu_id",
      "target_property": "spu_id",
      "is_primary_key": true
    },
    {
      "source_column": "spu_name",
      "target_property": "spu_name"
    },
    {
      "source_column": "template_id",
      "target_property": "template_id",
      "post_processor": "resolve_spu_template"
    },
    {
      "source_column": "brand_id",
      "target_property": "brand_id",
      "post_processor": "link_to_brand"
    },
    {
      "source_column": "primary_category_id",
      "target_property": "primary_category_id",
      "post_processor": "link_to_category"
    },
    {
      "source_column": "specifications",
      "target_property": "specifications",
      "transform": "jsonb_to_text"
    },
    {
      "source_column": "status",
      "target_property": "status"
    },
    {
      "source_column": "created_at",
      "target_property": "created_at",
      "transform": "timestamp_to_iso8601"
    }
  ],
  "post_processors": {
    "resolve_spu_template": "com.ecommerce.processor.SPUTemplateResolver",
    "link_to_brand":        "com.ecommerce.processor.LinkToBrandProcessor",
    "link_to_category":     "com.ecommerce.processor.LinkToCategoryProcessor"
  },
  "batch_size": 1000,
  "fault_tolerance": {
    "skip_on_error": true,
    "max_errors": 100
  }
}
```

#### 4.1.2 全实体族映射清单

为了让第二层实例化完整，建议为每个实体类型准备一份 Mapping：

```json
[
  { "spg_type": "Category",       "source": "category",     "primary_key": "category_id", "edge_output": ["PARENT_OF"] },
  { "spg_type": "Brand",          "source": "brand",        "primary_key": "brand_id" },
  { "spg_type": "Attribute",      "source": "attribute",    "primary_key": "attr_id",    "edge_output": ["HAS_CANDIDATE_VALUE"] },
  { "spg_type": "AttributeValue", "source": "attr_value",   "primary_key": "attr_value_id" },
  { "spg_type": "SPU",            "source": "spu",          "primary_key": "spu_id",
    "edge_output": ["BELONGS_TO(Category)", "HAS_BRAND(Brand)", "GENERATES(SKU)"] },
  { "spg_type": "SKU",            "source": "sku",          "primary_key": "sku_id",
    "edge_output": ["HAS_ATTR_VALUE(AttributeValue)", "SOLD_BY(Merchant)"] },
  { "spg_type": "Merchant",       "source": "merchant",     "primary_key": "merchant_id" },
  { "spg_type": "Warehouse",      "source": "warehouse",    "primary_key": "warehouse_id" },
  { "spg_type": "Price",          "source": "price",        "primary_key": "price_id",
    "edge_output": ["HAS_PRICE(MerchantSKU)"] },
  { "spg_type": "Inventory",      "source": "inventory",    "primary_key": "inventory_id",
    "edge_output": ["HOLDS_INVENTORY(MerchantSKU)", "LOCATED_AT(Warehouse)"] },
  { "spg_type": "MerchantSKU",    "source": "merchant_sku", "primary_key": "merchant_sku_id" }
]
```

#### 4.1.3 DataBuilder 调度

```bash
# 一次 build 全部实例数据
openspg-builder run \
  --config ./mappings/all_spg_types.json \
  --mode full              # full | incremental
```

Python 增量调度版：

```python
from knext.builder.data_builder import DataBuilder

builder = DataBuilder(
    host_addr="http://localhost:8887",
    project_id=1
)

# 增量构建（按 updated_at 增量）
for spg_type in ["Category", "Brand", "Attribute", "AttributeValue",
                  "SPU", "SKU", "Merchant", "Warehouse",
                  "Price", "Inventory", "MerchantSKU"]:
    builder.import_spg_type(
        spg_type=spg_type,
        mapping_file=f"./mappings/{spg_type.lower()}_mapping.json",
        mode="incremental"
    )

# 构建 SPU->SKU 关系（笛卡尔积展开）
builder.import_relations(
    relation_name="GENERATES",
    mapping_file="./mappings/spu_generates_sku_mapping.json",
    mode="incremental"
)
```

#### 4.1.4 关键 PostProcessor 实现示例

```java
// 1. 模板引用解析：把 SPU.template_id 解析为指向 SPUTemplate 节点的边
public class SPUTemplateResolver implements PostProcessor {
    @Override
    public Object process(Record record, GraphClient graph) {
        String templateId = record.getString("template_id");
        return graph.createEdge(
            fromType = "SPU", fromId = record.getString("spu_id"),
            edgeType = "USES",
            toType   = "SPUTemplate", toId   = templateId
        );
    }
}

// 2. 属性值校验：保证 SPU 实例引用 AttributeValue 时在 allowed_value_refs 内
public class AttrValueValidator implements PostProcessor {
    @Override
    public Object process(Record record, GraphClient graph) {
        String spuId        = record.getString("spu_id");
        String attrValueId  = record.getString("attr_value_id");

        // 查模板的 allowed_value_refs
        CypherResult result = graph.execQuery(String.format("""
            MATCH (s:SPU {spu_id: '%s'})-[:USES]->(t:SPUTemplate)
            MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(a:Attribute)
              <-[:HAS_CANDIDATE_VALUE]-(av:AttributeValue {attr_value_id: '%s'})
            RETURN r.allowed_value_refs AS allowed
        """, spuId, attrValueId));

        if (attrValueId not in result.get("allowed")) {
            throw new DataValidationException(
                "属性值 " + attrValueId + " 不在模板允许范围"
            );
        }
        return null;
    }
}
```

### 4.2 路径 2：流式事件实时注入

对于价格变动、库存扣减、订单状态等**实时性要求高**的业务事件，使用 **StreamBuilder + Kafka Connector**。

```python
from knext.builder.stream_builder import StreamBuilder
from knext.builder.connector import KafkaConnector

stream_builder = StreamBuilder(
    host_addr="http://localhost:8887",
    project_id=1
)

# 1. 监听 Kafka 价格变更事件
@stream_builder.subscribe(
    topic="ecommerce.price_change",
    group_id="spg-price-consumer",
    connector_class=KafkaConnector
)
def on_price_change(event):
    """
    事件格式：
    {
      "event_type": "PRICE_UPDATE",
      "merchant_sku_id": "MSKU001",
      "price_type": "sale",
      "amount": 6299.00,
      "effective_from": "2026-07-26T10:00:00Z"
    }
    """
    stream_builder.upsert_node(
        spg_type="Price",
        primary_key="price_id",
        record=event
    )

# 2. 库存变更
@stream_builder.subscribe(topic="ecommerce.inventory_change")
def on_inventory_change(event):
    stream_builder.upsert_node(
        spg_type="Inventory",
        primary_key="inventory_id",
        record=event
    )

# 3. 启动 worker
stream_builder.run(workers=4)
```

### 4.3 路径 3：非结构化文本抽取

商品描述、品牌故事、用户评论等文本需要 LLM 抽取。OpenSPG 提供 **Extractor + Schema 约束** 能力。

```python
from knext.builder.extractor import Extractor
from knext.schema.client import SchemaClient

schema = SchemaClient(host_addr="http://localhost:8887", project_id=1).load()

# 抽取器声明：指定要抽取的实体类型与关系
extractor = Extractor(
    host_addr="http://localhost:8887",
    project_id=1,
    schema=schema,
    llm="gpt-4",
    target_spg_types=["SPU", "AttributeValue", "Brand"]
)

# 1. 商品描述抽取
doc = """
Apple iPhone 16 全新发布，搭载 A18 芯片，6.1 英寸超视网膜 XDR 显示屏，
提供 128GB / 256GB / 512GB 三种容量，颜色有黑色、白色、粉色、蓝色。
"""
result = extractor.extract(text=doc, extract_relations=True)

# 2. 产出的实例
for entity in result.entities:
    if entity.type == "AttributeValue":
        graph_client.upsert_node(
            spg_type="AttributeValue",
            record=entity.to_dict()
        )

for relation in result.relations:
    graph_client.upsert_edge(
        edge_type=relation.type,
        from_node=relation.from_node,
        to_node=relation.to_node
    )
```

**关键优势**：Extractor 受到 Schema 约束（如 `ATTR_COLOR` 的值池只有 12 个值），LLM 只能从值池中选，不会产生"凭空发明的颜色"，这就是 KAG 论文中提到的 **Schema-constrained knowledge construction**。

### 4.4 路径 4：API 写入（业务前台）

商家上架、运营配置等场景，前端应用直接调用图 API：

```python
from knext.graph.client import GraphClient
from datetime import datetime

graph = GraphClient(host_addr="http://localhost:8887", project_id=1)

# 1. 商家上架：创建 MerchantSKU + 价格 + 库存
def merchant_listing(merchant_id, sku_id, sale_price, inventory_list):
    # 1.1 创建 MerchantSKU
    graph.upsert_node(
        spg_type="MerchantSKU",
        record={
            "merchant_sku_id": f"MSKU_{merchant_id}_{sku_id}",
            "sku_id": sku_id,
            "merchant_id": merchant_id,
            "status": "ONLINE",
            "listing_time": datetime.now().isoformat()
        }
    )

    # 1.2 创建价格
    graph.upsert_node(
        spg_type="Price",
        record={
            "price_id": f"PRICE_{merchant_id}_{sku_id}_sale",
            "merchant_sku_id": f"MSKU_{merchant_id}_{sku_id}",
            "price_type": "sale",
            "amount": sale_price,
            "status": "active"
        }
    )
    # 自动生成 HAS_PRICE 边（Schema 驱动）

    # 1.3 多仓库库存
    for inv in inventory_list:
        graph.upsert_node(
            spg_type="Inventory",
            record={
                "inventory_id": f"INV_{merchant_id}_{sku_id}_{inv['warehouse_id']}",
                "merchant_sku_id": f"MSKU_{merchant_id}_{sku_id}",
                "warehouse_id": inv["warehouse_id"],
                "available": inv["available"],
                "reserved": 0,
                "alert_threshold": 10
            }
        )

# 2. 删除：业务级级联（注意：图操作不会级联）
def merchant_offline(merchant_id, sku_id):
    # 2.1 删除 MerchantSKU 节点
    graph.delete_node(
        spg_type="MerchantSKU",
        primary_key=f"MSKU_{merchant_id}_{sku_id}"
    )
    # 2.2 显式删除关联的 Price 和 Inventory 节点
    graph.delete_nodes_by_filter(
        spg_type="Price",
        filter_expr=f"merchant_sku_id == 'MSKU_{merchant_id}_{sku_id}'"
    )
    graph.delete_nodes_by_filter(
        spg_type="Inventory",
        filter_expr=f"merchant_sku_id == 'MSKU_{merchant_id}_{sku_id}'"
    )
```

### 4.5 关键工程实践

#### 4.5.1 实体命名规范

为了让实体可被 Agent 高效检索，强烈建议采用 **统一前缀的命名规则**：

| 实体 | 命名格式 | 示例 |
|------|---------|------|
| Category | `CATEGORY/{id}` | `CATEGORY/1003` |
| Brand | `BRAND/{id}` | `BRAND/B001` |
| SPU | `SPU/{id}` | `SPU/SPU20260001` |
| SKU | `SKU/{id}` | `SKU/SKU202600001` |
| Attribute | `ATTR/{id}` | `ATTR/ATTR_COLOR` |
| AttributeValue | `AV/{id}` | `AV/AV_BLACK` |
| Merchant | `MERCHANT/{id}` | `MERCHANT/M20260001` |
| MerchantSKU | `MSKU/{id}` | `MSKU/MSKU001` |
| Warehouse | `WH/{id}` | `WH/WH001` |
| Price | `PRICE/{id}` | `PRICE/PRICE001` |
| Inventory | `INV/{id}` | `INV/INV001` |

#### 4.5.2 链路顺序与依赖约束

注入时必须按依赖顺序处理，否则会出现**悬挂边**：

```
层级 1（无依赖）：Brand, Warehouse, Attribute, AttributeValue
   ↓
层级 2（依赖层级 1）：Category（依赖 Parent）, Merchant
   ↓
层级 3（依赖层级 1+2）：SPU（依赖 Brand, Category, SPUTemplate）
   ↓
层级 4（依赖层级 3）：SKU（依赖 SPU）
   ↓
层级 5（依赖层级 4）：MerchantSKU（依赖 SKU, Merchant）
   ↓
层级 6（依赖层级 5）：Price, Inventory（依赖 MerchantSKU）
```

#### 4.5.3 增量同步策略

| 场景 | 增量标识 | 同步频率 |
|------|---------|---------|
| 品类、品牌、属性字典 | 极少变化 | 每日 full |
| SPU/SKU | 中频变化 | 5 分钟 incremental |
| 价格 | 高频变化 | 实时流式 |
| 库存 | 极高频变化 | 实时流式 |
| 商家 | 低频变化 | 每日 incremental |
| MerchantSKU | 中频变化 | 5 分钟 incremental |

#### 4.5.4 校验与一致性

OpenSPG 在落盘前会自动执行：

```python
builder = DataBuilder(
    host_addr="http://localhost:8887",
    project_id=1,
    validators=[
        "com.ecommerce.validation.SkuTemplateValidator",          # SKU 属性值在 allowed_value_refs
        "com.ecommerce.validation.PriceRangeValidator",           # 价格范围合理
        "com.ecommerce.validation.InventoryConsistencyValidator", # 库存不为负
        "com.ecommerce.validation.CategoryHierarchyValidator"     # 品类层级无环
    ]
)

# 失败回滚策略
builder.set_failure_strategy(
    mode="rollback",          # rollback | skip | retry
    max_retries=3,
    alert_webhook="https://im.xxx.com/hook"
)
```

### 4.6 注入策略选型速查表

| 业务场景 | 推荐路径 | 关键理由 |
|---------|---------|---------|
| 历史 1 亿条 SPU/SKU 一次性导入 | **路径 1** + 全量 | 批量、稳定、可断点续传 |
| 价格库存实时同步 | **路径 2** 流式 | 低延迟、Exactly-once 语义 |
| 商品详情页文本解析 | **路径 3** LLM 抽取 | Schema 约束，避免幻觉 |
| 单店上架/调价 | **路径 4** API | 业务系统直接调用 |
| 跨系统数据迁移 | **路径 1** + 校验规则 | 完整审计、可回滚 |
| 法务合同知识入库 | **路径 3** + 人工复核 | 高风险场景需人机协同 |

### 4.7 完整实例化作业示例（端到端）

下面用一个脚本演示如何把一份 MySQL dump 完整导入 OpenSPG 图谱：

```python
from knext.builder.data_builder   import DataBuilder
from knext.builder.extractor      import Extractor
from knext.builder.stream_builder import StreamBuilder
from knext.schema.client          import SchemaClient

# 1. 确保 Schema 已发布
schema_client = SchemaClient(host_addr="http://localhost:8887", project_id=1)
schema_client.commit_draft()

# 2. 路径 1：批量导入基础数据
builder = DataBuilder(host_addr="http://localhost:8887", project_id=1)

# 层级 1：基础字典
builder.import_spg_type("Category",       "./mappings/category.json",       mode="full")
builder.import_spg_type("Brand",          "./mappings/brand.json",          mode="full")
builder.import_spg_type("Attribute",      "./mappings/attribute.json",      mode="full")
builder.import_spg_type("AttributeValue", "./mappings/attr_value.json",     mode="full")
builder.import_spg_type("Warehouse",      "./mappings/warehouse.json",      mode="full")

# 层级 2：商家
builder.import_spg_type("Merchant",       "./mappings/merchant.json",       mode="full")

# 层级 3：SPU
builder.import_spg_type("SPU",            "./mappings/spu.json",            mode="full")

# 层级 4：SKU
builder.import_spg_type("SKU",            "./mappings/sku.json",            mode="full")

# 层级 5：MerchantSKU
builder.import_spg_type("MerchantSKU",    "./mappings/merchant_sku.json",   mode="full")

# 层级 6：价格与库存
builder.import_spg_type("Price",          "./mappings/price.json",          mode="full")
builder.import_spg_type("Inventory",      "./mappings/inventory.json",      mode="full")

# 3. 路径 2：启动流式实时同步
stream_builder = StreamBuilder(host_addr="http://localhost:8887", project_id=1)
stream_builder.subscribe(topic="ecommerce.price_change",     handler="update_price")
stream_builder.subscribe(topic="ecommerce.inventory_change", handler="update_inventory")
stream_builder.run()

# 4. 路径 3：抽取商品详情文本
extractor = Extractor(host_addr="http://localhost:8887", project_id=1)
for doc in load_documents("./corpus/"):
    result = extractor.extract(doc, target_spg_types=["SPU", "AttributeValue"])
    extractor.commit(result)

# 5. 校验
builder.run_consistency_check([
    "CategoryHierarchyValidator",
    "SkuTemplateValidator",
    "PriceRangeValidator"
])
```

> **关键观察**：四条路径共用同一份 Schema（knext.schema），保证无论数据从哪来，最终落盘都是**同一套类型约束**。这就是 OpenSPG 在文档双层模型中的核心价值 —— 用 Schema 作为「单一事实源」，让不同来源、不同形态的数据汇聚到一张语义一致的图谱上。

---

## 五、Agent 高效消费方案（基于 KAG）

### 5.1 Agent 四层架构与 OpenSPG 组件映射

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Agent 消费层与 OpenSPG 组件映射                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  L4: 智能决策层 - kg-solver (LLM推理)                                 │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • 自动定价策略 → 数值计算 + 图推理                                     │  │
│  │  • 库存调拨建议 → 多跳路径规划                                         │  │
│  │  • 品类扩张分析 → 概念层推理 (Concept)                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  L3: 推理分析层 - kg-solver (符号推理)                                 │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • 商品相似度 → 属性值向量相似度计算                                    │  │
│  │  • 竞争分析 → 聚合统计 + 图遍历                                        │  │
│  │  • 异常检测 → 规则引擎 + 数值比较                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  L2: 语义检索层 - knext.graph (自然语言接口)                           │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • 自然语言查询 → SPARQL/Cypher 自动生成                               │  │
│  │  • 多跳推理 → 路径查询                                                │  │
│  │  • 上下文理解 → Schema约束 + 知识对齐                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  L1: 数据访问层 - knext.graph (原生API)                               │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • 图查询 → graph_client.exec_query()                                │  │
│  │  • 路径遍历 → MATCH paths                                            │  │
│  │  • 聚合统计 → WITH + aggregation                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Graph Store - OpenSPG Backend (TuGraph / GDB)                      │  │
│  │  Category / Brand / SPU / SKU / Merchant / Attribute / AttrValue ...   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent 工具集实现骨架

```python
from knext.graph.client  import GraphClient
from knext.solver.client import SolverClient

class EcommerceAgent:
    def __init__(self):
        self.graph  = GraphClient (host_addr="http://localhost:8887", project_id=1)
        self.solver = SolverClient(host_addr="http://localhost:8887", project_id=1)

    # L2 - 自然语言入口
    def search_products(self, query: str):
        """自然语言商品搜索 - kg-solver 语义理解"""
        return self.solver.solve(query)

    # L1 - 直接图查询
    def get_product_detail(self, sku_id: str):
        """商品详情 - 多跳图查询"""
        query = f"""
        MATCH (sku:SKU {{sku_id: '{sku_id}'}})-[:GENERATES]-(spu:SPU)
        MATCH (spu)-[:BELONGS_TO]->(c:Category)
        MATCH (spu)-[:HAS_BRAND]->(b:Brand)
        MATCH (sku)-[:HAS_ATTR_VALUE]->(av:AttributeValue)
        RETURN sku, spu, c, b, collect(av) AS attrs
        """
        return self.graph.exec_query(query)

    # L3 - 推理聚合
    def analyze_competition(self, sku_id: str):
        """竞品分析 - 属性相似度 + 价格带聚合"""
        query = f"""
        MATCH (target:SKU {{sku_id: '{sku_id}'}})-[:GENERATES]-(spu:SPU)
        MATCH (spu)-[:GENERATES]->(other:SKU)
        MATCH (other)<-[:SOLD_BY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
        WHERE p.price_type = 'sale'
        RETURN other.sku_name AS 竞品, p.amount AS 价格
        ORDER BY p.amount
        """
        return self.graph.exec_query(query)

    # L3 - 跨实体聚合
    def track_category_health(self, category_id: str):
        """品类健康度 - 跨实体聚合"""
        query = f"""
        MATCH (c:Category {{category_id: '{category_id}'}})
        OPTIONAL MATCH (spu:SPU)-[:BELONGS_TO]->(c)
        OPTIONAL MATCH (spu)-[:GENERATES]->(sku:SKU)
        OPTIONAL MATCH (sku)<-[:SOLD_BY]-(m:Merchant)
        OPTIONAL MATCH (sku)<-[:SOLD_BY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
        WHERE p.price_type = 'sale' AND p.status = 'active'
        RETURN c.category_name AS 品类,
               count(DISTINCT spu) AS SPU数量,
               count(DISTINCT sku) AS SKU数量,
               count(DISTINCT m)  AS 商家数量,
               avg(p.amount)      AS 平均价
        """
        return self.graph.exec_query(query)
```

### 5.3 KAG kg-solver 高效消费机制

KAG kg-solver 的核心能力是 **逻辑形式引导的混合推理**，包含 4 类算子：

| 算子类型 | 作用 | 电商场景 |
|---------|------|---------|
| **Planning** | 自然语言问题分解为执行步骤 | "推荐便宜黑色 iPhone" → 品类定位 → 属性筛选 → 价格排序 |
| **Reasoning** | 知识图路径推理 | 跨品类比价、属性相似度计算 |
| **Retrieval** | 文本/向量/精确匹配检索 | 商品描述、NLP 联想 |
| **Numerical** | 数值计算 | 利润率、库存周转、价格带宽 |

**知识与 Chunk 互索引**：每个图节点可回溯到原始文本片段（如 SPU 详情页），反之文本片段可前向链接到图节点（如 NLP 抽出 "256GB 黑色" 自动落到 `ATTR_CAPACITY` / `ATTR_COLOR` 节点）。这种双向索引是 Agent 高效消费的关键 —— 既能精确推理（走图），又能获取完整上下文（回文本）。

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

```python
# kg-solver 的逻辑形式引导推理（混合 4 类操作）
def rag_enhanced_query(user_query: str):
    solver_response = solver.solve(
        query=user_query,
        operators=["planning", "reasoning", "retrieval"],
        max_hops=3
    )

    # 知识与 Chunk 互索引
    for result in solver_response.results:
        chunk_refs  = result.get_chunk_refs()   # 图节点 → 原文片段
        graph_refs  = result.get_graph_refs()   # 原文片段 → 图节点

    return solver_response.final_answer
```

---

## 六、核心场景实战

### 6.1 场景一：智能商品搜索与推荐

**用户查询**："我要买一台 256G 的黑色 iPhone16，价格不要太贵"

```cypher
MATCH (c:Category {name: 'iPhone'})
MATCH (spu:SPU)-[:BELONGS_TO]->(c)
MATCH (spu)-[:GENERATES]->(sku:SKU)
MATCH (sku)-[:HAS_ATTR_VALUE]->(av:AttributeValue)
WHERE av.value IN ['256GB', '黑色']
WITH sku, spu, count(DISTINCT av.value) AS match_score
WHERE match_score = 2
MATCH (sku)-[:SOLD_BY]->(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale' AND p.status = 'active'
MATCH (sku)-[:SOLD_BY]->(m:Merchant)
RETURN spu.spu_name, sku.sku_id, p.amount, m.merchant_name
ORDER BY p.amount ASC
```

### 6.2 场景二：商家智能运营助手（竞品分析）

```python
def competitive_analysis(merchant_id, sku_id):
    """分析商家在 iPhone 16 256GB 黑色 SKU 上的竞争力"""
    query = f"""
    MATCH (target:SKU {{sku_id: '{sku_id}'}})-[:GENERATES]-(spu:SPU)
    MATCH (spu)-[:GENERATES]->(other:SKU)
    MATCH (other)<-[:SOLD_BY]-(ms:MerchantSKU {{merchant_id: '{merchant_id}'}})-[:HAS_PRICE]->(p:Price)
    WHERE p.price_type = 'sale'
    RETURN p.amount AS 本店售价,
           collect(DISTINCT other.sku_id) AS 同类SKU
    """
    return graph_client.exec_query(query)
```

### 6.3 场景三：属性三层模型校验（值池合规性）

商家 SKU 提交时，校验所有属性值是否在模板 `allowed_value_refs` 内：

```python
def validate_submit_form(merchant_submission):
    """
    merchant_submission = [
        {"attr_id": "ATTR_COLOR",   "attr_value_id": "AV_TIFFANY_BLUE"},   # 假设误填
        {"attr_id": "ATTR_CAPACITY","attr_value_id": "AV_128GB"}
    ]
    """
    for item in merchant_submission:
        result = graph_client.exec_query(f"""
        MATCH (sku)-[:GENERATES]-(spu:SPU)
        MATCH (spu)-[:USES]->(t:SPUTemplate)
        MATCH (t)-[r:TEMPLATE_REFERENCES_ATTR]->(attr:Attribute {{attr_id: '{item["attr_id"]}'}})
        WITH r, '{item["attr_value_id"]}' AS submitted
        RETURN submitted IN r.allowed_value_refs AS is_valid,
               r.allowed_value_refs AS 允许值池
        """)
        if not result["is_valid"]:
            raise ValidationError(f"属性值 {item} 不在模板允许范围")
```

### 6.4 场景四：品类健康度分析

```cypher
MATCH (c:Category {name: 'iPhone'})
OPTIONAL MATCH (spu:SPU)-[:BELONGS_TO]->(c)
WITH c, count(DISTINCT spu) AS spu_count
OPTIONAL MATCH (spu)-[:GENERATES]->(sku:SKU)
WITH c, spu_count, count(DISTINCT sku) AS sku_count
OPTIONAL MATCH (sku)-[:SOLD_BY]->(m:Merchant)
WITH c, spu_count, sku_count, count(DISTINCT m) AS merchant_count
OPTIONAL MATCH (sku)<-[:SOLD_BY]-(ms:MerchantSKU)-[:HAS_PRICE]->(p:Price)
WHERE p.price_type = 'sale' AND p.status = 'active'
RETURN c.category_name AS 品类,
       spu_count        AS SPU数,
       sku_count        AS SKU数,
       merchant_count   AS 商家数,
       avg(p.amount)    AS 平均价,
       min(p.amount)    AS 最低价,
       max(p.amount)    AS 最高价
```

---

## 七、实施路线图

```
Phase 1: Schema 落地 (2-3 周)
─────────────────────────────────────────
• 定义 2 个概念类型（SPUTemplate / SKUTemplate）
• 定义 11 个实体类型（Category/Brand/SPU/SKU/Merchant 等）
• 定义 11 个 Relation 含 linkProperties（含 V4 新增 USES_TEMPLATE，删除 DECLARES_ATTRIBUTE）
• 注册 Schema、版本化
                          ↓
Phase 2: 数据接入 (3-4 周)
─────────────────────────────────────────
• 路径 1：MySQL 历史数据全量导入
• 路径 2：Kafka 价格/库存事件实时接入
• 配置 Validator（SKU 模板合规、价格范围、库存非负）
                          ↓
Phase 3: Agent 能力 (4-6 周)
─────────────────────────────────────────
• kg-solver 部署
• L1 数据访问层：8 个查询工具
• L2 语义检索层：自然语言 → SPARQL
• L3 推理层：相似度/竞争/异常检测
• L4 决策层：自动定价/补货建议
                          ↓
Phase 4: 业务应用 (持续)
─────────────────────────────────────────
• 商家助手、智能搜索、品类分析、跨品类联想
```

---

## 八、总结：OpenSPG 的核心价值

Palantir 范式对 OpenSPG/KAG 而言不仅是可行的，而且**几乎是一一对应**：

| Palantir 范式核心特性 | OpenSPG/KAG 实现 | 工程价值 |
|--------------------|---------------------|---------|
| Schema 一等公民 | `knext.schema` + commit | 所有实例化与查询受类型约束 |
| LinkType 一等公民 | `Relation` 注册 | 关系也是 schema，可独立版本化 |
| 属性三层模型 | `HAS_CANDIDATE_VALUE` + `TEMPLATE_REFERENCES_ATTR` + `allowed_value_refs` | 业务规则（图驱动）自动校验 |
| 双层模型 | `Concept` 概念类型 + `Entity` 实体类型 | 元数据与实例清晰分层 |
| 品类继承 | `PARENT_OF` 自连接 + `USES_TEMPLATE` → `TEMPLATE_REFERENCES_ATTR` 链路 | V4 路线 B：属性声明收敛在 Template 层，Category 只承担业务归属 |
| Agent 高效消费 | KAG kg-solver 4 算子 + Knowledge-Chunk 互索引 | 既可精确推理、又能回溯文本 |

**核心洞察**：OpenSPG 是 Palantir 范式最自然的开源落地选择之一。KAG 在 kg-solver 层把图推理、向量检索、符号推理、数值计算统一起来，正是 Palantir 中「Action Type 编排 / Object 视图 / 自动决策」能力在 LLM 时代的对等实现。

---

## 附录：修订记录

| 版本 | 日期 | 主要变更 | 关联文档 |
|------|------|---------|---------|
| V2 | 2026-07-27 | **V4 路线 B 同步更新 + 电商产品数据模型 v1.0 字段对齐**：① 文档头更新为 v2.0，标注上游为 Palantir V4.1；② §1.2 架构图文字：LinkType 从 12 降为 11（删除 DECLARES_ATTRIBUTE），Relation 清单加入 USES_TEMPLATE；③ §2.1 SPGType：SPU 补 `images[]` 字段，AttributeValue 补 `display_meta{}` 字段（color_hex/size_guide/extra_data）；④ §2.2 Relation：删除 DECLARES，新增 USES_TEMPLATE（替代 DECLARES_ATTRIBUTE），Relation 总数 12 个；⑤ §2.3 commit 列表同步更新；⑥ §3 查询模板 3 处 DECLARES 引用全部改为 USES_TEMPLATE → TEMPLATE_REFERENCES_ATTR 链路；⑦ §8 总结表"品类继承"行改为 `PARENT_OF + USES_TEMPLATE + TEMPLATE_REFERENCES_ATTR`；⑧ §7 Phase1 更新 Relation 数量 | 上游文档：`docs/Palantir范式电商语义建模方案.md`（V4.1） |
| V1 | 2026-07-26 | 首版：从 Palantir 范式电商建模方案拆分出独立的 OpenSPG/KAG 落地实现文档。覆盖：① 整体架构映射（Schema Layer + Instance Layer）；② knext.schema 定义 2 概念 + 11 实体 + 12 Relation；③ 双层图查询模板；④ 4 条实例数据注入路径（Mapping DSL / StreamBuilder / Extractor / API）；⑤ Agent 四层消费架构与 8 个工具骨架；⑥ KAG kg-solver 4 类算子 + RAG 增强；⑦ 4 个核心场景的实战示例（Cypher + Python） | 上游文档：`docs/Palantir范式电商语义建模方案.md` |

---

*文档结束*
