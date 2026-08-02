# 点集共同邻居(common_neighbors_of_vertex_sets)

> 章节路径：持久化版 / 原生算法API / 算法API参数参考 / 点集共同邻居(common_neighbors_of_vertex_sets)
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0463.html

## 点集共同邻居(common_neighbors_of_vertex_sets)
**表1** parameters参数说明

| 参数 | 是否必选 | 说明 | 类型 | 取值范围 | 默认值 |
---|---|---|---|---|---
sources（2.2.6） |  是 |  起点ID集合 |  List |  标准csv格式，ID之间以英文逗号分隔，例如：["Alice","Nana"]。 个数不大于100000。 |  -
targets（2.2.6） |  是 |  终点ID集合 |  List |  标准csv格式，ID之间以英文逗号分隔，例如：["Mike","Amy"]。 个数不大于100000。 |  -
restricted（2.2.13） |  否 |  是否带其他约束 |  Boolean |  true或false。
  * false：不带额外约束，即找到的共同邻居为起点集和终点集对应邻域的交集。
  * true，带额外约束，这里指找到的共同邻居不仅是起点集和终点集邻域的交集，同时共同邻居集合中的每个点都至少有2个及以上邻居节点在起点集和终点集中。

|  true
**表2** response_data参数说明

| 参数 | 类型 | 说明 |
---|---|---
vertices |  List |  公共邻居节点，格式： [vertexId,...], 其中, vertexId：string类型
common_neighbors |  Integer |  公共邻居节点个数。
