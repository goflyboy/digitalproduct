# 华为云图引擎服务 GES 文档（MD 版）

## 来源

- 用户指南：https://support.huaweicloud.com/intl/zh-cn/usermanual-ges/ges_01_0153.html（一般图数据格式）
- API 参考 / 业务面API / 持久化版：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0385.html

## 说明

本目录为华为云 GES 文档的 Markdown 整理版，按章节组织。API 页面保留了 URI、请求参数、请求示例、响应示例、状态码、错误码等完整信息。图片以链接形式保留。

## 目录

### HyG算法API

- [执行DSL算法](HyG算法API/执行DSL算法.md)
- [算法结果TXT格式说明](HyG算法API/算法结果TXT格式说明.md)

#### 算法API参数参考

- [Bigclam算法（bigclam）](HyG算法API/算法API参数参考/Bigclam算法（bigclam）.md)
- [Cesna算法（cesna）](HyG算法API/算法API参数参考/Cesna算法（cesna）.md)
- [OD中介中心度（od_betweenness）](HyG算法API/算法API参数参考/OD中介中心度（od_betweenness）.md)
- [infomap算法（infomap）](HyG算法API/算法API参数参考/infomap算法（infomap）.md)
- [k核算法（kcore）](HyG算法API/算法API参数参考/k核算法（kcore）.md)
- [k跳算法（k_hop）](HyG算法API/算法API参数参考/k跳算法（k_hop）.md)
- [louvain算法（louvain）](HyG算法API/算法API参数参考/louvain算法（louvain）.md)
- [n_paths算法（n_paths）](HyG算法API/算法API参数参考/n_paths算法（n_paths）.md)
- [pagerank算法](HyG算法API/算法API参数参考/pagerank算法.md)
- [personalrank算法（personalrank）](HyG算法API/算法API参数参考/personalrank算法（personalrank）.md)
- [topicrank算法（topicrank）](HyG算法API/算法API参数参考/topicrank算法（topicrank）.md)
- [三角计数算法（triangle_count）](HyG算法API/算法API参数参考/三角计数算法（triangle_count）.md)
- [中介中心度算法（betweenness）](HyG算法API/算法API参数参考/中介中心度算法（betweenness）.md)
- [全对最短路径（all_pairs_shortest_paths）](HyG算法API/算法API参数参考/全对最短路径（all_pairs_shortest_paths）.md)
- [全最短路（all_shortest_paths）](HyG算法API/算法API参数参考/全最短路（all_shortest_paths）.md)
- [关联预测算法（link_prediction）](HyG算法API/算法API参数参考/关联预测算法（link_prediction）.md)
- [单源最短路算法（sssp）](HyG算法API/算法API参数参考/单源最短路算法（sssp）.md)
- [单点环路检测（single_vertex_circles_detection）](HyG算法API/算法API参数参考/单点环路检测（single_vertex_circles_detection）.md)
- [子图匹配算法（subgraph_matching）](HyG算法API/算法API参数参考/子图匹配算法（subgraph_matching）.md)
- [最大公共连通（mccis）](HyG算法API/算法API参数参考/最大公共连通（mccis）.md)
- [标签传播算法（label_propagation）](HyG算法API/算法API参数参考/标签传播算法（label_propagation）.md)
- [点集全最短路（all_shortest_paths_of_vertex_sets）](HyG算法API/算法API参数参考/点集全最短路（all_shortest_paths_of_vertex_sets）.md)
- [紧密中心度算法（closeness）](HyG算法API/算法API参数参考/紧密中心度算法（closeness）.md)
- [聚类系数算法（cluster_coefficient）](HyG算法API/算法API参数参考/聚类系数算法（cluster_coefficient）.md)
- [边中介中心度（edge_betweenness）](HyG算法API/算法API参数参考/边中介中心度（edge_betweenness）.md)
- [连通分量（connected_component）](HyG算法API/算法API参数参考/连通分量（connected_component）.md)

#### DSL语法说明

- [Pregel编程接口](HyG算法API/DSL语法说明/Pregel编程接口.md)
- [图操作接口](HyG算法API/DSL语法说明/图操作接口.md)
- [自定义图分析算法编程示例](HyG算法API/DSL语法说明/自定义图分析算法编程示例.md)
- [自定义算法运行接口（当前支持Pregel编程模型）](HyG算法API/DSL语法说明/自定义算法运行接口（当前支持Pregel编程模型）.md)

### 原生算法API

- [执行算法](原生算法API/执行算法.md)

#### 算法API参数参考

- [最短路径（shortest_path）](原生算法API/算法API参数参考/最短路径（shortest_path）.md)
- [点集共同邻居(common_neighbors_of_vertex_sets)](原生算法API/算法API参数参考/点集共同邻居(common_neighbors_of_vertex_sets).md)
- [点集最短路（shortest_path_of_vertex_sets）](原生算法API/算法API参数参考/点集最短路（shortest_path_of_vertex_sets）.md)
- [算法公共参数](原生算法API/算法API参数参考/算法公共参数.md)

### Cypher操作API

- [基本操作和兼容性](Cypher操作API/基本操作和兼容性.md)
- [执行Cypher查询](Cypher操作API/执行Cypher查询.md)
- [支持的表达式，函数及过程](Cypher操作API/支持的表达式，函数及过程.md)

### GQL查询语言API

- [GQL兼容性](GQL查询语言API/GQL兼容性.md)
- [GQL语法说明](GQL查询语言API/GQL语法说明.md)
- [执行GQL查询](GQL查询语言API/执行GQL查询.md)

### HyG Job管理API

- [HyG算法结果转存](HyG_Job管理API/HyG算法结果转存.md)
- [取消HyG_Job](HyG_Job管理API/取消HyG_Job.md)

### HyG图管理API

- [HyG图数据同步](HyG图管理API/HyG图数据同步.md)
- [HyG导入图](HyG图管理API/HyG导入图.md)
- [创建HyG图](HyG图管理API/创建HyG图.md)
- [删除HyG图](HyG图管理API/删除HyG图.md)
- [查询HyG图列表](HyG图管理API/查询HyG图列表.md)
- [查询HyG图概要信息](HyG图管理API/查询HyG图概要信息.md)

### Job管理API

- [查询Job状态](Job管理API/查询Job状态.md)
- [查询job列表](Job管理API/查询job列表.md)

### 交互式事务API

- [创建事务](交互式事务API/创建事务.md)
- [回滚事务](交互式事务API/回滚事务.md)
- [执行事务Cypher](交互式事务API/执行事务Cypher.md)
- [提交事务](交互式事务API/提交事务.md)

### 元数据操作API

- [更新label](元数据操作API/更新label.md)
- [查询label](元数据操作API/查询label.md)
- [查询图元数据详情](元数据操作API/查询图元数据详情.md)
- [添加label](元数据操作API/添加label.md)
- [生成数据资产](元数据操作API/生成数据资产.md)
- [获取数据资产](元数据操作API/获取数据资产.md)

### 图操作API

- [创建图](图操作API/创建图.md)
- [删除图](图操作API/删除图.md)
- [图列表](图操作API/图列表.md)
- [导入图](图操作API/导入图.md)
- [导出图](图操作API/导出图.md)
- [清空图](图操作API/清空图.md)

### 图统计API

- [查询图概要信息](图统计API/查询图概要信息.md)
- [查询图版本](图统计API/查询图版本.md)

### 点操作API

- [批量删除点](点操作API/批量删除点.md)
- [批量更新点属性](点操作API/批量更新点属性.md)
- [批量添加点](点操作API/批量添加点.md)
- [批量点查](点操作API/批量点查.md)
- [查询点详情](点操作API/查询点详情.md)

### 索引操作API

- [删除索引](索引操作API/删除索引.md)
- [批量新建索引](索引操作API/批量新建索引.md)
- [新建索引](索引操作API/新建索引.md)
- [查询索引](索引操作API/查询索引.md)

### 边操作API

- [批量删除边](边操作API/批量删除边.md)
- [批量更新边属性](边操作API/批量更新边属性.md)
- [批量添加边](边操作API/批量添加边.md)
- [批量边查](边操作API/批量边查.md)
- [查询边详情](边操作API/查询边详情.md)

### 运维监控API

- [查看实时请求](运维监控API/查看实时请求.md)
- [查看监控指标](运维监控API/查看监控指标.md)

### 顶层文档

- [00_README](00_README.md)
- [00_一般图数据格式_数据模型](00_一般图数据格式_数据模型.md)
- [持久化版规格说明](持久化版规格说明.md)
