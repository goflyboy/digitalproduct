# 执行DSL算法

> 章节路径：持久化版 / HyG算法API / 执行DSL算法
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0543.html

## 执行DSL算法
#### 功能介绍
提供灵活的DSL帮助用户低成本设计并运行算法。DSL算法详细介绍请参考[DSL语法说明](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0493.html)。
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
DSL算法执行结束后，用户需使用HyG算法结果转存API将DSL执行结果转存到OBS上。转存之后，您可以通过stdout等文件查看算法结果，由于HyG图是分布式的，结果文件可能有多个，对应不同分区的结果。
#### URI
POST /ges/v1.0/{project_id}/hyg/{graph_name}/dsl
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** Body参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
scriptPath |  是 |  String |  用户编写好的DSL算法文件路径。
obsParameters |  是 |  Object |  OBS认证参数。具体请见obsParameters参数说明。
timeout |  否 |  Integer |  超时时间，单位为秒，超时范围为 (1, 2147483647)。
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

result |  String |  执行结果。
  * 成功时，result值为success。
  * 失败时，result值为failed。

#### 请求示例
请求示例1：取消已经提交的某个作业。
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/dsl
    {
        "scriptPath": "bucket/run_sssp.py",
        "obsParameters": {
            "accessKey": "XXX",
            "secretKey": "XXX"
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
        "jobId": "6-57222f3d-f6b8-41ba-b492-60ed9b879223"
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
