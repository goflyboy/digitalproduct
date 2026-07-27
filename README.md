# 电商产品数据模型与 Ontology 语义建模方案

本仓库围绕"电商产品数据模型"提供一套基于 Palantir 范式的语义建模方案，并验证其在多个 Ontology 类产品上的落地。

## 文档索引

| 文档 | 版本 | 说明 |
|---|---|---|
| [docs/电商产品数据模型.md](./docs/电商产品数据模型.md) | v1.0 | 电商产品数据模型详解（SPU/SKU/属性/品类等核心实体），含 iPhone 16 详细数据案例与业务处理流程 |
| [docs/Palantir范式电商语义建模方案.md](./docs/Palantir范式电商语义建模方案.md) | V4.1 | 基于 Palantir 范式（ObjectType/LinkType/Action Type）的电商语义建模方案（路线 B：Template-Centric） |
| [docs/电商语义模型OpenSPG落地实现方案.md](./docs/电商语义模型OpenSPG落地实现方案.md) | v2.0 | OpenSPG/KAG 落地实现方案（SPGType 定义、关系映射、查询模板） |
| [docs/Microsoft Fabric IQ 电商语义建模验证操作指南.md](./docs/Microsoft%20Fabric%20IQ%20电商语义建模验证操作指南.md) | v2.0 | Microsoft Fabric IQ Ontology 端到端 PoC 操作指南 |
| [docs/图业界Ontology产品调研与Palantir电商适配分析.md](./docs/图业界Ontology产品调研与Palantir电商适配分析.md) | v1.3 | Stardog / Fabric IQ / Neo4j Aura / TDengine IDMP / AbutionGraph 五家产品调研与 Palantir 适配对比 |
| [docs2/复杂产品配置器的数据模型.md](./docs2/复杂产品配置器的数据模型.md) | v1.0 | 复杂产品（部件组合/规格实例化）配置场景的数据模型方案：属性 vs 边、单边多属性 vs 多边等多方案对比 |

## 关键设计要点

- **两层语义模型**：Meta Layer（OT_SPU_TEMPLATE / OT_SKU_TEMPLATE 模板类型 + ObjectType 定义）+ Instance Layer（实际数据实例）
- **路线 B Template-Centric**（V4.0+）：属性声明从 Category 层收敛至 Template 层，删除 `DECLARES_ATTRIBUTE` LinkType；`scope`（required/optional/sales）替代原 `is_sales_attr` / `is_inheritable` 字段
- **11 个 LinkType**：`PARENT_OF` / `BELONGS_TO_CATEGORY` / `HAS_BRAND` / `GENERATES` / `HAS_ATTR_VALUE` / `SOLD_BY` / `HAS_PRICE` / `HOLDS_INVENTORY` / `LOCATED_AT` / `TEMPLATE_REFERENCES_ATTR` / `USES_TEMPLATE`
- **13 个 ObjectType**：`OT_CATEGORY` / `OT_SPU` / `OT_SKU` / `OT_BRAND` / `OT_ATTRIBUTE` / `OT_ATTRIBUTE_VALUE` / `OT_SPU_TEMPLATE` / `OT_SKU_TEMPLATE` / `OT_MERCHANT` / `OT_WAREHOUSE` / `OT_MERCHANT_SKU` / `OT_PRICE` / `OT_INVENTORY`

## 示例数据

`fabricsample/` 目录提供 Microsoft Fabric IQ 示例数据（DimProducts / FactSales / Freezer 等），用于 Graph 验证。




根据 @docs3/复杂产品配置器的数据模型.md ，参考 @docs/Palantir范式电商语义建模方案.md 的文档结构，输出Palantir范式复杂产品配置器语义建模方案，放在docs3里

根据 @docs3/复杂产品配置器的数据模型.md ，参考 @docs/图业界Ontology产品调研与Palantir电商适配分析.md 的文档结构，输出图业界Ontology产品调研与Palantir复杂配置产品器适配分析，放在docs3里
根据 @docs3/复杂产品配置器的数据模型.md ，参考 @docs/Microsoft Fabric IQ 电商语义建模验证操作指南.md 的文档结构，输出Microsoft Fabric IQ 复杂产品配置器语义建模验证操作指南，放在docs3里

图业界Ontology产品调研与Palantir电商适配分析

Microsoft Fabric IQ 电商语义建模验证操作指南