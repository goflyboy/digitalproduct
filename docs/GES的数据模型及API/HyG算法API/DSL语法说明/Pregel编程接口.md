# Pregel编程接口

> 章节路径：持久化版 / HyG算法API / DSL语法说明 / Pregel编程接口
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0547.html

## Pregel编程接口
用户在实现UserPregelAlgorithm中的方法init和compute时主要依赖于PregelContext对象，该对象提供如下API：
**表1** PregelContext API

| 方法和属性 | 描述 | 说明 |
---|---|---
ext_id(nid)->int |  获取当前点的用户自定义外部ID（只支持可转化为int类型的ID） |  图数据（值、拓扑）基本操作。
value(nid)->int/float/bool |  获取当前点的值
set_value(nid, new_value)->None |  设置当前点的值
out_edges(nid) -> List[int] |  获取当前点的出边(List)
edge_dst(eid)->int |  获取当前边的目标点
num_nodes |  获取全图点数
num_edges |  获取全图总边数
send(dst_nid, msg)->None |  向目标顶点发送消息 |  顶点间的数据交换操作。
halt(nid) ->None |  将当前顶点设置为halt状态 |  当图中顶点都为halt且无消息时，或superstep达到最大迭代数时，算法终止。
superstep -> int |  获取当前超步数
