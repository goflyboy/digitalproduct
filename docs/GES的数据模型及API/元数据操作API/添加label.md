# 添加label

> 章节路径：持久化版 / 元数据操作API / 添加label
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0432.html

## 添加label
#### 功能介绍
添加label。
#### URI
POST /ges/v1.0/{project_id}/graphs/{graph_name}/schema/labels
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
  * 请求参数说明
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
name |  是 |  String |  label名称。 label name的长度不能超过256。 label name只允许字符，数字, 空格，%,@,#,$,:,?,*,.,+,-和_符号。
type |  否 |  String |  Label类别，表示此label用于点或边，取值如下：
    * “vertex”：表示label用于点。
    * “edge”：表示label用于边。
    * “all”：表示label用于点和边。
默认值为all。
properties |  是 |  Object |  待添加属性数组。具体参数介绍请见表3 properties参数说明。
**表3** properties参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
property |  否 |  Object |  label的属性。具体参数介绍请见表4 property参数说明。
**表4** property参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
name |  是 |  String |  属性名称。
    1. property name的长度不能超过256。
    2. property name不允许包含<, >, &, ascci码14,15和30。
    3. 同一个label下不允许存在相同的property。
cardinality |  是 |  String |  属性的复合类型，当前仅支持single。
dataType |  是 |  String |  属性的数据类型。具体请参考[持久化版规格说明](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0231.html)中的元数据类型。

#### 响应参数
**表5** 要素说明

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

result |  String |  响应结果。成功时result值为success，失败时值为failed。
cause |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
#### 请求示例
添加label，label的名称为book，label有一个待添加的属性。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/schema/labels
    {
      "name": "book",
      "type": "vertex",
      "properties": [
        {
          "property": {
            "name": "Title",
            "cardinality": "single",
            "dataType": "string"
          }
        },
        {
          "property": {
            "name": "Version",
            "cardinality": "single",
            "dataType": "string"
          }
        }
      ]
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
     "result": "success"
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
    {
        "errorMessage": "label : book has exist",
        "errorCode": "GES.8701",
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
