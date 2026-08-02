# Cesna算法（cesna）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / Cesna算法（cesna）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0521.html

## Cesna算法（cesna）
#### 功能介绍
根据输入参数，执行Cesna算法。
Cesna算法是一种重叠社区发现算法，该算法将节点与社区之间的关系建模为一个二部图，假设图中节点的连边是根据社区关系生成的。此外，该算法还利用了节点属性对社区进行建模，即假设节点的属性也是根据社区关系生成的。
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
convergence |  否 |  Double |  收敛精度，取值范围为(0,1)，默认值为0.00001。
max_iterations |  否 |  Integer |  最大迭代次数。API调用限制为[1,2147483647]，前端调用限制为[1,2000]，默认值为100。
community_num_space |  是 |  String |  社区数量搜索空间，多个整型值用","隔开，最多不超过100个，每个整型值的范围为[1,10000]。
learning_rate |  否 |  Double |  模型学习率，取值大于0，默认为0.01。
holdout_rate |  否 |  Double |  交叉验证所需的验证集占数据集比例，取值范围为(0,1)，默认值为0.1。
node_attributes |  是 |  String |  节点属性格式。多个整型的数字用 ; 隔开。整型数字表示一个binary数组中值为1的元素的index，例如1;2;3，表示节点第1、2、3维度属性为1，其余属性为0。节点属性index大于等于0，小于10000，index数量小于等于10000。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
communities |  List |  各节点对应的社团(community)，格式： [{vertexId:[communityId]},...] 其中, vertexId: string类型。 communityId: int类型。
community_num |  Integer |  社团数量。
log_likelihood |  double |  置信度。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
      "algorithmName":"cesna",
      "parameters":{
      "community_num_space":"3,2,10"，
      "node_attributes": "weight"
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
