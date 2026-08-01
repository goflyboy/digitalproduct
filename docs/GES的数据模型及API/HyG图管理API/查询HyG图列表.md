# 查询HyG图列表

> 章节路径：持久化版 / HyG图管理API / 查询HyG图列表
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0520.html

## 查询HyG图列表
#### 功能介绍
查询HyG图列表。
#### URI
GET /ges/v1.0/{project_id}/hyg
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
#### 请求参数
无
#### 响应参数
**表2** 响应Body参数说明

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

data |  Object |  查询成功时包含data字段，参数详见data参数说明。
result |  String |  执行结果。
  * 成功时，result值为success。
  * 失败时，result值为failed。

**表3** data

| 参数 | 类型 | 说明 |
---|---|---
name |  String |  图名称。
vertex |  Json |  包含的点标签、属性信息。
edge |  Json |  包含的边标签、属性信息。
policy |  String |  切分策略。
inEdge |  Boolean |  是否包含入边。
idIndex |  Boolean |  是否包含点ID索引。
updateTime |  String |  图更新时间。
vertexNum |  Integer |  点数量。
edgeNum |  Integer |  边数量。
#### 请求示例
查询HyG图列表。
```
    GET http://{SERVER_URL}/ges/v1.0/{project_id}/hyg
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
#### 响应示例
**状态码： 200**
成功响应示例
```
    Http Status Code: 200
    {
        "data": [
            {
                "name": "ges_hyg",
                "inEdge": true,
                "idIndex": true,
                "policy": "oec",
                "updateTime": "2025-02-11 17:39:50",
                "vertex": [
                    {
                        "label": "__vertex_label__"
                    }
                ],
                "edge": [
                    {
                        "label": "rate",
                        "property": [
                            "Rating"
                        ]
                    },
                    {
                        "label": "__edge_label__"
                    }
                ],
                "vertexNum": 144,
                "edgeNum": 1632
            }
        ],
        "result": "success"
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 404
    {
    "errorMessage": "Not found. Please check the input parameters.",
    "errorCode": "GES.8000"
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
