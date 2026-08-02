# 取消HyG Job

> 章节路径：持久化版 / HyG Job管理API / 取消HyG Job
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0533.html

## 取消HyG Job
#### 功能介绍
用于取消已经提交的HyG作业。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
取消运行中的作业，作业不会立即终止，可能存在延时。
#### URI
DELETE /ges/v1.0/{project_id}/hyg/{graph_name}/jobs/{job_id}
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
job_id |  是 |  String |  响应结果中的算法任务Job ID。
#### 请求参数
无
#### 响应参数
**表2** 响应Body参数

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
  * 请求示例1：取消已经提交的某个作业。
[code]DELETE http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/jobs/{job_id}
```
  * 请求示例2：取消全部排队中的作业。
[code]DELETE http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/jobs
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
    "errorMessage": "Graph [
    {project_id}
    -movie1] does not exist, please check project_id and graph_name.",
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
