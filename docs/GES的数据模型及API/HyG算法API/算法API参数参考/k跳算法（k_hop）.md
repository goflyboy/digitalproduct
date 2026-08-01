# k跳算法（k_hop）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / k跳算法（k_hop）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0449.html

## k跳算法（k_hop）
#### 功能介绍
根据输入参数，执行k跳算法。
k跳算法从起点出发，通过宽度优先搜索（BFS），找出k层与之关联的所有节点。找到的子图称为起点的“ego-net”。k跳算法会返回ego-net中节点及其个数。
#### URI
```
    POST /ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
```
**表1** 路径参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
project_id |  是 |  String |  **参数解释：** 项目编号。获取方法，请参见[获取项目ID](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0111.html)。 **约束限制：** 不涉及。 **取值范围：** 只能由英文字母和数字组成，且长度为[1-64]个字符。 **默认取值：** 不涉及。
graph_name |  是 |  String |  图名称。
#### 请求参数
**表2** 请求Body参数

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
algorithmName |  是 |  String |  算法名字。
parameters |  是 |  parameters Object |  算法参数。
**表3** parameters

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
k |  是 |  Integer |  跳数，取值范围[1,100]。
source |  是 |  String |  起点的ID。
mode |  否 |  String |  查找方向。取值如下：
  * OUT：沿出边跳。（默认值）
  * IN：沿入边跳
  * ALL：沿双边跳

说明：  当数据集不包含inedge时，若mode=OUT，选择一个不依赖于Inedge的算法实现版本计算输出，性能会下降；若mode=IN或mode=ALL，会报错。
switch |  否 |  Integer |  当激活边的数量达到总边数/switch数值时，进行pull/push模式切换，取值范围[1,2000]，默认值为40。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
vertices |  List |  k跳内的节点id，格式： [vertexId,...], 其中，vertexId：string类型
source |  String |  起点id。
k |  Integer |  跳数。
k_hop_neighbors |  Integer |  k跳内的节点个数（不包含起点）。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
       "algorithmName":"k_hop",
       "parameters":{
       "k":3,
       "source":"66",
       "mode":"ALL"
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
    "jobId": "4448c9fb-0b16-4a78-8d89-2a137c53454a001679122"
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
400 Bad Request |  请求错误
401 Unauthorized |  鉴权失败
403 Forbidden |  没有操作权限
404 Not Found |  找不到资源
500 Internal Server Error |  服务内部错误
503 Service Unavailable |  服务不可用
#### 错误码
请参见[错误码](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0110.html)。
