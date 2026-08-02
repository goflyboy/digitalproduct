# 最大公共连通（mccis）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / 最大公共连通（mccis）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0558.html

## 最大公共连通（mccis）
#### 功能介绍
MCCIS（最大公共连通诱导子图）算法适用于计算两个图的相似性。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/zh-cn_image_0000002073224706.png)
similarity = 2*|E(mccis)| / (|E(G1) + |E(G2)|)
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
vertex_list_1 |  是 |  String |  子图1的点序列。点数量的上限是10000个。
vertex_list_2 |  是 |  String |  子图2的点序列。点数量的上限是10000个。
recursion_max_number |  否 |  Integer |  递归的最大次数，取值范围 [10000, 100000000], 默认为1000000。
directed |  否 |  Boolean |  Boolean是否考虑边的方向，取值为true或false，默认为false。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
matches |  List |  匹配的点对：[{vertex1: vertex2},…],其中 vertex 为 string 类型。
  * vertex1 属于子图1 ，vertex2 属于子图2。

similarity |  Double |  两个图之间的相似度。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
        "algorithmName": "mccis",
        "parameters": {
            "vertex_list_1": "46,47,48,49,38",
            "vertex_list_2": "50,51,52,42"
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
400 Bad Request |  请求错误。
401 Unauthorized |  鉴权失败。
403 Forbidden |  没有操作权限。
404 Not Found |  找不到资源。
500 Internal Server Error |  服务内部错误。
503 Service Unavailable |  服务不可用。
#### 错误码
请参见[错误码](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0110.html)。
