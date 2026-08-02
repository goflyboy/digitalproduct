# 查询label

> 章节路径：持久化版 / 元数据操作API / 查询label
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0434.html

## 查询label
#### 功能介绍
查询label。
#### URI
GET /ges/v1.0/{project_id}/graphs/{graph_name}/schema?label={labelName}
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
label |  是 |  String |  Label名称。
#### 响应参数
**表2** 响应要素说明

| 参数 | 类型 | 说明 |
---|---|---
data |  data Object |  查询结果。请求失败时字段为空。
result |  String |  响应结果。成功时result值为success，失败时值为failed。
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

**表3** data

| 参数 | 类型 | 说明 |
---|---|---
properties |  Object |  属性数组。
type |  String |  Label类型，表示此label用于点或边。
#### 请求示例
进行查询label操作。
```
    GET http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/schema?label={labelName}
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
#### 响应示例
**状态码： 200**
成功响应示例
```
    Http Status Code: 200
    {
        "data": {
            "type": "vertex",
            "properties": [
                {
                    "name": "Rating",
                    "type": "int",
                    "cardinality": "single"
                },
                {
                    "name": "Datetime",
                    "type": "string",
                    "cardinality": "single"
                }
            ]
        },
        "result": "success"
    }

```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
    {
        "errorMessage": "Label [book1] does not exist.",
        "errorCode": "GES.8000",
        "result": "failed"
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
