# 查询job列表

> 章节路径：持久化版 / Job管理API / 查询job列表
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0471.html

## 查询job列表
#### 功能介绍
用于查询engine中保存的所有异步任务，返回每个任务的jobId、job状态、原始请求。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
图规格为持久化版的图，目前最多返回100000条请求。
#### URI
GET /ges/v1.0/{project_id}/graphs/{graph_name}/jobs/status?limit={limit}&offset={offset}
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
limit |  否 |  Integer |  本次查询返回最大数量(最大100000)，默认为100000。
offset |  否 |  Integer |  本次查询偏移量，默认为0。
#### 请求参数
无
#### 响应参数
**表2** 响应Body参数说明

| **参数** | **类型** | **说明** |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

result |  String |  查询成功时值为success，失败时值为failed。
jobs |  Object |  查询成功时包含jobs字段，jobs字段中包含系统中保存的job状态列表，单个job的状态结构如表3。
totalCount |  Integer |  查询的总任务数。
**表3** jobs状态结构

| **参数** | **类型** | **说明** |
---|---|---
job_id |  String |  Job名称。
request |  Object |  请求内容，包括command、url和body体。
status |  String |  Job执行状态，取值为pending/running/complete/success/failed。
#### 请求示例
查询job列表， 返回每个任务的jobId、job状态。
```
    GET http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/jobs/status
```
#### 响应示例
**状态码： 200**
成功响应示例
```
    Http Status Code: 200
    {
        "jobs": [
            {
                "jobId": "4ae64af4226f9b91a469c7e609e00b800000382489090",
                "status": "success",
                "request": {
                    "command": "batch_build_index",
                    "url": "/ges/v1.0/854d9316e71d4dc599c5f27ea323d445/graphs/ges_j60071198_hdfs_fdb/indices/action?action_id=batch-build&targetGraphName=ges_j60071198_hdfs_fdb",
                    "rawRequest": "{\"indices\":[{\"indexType\":\"GlobalCompositeEdgeIndex\",\"indexName\":\"cypher_edge_index\",\"indexProperty\":[],\"hasLabel\":true},{\"indexType\":\"GlobalCompositeVertexIndex\",\"indexName\":\"cypher_vertex_index\",\"indexProperty\":[],\"hasLabel\":true}]}"
                }
            },
            {
                "jobId": "d33bdeef9923fc24e20a38b11dbb13540000382489090",
                "status": "success",
                "request": {
                    "command": "import_graph",
                    "url": "/ges/v1.0/854d9316e71d4dc599c5f27ea323d445/graphs/ges_j60071198_hdfs_fdb/action?action_id=import-graph",
                    "rawRequest": "{\"graphName\":\"ges_j60071198_hdfs_fdb\",\"offline\":false,\"edgesetPath\":\"/user/GES/audata/ranking_edge.csv\",\"vertexsetPath\":\"/user/GES/audata/movies_vertex_new.csv\",\"delimiter\":\",\",\"trimQuote\":\"\\\"\",\"vertexsetFormat\":\"csv\",\"parallelEdge\":{\"ignoreLabel\":false,\"action\":\"override\"},\"edgesetFormat\":\"csv\"}"
                }
            },
            {
                "jobId": "3d29c4aac80382aa161214ca716bbf860000382489090",
                "status": "success",
                "request": {
                    "command": "import_graph",
                    "url": "/ges/v1.0/854d9316e71d4dc599c5f27ea323d445/graphs/ges_j60071198_hdfs_fdb/action?action_id=import-graph",
                    "rawRequest": "{\"graphName\":\"ges_j60071198_hdfs_fdb\",\"offline\":false,\"edgesetPath\":\"\",\"vertexsetPath\":\"\",\"delimiter\":\",\",\"schemaPath\":\"/user/GES/audata/schema_aikv.xml\",\"trimQuote\":\"\\\"\",\"vertexsetFormat\":\"csv\",\"parallelEdge\":{\"ignoreLabel\":false,\"action\":\"override\"},\"edgesetFormat\":\"csv\"}"
                }
            }
        ],
        "totalCount": 3,
        "result": "success"
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
