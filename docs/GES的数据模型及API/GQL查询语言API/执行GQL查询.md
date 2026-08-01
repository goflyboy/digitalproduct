# 执行GQL查询

> 章节路径：持久化版 / GQL查询语言API / 执行GQL查询
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0567.html

## 执行GQL查询
#### 功能介绍
图查询语言（Graph Query Language）简称GQL，是声明式查询语言，其核心语法类似Cypher，可以使用GQL查询GES中的数据，并返回结果。GQL查询详细介绍请参考[GQL语法说明](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0564.html)。
#### URI
POST /ges/v1.0/{project_id}/graphs/{graph_name}/action?action_id=execute-gql-query
**表1** 路径参数

| 参数 | 是否必选 | 参数类型 | 描述 |
---|---|---|---
project_id |  是 |  String |  项目编号，用于资源隔离。请参考[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** Body参数

| 参数 | 是否必选 | 参数类型 | 描述 |
---|---|---|---
statements |  是 |  List |  statements为一个语句组，包含一到多条语句。
**表3** statements参数

| 参数 | 是否必选 | 参数类型 | 描述 |
---|---|---|---
statement |  是 |  String |  GQL语句。
parameters |  否 |  Json |  GQL语句参数，在进行参数化查询时使用，默认为空。如需使用，请参考[参数化查询](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0476.html#ges_03_0476__li8383195704410)。
resultDataContents |  否 |  String或List |  返回的结果样式，样式可设置一个或多个。可选参数有“row”,”graph”, “raw”。
includeStats |  否 |  Boolean |  控制返回结果是否携带增删改统计信息的开关，若不设置此字段，默认为不携带。
runtime |  否 |  String |  执行器类型，默认为“block”。
executionMode |  否 |  String |  执行模式。同步执行模式填写“sync”，异步执行填写“async”，不写默认同步执行。异步模式下，获取查询结果参见5.10.1节 查Job状态。
limit |  否 |  Integer |  该字段仅在异步模式下生效，表示对异步结果的最大结果数限制，默认值为100000。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
  1. 在语句前可以添加explain和profile前缀，用于显示查询计划： explain只显示查询计划，不执行语句；profile显示查询计划，并执行语句。
  2. 在异步模式（executionMode参数值为async）下，内存版支持GQL查询结果以csv格式导出到文件。目前支持下列对象的返回：点边单值属性、点边id、分组计数结果等值类型。对于对象类型，目前的版本暂不支持导出，csv中视作空值处理，详情参考[导出job返回结果到文件](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0172.html)。

#### 响应参数
**表4** 响应要素说明

| 参数 | 类型 | 说明 |
---|---|---
results |  List |  每个元素是一条GQL语句的返回结果，详细参数介绍参见参数results中各要素说明。
errors |  List |  每个元素包含字符串形式的code和message信息。
**表5** 参数results中各要素说明

| 参数 | 类型 | 说明 |
---|---|---
columns |  List |  返回的字段名。
data |  List |  返回的数据值，每个元素代表一条记录，详细参数说明请参见参数data中各要素说明。
stats |  Json |  返回的增删改统计信息，详细参数说明请参见参数stats中各要素说明。
plan |  Json |  如果GQL语句带explain或者profile前缀，则此字段输出查询计划，否则不显示该字段，正常执行查询。
jobId |  String |  请求为异步执行模式下，该字段用于输出异步任务id。
jobType |  Integer |  请求为异步执行模式下，该字段用于输出异步任务的类型。
**表6** 参数data中各要素说明

| 参数 | 类型 | 说明 |
---|---|---
row |  List |  表示具体一行的内容，每个元素对应该行的一个字段，仅当resultDataContents为空或者包含“row”类型时显示。
meta |  List |  表示该行每个字段的类型信息，仅当resultDataContents为空或者包含“row”类型时显示。
graph |  Json |  以“graph”样式返回该行信息，仅当resultDataContents包含“graph”类型时显示。
raw |  List |  表示具体一行的内容，每个元素对应该行的一个字段，仅当resultDataContents包含“raw”类型时显示。
**表7** 参数stats中各要素说明

| 参数 | 类型 | 说明 |
---|---|---
contains_updates |  Boolean |  表示本次查询是否有数据修改。
edges_created |  Integer |  创建的边数目。
edges_deleted |  Integer |  删除的边数目。
labels_set |  Integer |  设置的label数目。
properties_set |  Integer |  设置的属性数目。
vertices_created |  Integer |  创建的点数目。
vertices_deleted |  Integer |  删除的点数目。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/action?action_id=execute-gql-query
    {
    	"statements": [{
    		"statement": "match (n) return n limit 1",
            "runtime":"block",
    		"parameters": {},
    		"resultDataContents": ["raw"]
    	}],
        "includeStats": true
    }
```
#### 响应示例
  * 同步任务请求成功样例
**状态码：200**
[code] Http Status Code: 200
        {
            "results": [
                {
                    "columns": ["n"],
                    "data": [
                        {
                            "row": [
                                {
                                    "occupation": "artist",
                                    "gender": "F",
                                    "Zip-code": "98133",
                                    "userid": 0,
                                    "age": "25-34"
                                }
                            ],
                            "meta": [
                                {
                                    "id": "46",
                                    "type": "node",
                                    "labels": [
                                        "user"
                                    ]
                                }
                            ]
                        }
                    ],
                    "stats": {
                        "contains_updates": false,
                        "edges_created": 0,
                        "edges_deleted": 0,
                        "labels_set": 0,
                        "properties_set": 0,
                        "vertices_created": 0,
                        "vertices_deleted": 0
                    }
                }
            ],
            "errors": []
        }
```
  * 异步任务请求成功样例
**状态码：200**
[code] Http Status Code: 200
        {
            "results": [
                {
                    "columns": ["n"],
                    "data": [
                        {
                            "row": [
                                {
                                    "occupation": "artist",
                                    "gender": "F",
                                    "Zip-code": "98133",
                                    "userid": 0,
                                    "age": "25-34"
                                }
                            ],
                            "meta": [
                                {
                                    "id": "46",
                                    "type": "node",
                                    "labels": [
                                        "user"
                                    ]
                                }
                            ]
                        }
                    ],
                    "stats": {
                        "contains_updates": false,
                        "edges_created": 0,
                        "edges_deleted": 0,
                        "labels_set": 0,
                        "properties_set": 0,
                        "vertices_created": 0,
                        "vertices_deleted": 0
                    }
                }
            ],
            "errors": []
        }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 200
    {
        "results": [],
        "errors": [
            {
                "code": "GES.8904",
                "message": "Label index in vertices is not found."
            }
        ]
    }
```
#### 状态码
**表8** 异常返回值说明

| 返回值 | 说明 |
---|---
400 Bad Request |  请求错误。
401 Unauthorized |  鉴权失败。
403 Forbidden |  没有操作权限。
404 Not Found |  找不到资源。
500 Internal Server Error |  服务内部错误。
503 Service Unavailable |  服务不可用。
