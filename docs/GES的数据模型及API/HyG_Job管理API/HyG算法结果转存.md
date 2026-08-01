# HyG算法结果转存

> 章节路径：持久化版 / HyG Job管理API / HyG算法结果转存
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0530.html

## HyG算法结果转存
#### 功能介绍
用于将算法（jobId）的执行结果转存到OBS，供用户查看全量结果。
#### URI
POST /ges/v1.0/{project_id}/hyg/{graph_name}/jobs/{job_id}/export-result
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
job_id |  是 |  String |  响应结果中的算法任务Job ID。
#### 请求参数
**表2** 请求Body参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
exportPath |  是 |  String |  转存路径。
obsParameters |  是 |  String |  OBS认证参数。具体请见 _obsParameters参数说明_ 。
erase |  否 |  Boolean |  转存后是否删除原job任务的结果，取值为true或false，默认值为true即表示默认删除job结果并释放资源。
**表3** obsParameters参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
accessKey |  是 |  String |  ak值。
secretKey |  是 |  String |  sk值。
#### 响应参数
**表4** 响应Body参数

| 参数 | 类型 | 说明 |
---|---|---
errorMessage |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误信息。

errorCode |  String |  系统提示信息。
  * 执行成功时，字段可能为空。
  * 执行失败时，用于显示错误码。

jobId |  String |  执行该异步任务的jobId。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
#### 请求示例
执行算法结果转存，返回jobId。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/jobs/{job_id}/export-result
    {
        "exportPath": "demo_movie/",
        "erase":  true,
        "obsParameters": {
            "accessKey": "xxxx",
            "secretKey": "xxxx"
        }
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
