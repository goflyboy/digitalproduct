# 最短路径（shortest_path）

> 章节路径：持久化版 / 原生算法API / 算法API参数参考 / 最短路径（shortest_path）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0461.html

## 最短路径（shortest_path）
**表1** parameters参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
source |  是 |  String |  输入路径的起点ID。
target |  是 |  String |  输入路径的终点ID。
directed |  否 |  Boolean |  是否考虑边的方向，取值为true。
timeWindow |  否 |  Object |  用于进行时间过滤的时间窗，具体请参见表2。 说明：  timeWindow目前不支持带weight的最短路，即timeWindow与weight不可同时输入。
**表2** timeWindow参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
filterName |  否 |  String |  字符串：对应的点/边上的属性作为时间
filterType |  否 |  String |  在点或边上过滤，默认值为BOTH。
  * V：点上
  * E：边上
  * BOTH：点和边上

startTime |  否 |  String |  起始时间，Date型字符串或时间戳。
endTime |  否 |  String |  终止时间，Date型字符串或时间戳。
**表3** response_data参数说明

| 参数 | 类型 | 说明 |
---|---|---
path |  List |  最短路径，格式： [vertexId,...] 其中, vertexId：string类型
source |  String |  起点ID
target |  String |  终点ID
