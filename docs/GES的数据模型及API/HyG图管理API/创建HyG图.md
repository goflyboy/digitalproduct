# 创建HyG图

> 章节路径：持久化版 / HyG图管理API / 创建HyG图
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0440.html

## 创建HyG图
#### 功能介绍
创建一个HyG图。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
  * GES持久化版的图计算依赖于HyG引擎，在执行算法之前需要创建HyG图，并将图数据库的数据同步到HyG引擎。
  * HyG组件当前通过白名单开放，请通过[提交工单](https://support.huaweicloud.com/intl/zh-cn/usermanual-ticket/topic_0065264094.html)的方式申请。

#### URI
POST /ges/v1.0/{project_id}/hyg/{graph_name}
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称（图名需要是图数据库中已存在的图名，当前只支持idType为fixedLengthString的图）。
#### 请求参数
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
policy |  否 |  String |  指定图切分策略，目前支持oec策略，默认是oec策略。
inEdge |  否 |  Boolean |  图是否包含入边，默认为false，设置为true会影响数据同步性能。 对于部分算法，如果不包含入边，算法可能会性能下降或者报错，例如算法：shortest_path、sssp、k_hop，详情请查阅对应的算法参数说明。
#### 响应参数
**表3** 响应Body参数说明

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

result |  String |  执行结果。
  * 成功时，result值为success。
  * 失败时，result值为failed。

#### 请求示例
创建HyG图，图切分策略为oec策略，图包含入边。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}
    {
        "policy": "oec",
        "inEdge": true
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
        "errorMessage": "Graph [cb1ed5491f7f466e8947ff09c06ca08c-ges_hyg1] does not exist, please check projectId and graphName.",
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
