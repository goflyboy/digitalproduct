# 子图匹配算法（subgraph matching）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / 子图匹配算法（subgraph matching）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0524.html

## 子图匹配算法（subgraph matching）
#### 功能介绍
根据输入参数，执行subgraph matching算法。
子图匹配（subgraph matching）算法的目的是在一个给定的大图里面找到与一个给定小图同构的子图，这是一种基本的图查询操作，意在发掘图重要的子结构。
#### URI
```
    POST /ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
```
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** 请求Body参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
algorithmName |  是 |  String |  算法名字。
parameters |  是 |  parameters Object |  算法参数。
**表3** parameters

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
edges |  是 |  String |  需匹配的子图的边集，标准CSV格式，边的起点与终点之间以英文逗号分隔，各边之间以换行符“\n”分隔，例如：“1,2\n2,3”。
vertices |  是 |  String |  需匹配的子图上各点的label， 标准CSV格式，点与其label之间以英文逗号分隔，各点与其label对之间以换行符“\n”分隔，点与sample中点相对应，例如：“1,BP\n2,FBP\n3,CP”。
n |  否 |  Integer |  限制寻找的子图的个数的上限，取值范围[1,100000]，默认值为100。
batch_number |  否 |  Integer |  每轮批量处理的个数，取值范围[1,1000000]，默认值为10000。
directed |  否 |  Boolean |  是否考虑边的方向，取值为true或false，默认值为true。
statistics |  否 |  Boolean |  是否输出所有满足条件的子图的个数，取值为true或false，默认值为false。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
subgraphs |  List |  与pattern_graph同构的子图。格式: [[subgraph1],[subgraph2],…],其中subgraph的格式为： [vertex1,vertex2,…],其中vertex为string类型， 每个子图的点与pattern_graph的点一一对应。
pattern_graph |  List |  格式为：[vertex1,vertex2,…],其中vertex为string类型。
subgraph_number |  Integer |  当statistics = true时，输出所有满足条件的子图的个数。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/ algorithm
    {
        "algorithmName": "subgraph_matching",
        "parameters": {
            "edges": "1,2\n2,3\n3,4\n5,6\n5,4",
            "vertices": "1,movie\n2,user\n3,user\n4,user\n5,user\n6,user",
            "statistics": "true",
            "directed": "true",
            "n": 55,
            "batch_number": "500"
        }
    }
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
#### 响应示例
**状态码： 200**
成功响应示例
```
    Http Status Code: 200
    {
    "jobId": "4448c9fb-0b16-4a78-8d89-2a137c53454a001679122"
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
    {
        "errorMessage": "Parameter error!",
        "errorCode": "GES.8005"
    }
```
#### 状态码
返回值 |  说明
---|---
400 Bad Request |  请求错误
401 Unauthorized |  鉴权失败
403 Forbidden |  没有操作权限
404 Not Found |  找不到资源
500 Internal Server Error |  服务内部错误
503 Service Unavailable |  服务不可用
#### 错误码
请参见[错误码](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0110.html)。
