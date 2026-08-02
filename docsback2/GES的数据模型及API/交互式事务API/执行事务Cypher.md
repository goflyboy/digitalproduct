# 执行事务Cypher

> 章节路径：持久化版 / 交互式事务API / 执行事务Cypher
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0553.html

## 执行事务Cypher
#### 功能介绍
执行事务Cypher。
#### URI
POST /ges/v1.0/{project_id}/graphs/{graph_name}/transaction/{commit}
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
commit |  是 |  String |  事务ID，通过创建事务接口获取。
#### 请求参数
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
statements |  是 |  List |  statements为一个语句组，包含一到多条语句。其中每个元素的格式如statements参数说明。
**表3** statements参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
statement |  是 |  String |  Cypher语句。
parameters |  是 |  Object |  Cypher语句参数，在进行参数化查询时使用，默认为空。 如需使用，请参考[参数化查询](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0338.html#ges_03_0338__section1885065125812)。
resultDataContents |  否 |  String或List |  返回的结果样式，样式可设置一个或多个。可选参数有“row”,”graph”, “raw”(2.2.27版本新增)。
includeStats |  否 |  Boolean |  控制返回结果是否携带增删改统计信息的开关，若不设置此字段，默认为不携带。
runtime |  否 |  String |  执行器类型，可选值为“map”、“slotted” 、“block”，默认为“map”。slotted执行器自2.3.15版本开始支持，block执行器自2.4.1版本开始支持。
executionMode（2.2.23） |  否 |  String |  执行模式。同步执行模式填写“sync”，异步执行填写“async”，不写默认同步执行。异步模式下，获取查询结果参见[查询Job状态](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
limit（2.2.23） |  否 |  Int |  该字段仅在异步模式下生效，表示对异步结果的最大结果数限制，默认值为100000。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
  * 在语句前可以添加explain和profile前缀，用于显示查询计划： explain只显示查询计划，不执行语句；profile显示查询计划，并执行语句。
  * runtime字段说明：与map执行器相比，slotted执行器和block执行器在语句的计划生成阶段完成了更多的语句数据流分析，在大部分情况下执行速度更快，占用内存更少。
  * Cypher事务：
    1. 持久化版规格下Cypher支持事务，用户可以通过设置transactional为true来开启Cypher的事务功能，以保证单条Cypher语句的原子性。对于多条Cypher语句的事务暂不支持。事务的隔离级别为串行化（serializability）。
    2. 由于底层存储引擎存在5s的事务时间窗口限制，因此Cypher的事务不可超过5s。对于复杂的查询，比如说多跳，运行时间可能会超过5s，从而触发超时导致提交失败。
使用Cypher的dbms.killQuery过程可以终止Cypher事务（详见[Cypher API-函数和过程](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0339.html)）， 并回滚这条Cypher请求造成的所有改动。

#### 响应参数
**表4** 响应Body参数说明

| 参数 | 类型 | 说明 |
---|---|---
results |  List |  一个List，每个元素是一条Cypher语句的返回结果。
errors |  List |  一个List，每个元素包含字符串形式的code和message信息。
**表5** 参数results中各要素说明

| 参数 | 类型 | 说明 |
---|---|---
columns |  List |  返回的字段名。
data |  List |  返回的数据值，每个元素代表一条记录。
stats |  Object |  返回的增删改统计信息。
plan |  Object |  如果cypher语句带explain或者profile前缀，则此字段输出查询计划，否则不显示该字段，正常执行查询。profile特性2.3.12版本开始支持。
jobId(2.3.10) |  String |  请求为异步执行模式下，该字段用于输出异步任务id。
**表6** 参数data中各要素说明：

| 参数 | 类型 | 说明 |
---|---|---
row |  List |  表示具体一行的内容，每个元素对应该行的一个字段，仅当resultDataContents为空或者包含“row”类型时显示。
meta |  List |  表示该行每个字段的类型信息，仅当resultDataContents为空或者包含“row”类型时显示。
graph |  Object |  以“graph”样式返回该行信息，仅当resultDataContents包含“graph”类型时显示。
raw(2.2.27) |  List |  以“raw”样式返回该行信息，仅当resultDataContents包含“raw”类型时显示。
**表7** stats各要素响应参数：

| 参数 | 类型 | 说明 |
---|---|---
contains_updates |  Boolean |  表示本次查询是否有数据修改。
edges_created |  Integer |  创建的边数目。
edges_deleted |  Int |  删除的边数目。
labels_set |  Integer |  设置的label数目。
properties_set |  Integer |  设置的属性数目。
vertices_created |  Integer |  创建的点数目。
vertices_deleted |  Integer |  删除的点数目。
#### 请求示例
执行Cypher查询，Cypher语句为match (n) return n limit 1，返回的结果样式是每个元素对应该行的一个字段。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/transaction/{commit}
    {
           "statements": [{
                  "statement": "match (n) return n limit 1",
                  "parameters": {},
                  "resultDataContents": ["row"],
                  "includeStats": false
           }]
    }
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
#### 响应示例
**状态码： 200**
成功响应示例（同步任务）
```
    Http Status Code: 200
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
                ]，
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
**状态码： 200**
成功响应示例（异步任务）
```
    Http Status Code: 200
      "results": [
            {
                "columns": [
                    "jobId"
                ],
                "jobId": "247f395d813e53804b022df6306ca4160000382489090",
                "data": [
                    {
                        "row": [
                            "247f395d813e53804b022df6306ca4160000382489090"
                        ],
                        "meta": [
                            null
                        ]
                    }
                ]
            }
        ],
        "errors": []
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
        "results": [],
        "errors": [
            {
                "code": "GES.8902",
                "message": "Parentheses are required to identify nodes in patterns, i.e. (n) (line 1, column 7 (offset: 6))"
            }
        ]
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
