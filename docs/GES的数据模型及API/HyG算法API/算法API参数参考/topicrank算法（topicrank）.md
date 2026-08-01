# topicrank算法（topicrank）

> 章节路径：持久化版 / HyG算法API / 算法API参数参考 / topicrank算法（topicrank）
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0506.html

## topicrank算法（topicrank）
#### 功能介绍
根据输入参数，执行TopicRank算法。
TopicRank算法12345热线多维度话题排序算法之一，适用于政务12345热线投诉话题排序。
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
sources |  是 |  String |  节点的ID，支持多点输入，csv格式，逗号分隔。当前仅支持少于等于100000个 id输入。
actived_p |  否 |  Double |  初始sources节点对应的权重初始值，取值范围[0,100000]，默认值为1。
default_p |  否 |  Double |  非sources节点对应的权重初始值，取值范围[0,100000]，默认值为1。
filtered |  否 |  Boolean |  是否对结果进行过滤，取值为true或false，默认值为false。
only_neighbors |  否 |  Boolean |  是否仅输出sources的邻居节点，取值为true或false，默认值为true。
alpha |  否 |  Double |  权重系数(又称阻尼系数)，取值范围为（0,1），默认值为0.85。
convergence |  否 |  Double |  收敛精度，取值范围为（0,1），默认值为0.00001。
max_iterations |  否 |  Integer |  最大迭代次数，取值范围为[0,2000]，默认值为1000。
directed |  否 |  Boolean |  是否考虑边的方向，取值为true或false，默认值为true。
num_thread |  否 |  Integer |  线程数，取值范围为1至cpu最大线程数，默认值为4。
vertex_filter |  否 |  Json String |  在repeat 的operator为“ inV”或“outV”或“bothV”时可选，具体格式见vertex_filter参数说明。
**表4** vertex_filter参数说明

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
leftvalue |  否 |  String |  String 左值，具体格式见leftvalue元素格式。
predicate |  是 |  String |  表示过滤类型，支持的操作如下：
  * 逻辑运算：&和|； 注意：leftvalue和rightvalue必须嵌套使用property_filter，且仅逻辑运算支持嵌套。

  * 比较运算：=, !=, >, >=, <, <=；
  * 集合运算：IN, NOTIN；
    1. 判断左值（标签、id、属性值）是否在右值（必须是array类型）中，和内存版的左值和右值是否有交集的语义有区别。
    2. 不支持CONTAIN、NOTCONTAIN、SUBSET等集合运算。

  * 匹配：右值是左值的PREFIX（前缀）、NOTPREFIX（非前缀）、 SUFFIX（后缀）、NOTSUFFIX（非后缀）、SUBSTRING（子串）、NOTSUBSTRING（非子串）、CISUBSTRING（忽略大小写的子串）、FUZZY（模糊匹配）或REGEX（正则匹配）
  * HAS/HASNOT：是否有此属性，仅支持属性过滤，即左值仅支持property_name。

rightvalue |  是 |  String |  右值，具体格式见rightvalue元素格式。
**表5** leftvalue元素格式

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
label_name |  否 |  String |  过滤“label”，值为“labelName”，值可不填。
property_name |  否 |  String |  过滤“property”，值为属性名称。
ID |  否 |  String |  过滤id，值可不填。
property_filter |  否 |  String |  仅在“predicate”为“&”或者“|”，可在“leftvalue”和“rightvalue”中嵌套使用“property_filter”。
degree |  否 |  String |  可选["both","in","out"]，代表点度数值过滤统计的方向。
**表6** rightvalue元素格式

| 参数 | 是否必选 | 类型 | 说明 |
---|---|---|---
value |  是 |  String |  1\. 过滤“label”，值为label名称。 2\. 过滤“property”，值为属性值，当predicate为HAS/HASNOT，则value仅为占位符，无实意。 3\. 过滤“id”, 值为id值。 说明：  当predicate为IN、NOTIN时，该参数为List[string]类型。
property_filter |  否 |  String |  若“predicate”为“&”或者“|”，可在“leftvalue”和“rightvalue”中嵌套使用“property_filter”。
#### 响应参数
参数 |  类型 |  说明
---|---|---
errorMessage |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误信息。
errorCode |  String |  系统提示信息，执行成功时，字段可能为空。执行失败时，用于显示错误码。
jobId |  String |  执行算法任务ID。请求失败时，字段为空。 说明：  可以利用返回的jobId查看任务执行状态、获取算法返回结果，详情参考[查询Job状态(1.0.0)](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0037.html)。
topicrank |  List |  各节点的topicrank值，格式： [{vertexId:rankValue},...] 其中, vertexId：string类型。 rankValue：double类型。
#### 请求示例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
        "algorithmName": "topicrank",
        "vertex_filter": {
            "property_filter": {
                "leftvalue": {
                    "label_name": "labelName"
                },
                "predicate": "=",
                "rightvalue": {
                    "value": "user"
                }
            }
        },
        "parameters": {
            "sources": "lili,andy",
            "alpha": 0.85,
            "convergence": 0.00001,
            "max_iterations": 1000,
            "filtered": "true"
        }
    }
```
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
SERVER_URL：图的访问地址，取值请参考[业务面API使用限制](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0139.html)。
带vertex_filter的请求样例
```
    POST http://{SERVER_URL}/ges/v1.0/{project_id}/hyg/{graph_name}/algorithm
    {
      "algorithmName": "topicrank",
      "parameters": {
        "sources": "lili,andy",
        "alpha": 0.85,
        "convergence": 0.00001,
        "max_iterations": 1000,
        "filtered": "true",
        "vertex_filter": {
          "property_filter": {
            "leftvalue": {
              "label_name": "labelName"
            },
            "predicate": "=",
            "rightvalue": {
              "value": "user"
            }
          }
        }
      }
    }
```
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
