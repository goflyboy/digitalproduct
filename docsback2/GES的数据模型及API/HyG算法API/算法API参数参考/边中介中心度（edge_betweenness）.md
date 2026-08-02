# 边中介中心度（edge_betweenness）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / 边中介中心度（edge_betweenness）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0503.html

## 边中介中心度（edge_betweenness）
#### 功能介绍
根据输入参数，执行边中介中心度算法。
边中介中心度算法（edge_betweenness）以经过某条边的最短路径数目来刻画边重要性的指标。
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
parameters |  否 |  parameters Object |  算法参数。
**表3** parameters

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
directed |  否 |  Boolean |  是否考虑边的方向。取值为true或false，默认值为false。
weight |  否 |  String |  边上权重。取值为：空或字符串。
  * 空：边上的权重、距离默认为1。
  * 字符串：对应的边上的属性将作为权重，当某边没有对应属性时，权重将默认为1。

seeds |  否 |  String |  节点ID，输入节点个数不大于100000。 当图较大时，运行betweenness较慢，可以设置seeds作为采样节点，进行近似运算，seeds节点越多越接近准确解。
k |  否 |  Integer |  采样个数，k不大于100000。 当图较大时，运行betweenness较慢，可以设置k，算法将从图中随机选取k各点，进行采样运算，k值越大约接近准确解。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
edge_betweenness |  List |  各边的betweenness值，格式： [{“source”: sourceId, “target”: targetId , “betweenness”: betweennessValue },...]，其中：
  * betweennessValue：double类型。

#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
     {
      "algorithmName":"edge_betweenness",
      "parameters":{
             "seeds":"1,2",
             "directed":true
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
