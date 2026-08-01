# 自定义算法运行接口（当前支持Pregel编程模型）

> 章节路径：持久化版 / HyG算法API / DSL语法说明 / 自定义算法运行接口（当前支持Pregel编程模型）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0546.html

## 自定义算法运行接口（当前支持Pregel编程模型）
在内置图分析算法不能满足用户需求的时候，HyG允许用户在Pregel编程模型中使用python语言实现自定义算法。其中，运行pregel自定义算法的接口是:
```
    BaseGraph.run_pregel(model:class, result_filter=None, debug_mode=False)
```
其中，model是class类型，是hyg.analytics.model.PregelModel的子类，用户在调用run_pregel接口前需要先自定义的PregelModel子类实现算法计算逻辑，例如pregel编程模型示例所示：首先，用户需要在@pregel_type装饰器中指定点值类型（ntype）和消息类型（mtype），其中，mtype可以不进行设置，默认和ntype保持一致。然后用户需要在UserPregelAlgorithm中实现以点为中心的方法init和compute，其中，init方法仅在算法开始时执行一次，而compute方法则会被迭代多次，当以上方法未被实现时，默认为空。此外，combiner参数合并发往同一目标点的消息，用以减少通信开销，默认为None，即不合并消息。
pregel编程模型：
```
    from hyg.analytics.model import pregel_types, PregelModel
    @pregel_types(ntype=None, mtype=None, combiner=None)
    class PregelModel:
        @staticmethod
        def init(ctx, nid):
            pass

        @staticmethod
        def compute(ctx, nid, msgs):
            pass
```
result_filter参数是function类型，支持lambda函数，入参为(ctx, nid)，返回值为bool，用于对pregel计算结果进行过滤；debug_mode为bool类型，当debug_mode为True时，UDF不会被即时编译成Native code，而是通过python解释器解释执行，此时HyG框架中进程的并发线程数被强制设置为1，且UDF中用户可以使用print语句打印调试信息（当debug_mode=False时，UDF中有print语句会报错）。
此外，BaseGraph还有一个BaseGraph.nid(ext_id:str)->int的接口，用于获取点的内部ID。
