# 单点环路检测（single_vertex_circles_detection）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / 单点环路检测（single_vertex_circles_detection）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0505.html

## 单点环路检测（single_vertex_circles_detection）
#### 功能介绍
根据输入参数，执行单点环路检测算法。
单点环路检测（single_vertex_circles_detection）意在寻找图中的环路，环路上的点较好地体现了该点的重要性。
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
source |  是 |  String |  被包含节点ID。
min_circle_length |  否 |  Integer |  最小圈长，取值范围[3, 15]，默认值为3。
max_circle_length |  否 |  Integer |  最大圈长(要求min_circle_length<= max_circle_length)，取值范围[3, 15]，默认值为10。
limit_circle_number |  否 |  Integer |  限定寻找圈的个数，取值范围[1, 100000]，默认值为100。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
circles |  List |  经过给定点的圈集合。格式： [[circle1],[circle2],…],其中circle的格式为： [vertexId,…],其中，vertexId：string类型。
source |  String |  被包含节点ID。
circle_number |  Integer |  实际找到的圈的个数。
runtime |  Double |  算法运行时间。
min_circle_length |  Integer |  最小圈长。
max_circle_length |  Integer |  最大圈长。
limit_circle_number |  Integer |  限定寻找圈的个数。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
       "algorithmName":"single_vertex_circles_detection",
       "parameters":{
       "source":"66",
       "min_circle_length":3,
       "max_circle_length":7,
       "limit_circle_number":10000
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
