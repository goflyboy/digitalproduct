# 查询Job状态

> 章节路径：持久化版 / Job管理API / 查询Job状态
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0472.html

## 查询Job状态
#### 功能介绍
查询Job的执行状态。对点过滤查询、边过滤查询、执行算法等异步API，命令下发后，会返回jobId，通过jobId查询任务的执行状态。
#### URI
GET /ges/v1.0/{project_id}/graphs/{graph_name}/jobs/{job_id}/status?offset=_offset_ &limit=_limit_
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
job_id |  是 |  String |  Job ID。
offset |  否 |  Integer |  本次查询偏移量，默认为0。
limit |  否 |  Integer |  本次查询返回最大数量(最大100000)，默认为100000。
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

status |  String |  查询成功时返回任务状态，包括以下五种状态：
  * pending：等待中。
  * running：运行中。
  * success：成功。
  * complete：完成。
  * failed：失败。

查询失败时字段为空。
data |  Object |  算法运行的结果。查询失败时字段为空。
result |  String |  查询结果。成功时值为success，失败时值为failed。
**表3** data参数说明

| 参数 | 类型 | 说明 |
---|---|---
vertices |  List |  点上关联的算法结果。
edges |  List |  边上关联的算法结果。
outputs |  Object |  其他输出结果。
data_return_size |  Integer |  本次查询返回结果数量。
data_offset |  Integer |  本次查询返回结果偏移量。
data_total_size |  Integer |  异步任务产生的结果数据总量。
#### 请求示例
查询Job的执行状态，查询偏移量为0，查询返回最大数量为2。
```
    GET http://{SERVER_URL}/ges/v1.0/{project_id}/graphs/{graph_name}/jobs/{job_id}/status?offset=0&limit=2
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
#### 响应示例
**状态码： 200**
成功响应示例
```
    Http Status Code: 200
    {
        "status": "complete",
        "data": {
            "outputs": {
                "path": [
                    "46",
                    "133",
                    "130",
                    "78"
                ],
                "source": "46",
                "target": "78"
            }
        },
        "result": "success"
    }
```
**状态码： 400**
失败响应示例
```
    Http Status Code: 400
    {
        "errorMessage": "can not find job, jobId is 0ebb322076be429359b721c46fde16ff00003824890901",
        "errorCode": "GES.8301",
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
