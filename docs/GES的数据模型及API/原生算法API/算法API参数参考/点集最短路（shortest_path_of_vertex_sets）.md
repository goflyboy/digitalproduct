# 点集最短路（shortest_path_of_vertex_sets）

> 章节路径：持久化版 / 原生算法API / 算法API参数参考 / 点集最短路（shortest_path_of_vertex_sets）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0462.html

## 点集最短路（shortest_path_of_vertex_sets）
**表1** parameters参数说明

| 参数 | 是否必选 | 说明 | 类型 | 取值范围 | 默认值 |
---|---|---|---|---|---
sources |  是 |  起点ID集合 |  List |  标准csv格式，ID之间以英文逗号分隔，例如：["Alice","Nana"]。 个数不大于100000。 |  -
targets |  是 |  终点ID集合 |  List |  标准csv格式，ID之间以英文逗号分隔，例如：["Alice","Nana"]。 个数不大于100000。 |  -
directed |  否 |  是否考虑边的方向 |  Boolean |  取值为true，不支持false。 |  true
timeWindow |  否 |  用于进行时间过滤的时间窗 |  Object |  具体请参见表2。 |  -
**表2** timeWindow参数说明

| 参数 | 是否必选 | 说明 | 类型 | 取值范围 | 默认值 |
---|---|---|---|---|---
filterName |  否 |  用于进行时间过滤的时间属性名称 |  String |  字符串：对应的点/边上的属性作为时间 |  -
filterType |  否 |  在点或边上过滤 |  String |  V：点上 E：边上 BOTH：点和边上 |  BOTH
startTime |  否 |  起始时间 |  String |  Date型字符串或时间戳 |  -
endTime |  否 |  终止时间 |  String |  Date型字符串或时间戳 |  -
**表3** response_data参数说明

| 参数 | 类型 | 说明 |
---|---|---
path |  List |  最短路径，格式： [vertexId,...] 其中, vertexId：string类型
source |  String |  起点ID
target |  String |  终点ID
