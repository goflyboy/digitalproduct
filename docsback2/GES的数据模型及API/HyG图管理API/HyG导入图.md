# HyG导入图

> 章节路径：持久化版 / HyG图管理API / HyG导入图
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0542.html

## HyG导入图
#### 功能介绍
导入HyG图数据。
#### URI
POST /ges/v1.0/{project_id}/hyg/{graph_name}/import-graph
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
edgesetPath |  是 |  String |  边文件目录或边文件名，支持csv、txt格式文件导入。
vertexsetPath |  是 |  String |  点文件目录或点文件名，支持csv、txt格式文件导入。
schemaPath |  是 |  String |  新增数据的元数据文件OBS路径。
logDir |  否 |  String |  导入图日志存放目录，用于存储导入失败的数据和详细错误原因。
delimiter |  否 |  Character |  csv格式文件字段分隔符，默认值为逗号（,）。
trimQuote |  否 |  Character |  csv格式文件字段包围符，默认值为双引号（"）。用来包围一个字段，如字段中含有分隔符或者换行等。
obsParameters |  是 |  Object |  Obs相关参数。参数详见obsParameters参数说明。
vertex |  否 |  Object |  点属性列表，指定的属性需属于schema文件中的属性，如果列表为空，则不会导入点属性。参数详见vertex、edge参数说明。
edge |  否 |  Object |  边属性列表，指定的属性需属于schema文件中的属性，如果列表为空，则不会导入边属性。参数详见vertex、edge参数说明。
**表3** obsParameters参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
accessKey |  是 |  String |  用户的accessKey。
secretKey |  是 |  String |  用户的secretKey。
**表4** vertex、edge参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
label |  是 |  String |  label名称。
property |  是 |  Array of strings |  属性名称，属性要隶属于该标签。支持的属性类型包括：string、bool、int、long、double、float。
#### 响应参数
**表5** 响应Body参数说明

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

jobId |  String |  执行该异步任务的jobId。 可以查询jobId查看任务执行状态、获取返回结果，详情参考[Job管理API](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0036.html)。
#### 请求示例
进行导入图操作，边文件目录为testbucket/demo_movie/edges/，边数据集格式为csv，点文件目录为testbucket/demo_movie/vertices/，点数据集格式为csv，新增数据的元数据文件OBS路径为testbucket/demo_movie/schema.xml，日志存放目录为testbucket/importlogdir。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/import-graph
    {
      "edgesetPath": "testbucket/demo_movie/edges/",
      "vertexsetPath": "testbucket/demo_movie/vertices/",
      "schemaPath": "testbucket/demo_movie/schema.xml",
      "logDir": "testbucket/importlogdir",
      "delimiter": ",",
      "trimQuote": "\"",
      "obsParameters": {
        "accessKey": "xxxxxx",
        "secretKey": "xxxxxx"
      },
      "vertex": [
            {
                "property": [
                    "title",
                    "movieid"
                ],
                "label": "movie"
            }
        ],
        "edge": [
            {
                "property": [
                    "Rating",
                    "Datetime"
                ],
                "label": "rate"
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
      "jobId": "b4f2e9a0-0439-4edd-a3ad-199bb523b613"
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
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
