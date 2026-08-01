# GQL语法说明

> 章节路径：持久化版 / GQL查询语言API / GQL语法说明
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0568.html

## GQL语法说明
GQL是为图数据库设计的标准查询语言，GQL标准请参考ISO发布的[GQL文档](https://www.iso.org/standard/76120.html)。
#### 支持的GQL子句
GES支持的GQL相关的子句，清单如下：
**表1** 支持的GQL子句

| 关键字 | 支持情况 | 举例 | 备注 |
---|---|---|---
insert |  仅持久化版支持 |  insert (n:movie{_ID_:'1a', genres: 'Comedy|Drama'}) return n |  -
set |  仅持久化版支持 |  match (n) where element_id(n)='1a' set n.movieid=1 return n |  -
remove |  仅持久化版支持 |  match (n) where element_id(n)='1a' remove n.movieid return n |  -
delete |  仅持久化版支持 |  match (n) where element_id(n)='1a' delete n |  -
match |  部分支持 |  match (n where element_id(n)= '1a')-->(m) return count(*) |  参考模式匹配章节。
optional match |  部分支持 |  match (n) where id(n)= '1a' optional match (n)-->(m) return count(*) |  参考模式匹配章节。
let |  支持 |  let a=1, value b::long=2 return a,b |  不考虑类型匹配时，可以等价表示为cypher中with语义。
for |  支持 |  for a in [1,2,3] return a |  暂不支持offset/ordinality参数，可以等价表示为cypher中的unwind语义。
filter/where |  支持 |  match (n) where element_id(n)='1a' return n |  -
order by |  支持 |  match (n:movie) return n order by n.genres asc |  -
limit/offset |  支持 |  match (n:movie) return n skip 10 limit 10 |  -
union&union all |  支持 |  return 1 as a union return 2 as a |  -
next yield |  支持 |  match (n:user) return n union all match (n:movie) return n next yield n as b match (b)-->(m) return m |  目前需要携带yield关键字声明后续阶段用到的变量。
call |  部分支持 |  call db.indexes() |  -
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
  1. 目前不支持多图联合查询，不支持use graph语义。
  2. 不支持select…from… group by…having子句。
  3. 不支持at schema操作。
  4. 对结果集的集合操作，目前只支持union，暂不支持except，intersect，otherwise等针对结果集的集合操作语义。
  5. 关键字call后只能写过程名，不支持写call风格的子查询。

#### 模式匹配
GQL中的模式匹配总体参考Cypher，下列表格中描述的模式，未携带match关键字的，都是在match子句中的图模式：
**表2** 模式匹配

| 特性 | 描述 | 示例 | 支持版本 |
---|---|---|---
点Pattern |  表示一组具备某种相同特征的点 |  (n:movie{title:'hello'}) |  2.4.15
(n:movie where n.title='hello')
(n:movie|user)
边Pattern |  支持有方向、无方向、带label/属性过滤的边pattern，支持指定两端id进行边查询 |  (n)-[r]-> (m), (n)<-[r]-(m), (n)-[r]- (m)
(n)-[r:rate{Rating:1}]-(m)
(n)-[r:rate where r.Rating=1]-(m)
路径 |  支持匿名路径 |  match (n)-[r]->(m)-->(s)
支持命名路径 |  match p=(n)-[r]->(m)-->(s)
可变长路径 |  match p=trail (n)-[r]->{1,3}(m) where element_id(n)='46' return p
带去重的可变长遍历 |  match p=trail (n)-[r]->{1,3}(m) where element_id(n)='46' return distinct m
嵌套路径 |  match (d:Stop) ((s:Stop)-[:NEXT]->(f:Stop) where s.time <> f.time){1,3} (a:Stop) RETURN d.departs AS departureTime, a.arrives AS arrivalTime |  不支持
路径模式 |  支持walk，trail，simple，acyclic路径模式，详见下方路径模式章节 |  match trail (n)-[r]-{1,3}(m), trail (n)--(m1) where element_id(n)='0' return count(*) |  2.4.15
其他 |  match子句中多pattern |  match (n)-[r]->(m), (m)-->(s) return count(*)
多条match语句 |  match (n)-[r]->(m) with m match (m)-->(s) return count(*)
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
  1. 不支持optional关键字后携带用大括号包裹的子查询。
  2. match关键字后不支持携带SHORTEST关键字和GROUP关键字。
  3. 暂不支持keep关键字。

#### 路径模式
在match语句中，支持输入若干Graph Pattern，代表若干条路径，每条路径以逗号隔开。GQL支持下列四种路径模式，作为可选关键字配置在Graph Pattern前，如果不配置任何关键字，则取默认值walk。
**表3** 路径模式

| 关键字 | 释义 |
---|---
walk |  同一条path中，点边都可以重复。
trail |  同一条path中，边不可以重复。
simple |  同一条path中，除了末端顶点外，中间节点不能重复。
acyclic |  同一条path中，点不能重复。
#### 支持的类型
  1. GQL中的基础数据类型，和GES类型映射关系如下：
**表4** GQL基础类型

| GQL类型 | 类型 | 备注 |
---|---|---
bool |  Boolean |  -
string |  string，char array和enum |  -
int32 |  Integer |  -
int64 |  long |  -
float |  float |  -
double |  double |  -
datetime |  date |  GES中支持的时间单位最小为秒。
  2. 此外，GQL中还有一些复杂类型，这些类型构造方式和GES的支持情况如下：
**表5** GQL复杂类型

| GQL类型 | 支持情况 | 示例 |
---|---|---
vertex/node |  支持 |  match (n) return n
edge/ relationship |  支持 |  match (n)-[r]->(m) return r
array/list |  支持 |  return [1,2,3] as li
record |  支持 |  match (n)-->(m) return {start:id(n), end:id(m)}
path |  支持 |  match p=(n1)-[:friends]-{1,2}(n2) return p limit 10
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
     1. 对GQL复杂类型中提到的复杂类型，其中除了List用于匹配GES中的多值属性外，其他类型均无法通过set语句设为点边上某个属性的值。
     2. 目前path类型支持通过match语句构造，暂不支持多条path的连接操作或者通过点边来构造path。
     3. 暂不支持对graph对象和table对象的显示构造和赋值。
     4. 暂不支持符合GQL标准的Duration类型。

#### 支持的表达式和函数
  1. GQL支持[Cypher支持的表达式，函数及过程](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0477.html)章节中的表达式和函数。此外GQL还支持下列函数。
**表6** GQL支持的函数

| 函数名 | 对应Cypher函数 | 释义 | 例句 |
---|---|---|---
collect_list |  collect |  聚集函数，将结果收集为列表 |  match (n:movie) return n.genres, collect_list(n) as movieList
element_id |  id |  获取点边id |  match (n) where element_id(n)= '0' return n
character_length |  size |  获取字符串长度 |  return character_length('abc')
path_length |  length |  获取路径长度 |  match p=TRAIL (n)--{1,2}(m) where id(n)='0' return path_length(p)
  2. 支持下列表达式：
**表7** GQL支持的表达式

| 表达式名 | 释义 | 示例 |
---|---|---
|| |  支持列表之间的拼接和字符串之间的拼接 |  return 'abc'||'de', [1,2]||[3,4]
  3. 支持GQL风格的类型判断表达式（Value Type Predicate），具体如下：
**表8** GQL支持的判断表达式

| 类型类别 | 类型关键字 | 示例 |
---|---|---
基础类型判断 |  Boolean, string, int, long, float,double, datetime,node,edge,path,list,record |  let a=1 return a is ::int
嵌套类型判断 |  list |  let a=[1,2] return a is ::list<int>
联合类型 |  any 注意：any<int|string|long>表示某类型属于int,string,long其中一种 |  for a in [1,2,'a1'] return a is ::any<int|string|long>
![](https://support.huaweicloud.com/intl/zh-cn/api-ges/public_sys-resources/note_3.0-zh-cn.png)
暂不支持mod以及三角函数。

#### 索引支持
目前GQL支持使用hasLabel=true的点索引，支持索引的单值匹配和多值匹配，索引创建和编辑相关的文档，请参考[索引操作API](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0483.html)。
举例说明：
索引类型 |  是否有label |  索引属性 |  备注
---|---|---|---
GlobalCompositeVertexIndex |  true |  movieid |  单属性索引
GlobalCompositeVertexIndex |  true |  movieid, title |  多属性索引
以上表中索引为例，下列查询可以使用到索引：
类型 |  匹配方式 |  例句
---|---|---
单属性索引 |  精确匹配-单值 |  match (n:movie) where n.movieid = 0 return n
精确匹配-多值 |  match (n:movie) where n.movieid in [0, 1, 2] return n
范围匹配 |  match (n:movie) where n.movieid > 0 return n
match (n:movie) where n.movieid >= 0 return n
match (n:movie) where n.movieid < 0 return n
match (n:movie) where n.movieid <= 0 return n
多值索引 |  精确匹配 |  match (n:movie) where n.movieid = 0 and n.title='' return n
对使用了索引的查询语句，进行explain或者profile时，会打印NodeIndexSeek算子，表示利用索引进行了查询。
