# HyG图数据同步

> 章节路径：持久化版 / HyG图管理API / HyG图数据同步
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0441.html

## HyG图数据同步
#### 功能介绍
将图数据库的更新信息同步到HyG计算引擎。
#### URI
POST /ges/v1.0/{project_id}/hyg/{graph_name}/sync
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
vertex |  否 |  Json |  点属性列表，如果列表为空，则不会同步点属性。参数详见vertex、edge参数说明。 首次执行数据同步时，该参数生效，后续执行数据同步，该参数默认跟首次指定的保持一致。
edge |  否 |  Json |  边属性列表，如果列表为空，则不会同步边属性。参数详见vertex、edge参数说明。 首次执行数据同步时，该参数生效，后续执行数据同步，该参数默认跟首次指定的保持一致。
**表3** vertex、edge参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
label |  是 |  String |  label名称。
property |  是 |  Array of strings |  属性名称，属性要隶属于该标签。
#### 响应参数
**表4** 要素说明

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

jobId |  String |  执行该异步任务的jobId。 说明：  可以查询jobId查看任务执行状态、获取返回结果，详情参考[Job管理API](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0036.html)。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
图数据库中的悬空边（边存在，但是边的source节点或target节点不存在）不会同步到HyG引擎。
#### 请求示例
图数据库的更新信息同步到HyG计算引擎，点属性列表为空，边属性列表的属性名称为“Rating”、label名称为“rate”。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/sync
    {
        "vertex": [],
        "edge": [
            {
                "property": [
                    "Rating"
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
       "jobId": "f99f60f1-bba6-4cde-bd1a-ff4bdd1fd500000168232"
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
返回 |  说明
---|---
400 Bad Request |  请求错误。
401 Unauthorized |  鉴权失败。
403 Forbidden |  没有操作权限。
404 Not Found |  找不到资源。
500 Internal Server Error |  服务内部错误。
503 Service Unavailable |  服务不可用。
#### 错误码
请参见[错误码](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0110.html)。
