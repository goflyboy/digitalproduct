# GQL兼容性

> 章节路径：持久化版 / GQL查询语言API / GQL兼容性
> 来源：https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0569.html

## GQL兼容性
GQL标准请参考ISO发布的[GQL文档](https://www.iso.org/standard/76120.html)。GES对GQL的最小化支持（GQL minimum conformance）如下所示：
  1. 支持特性GG02“Graph with a closed graph type”以及GG20“Explicit element type names”。
  2. 支持Unicode 13。
  3. 支持基础数据类型，包括：STRING，BOOLEAN，INT，FLOAT。
  4. 支持一系列特性，详见支持的特性清单。

#### 支持的特性清单
GES目前支持的GQL特性清单如下：
章节名 |  小节 |  语法名/特性名 |  关联编号 |  操作示例
---|---|---|---|---
9 Procedure specification |  9.1 |  <next statement> |  GQ20 |  match (n:user) return n union all match (n:movie) return n next yield n as b match (b)-->(m) return m
13 Data-modifying statements(仅持久化版支持) |  13.2 |  <insert statement> |  - |  insert (n:movie{_ID_:'1a', genres: 'Comedy|Drama'}) return n
13.3 |  <set statement> |  GD02 |  match (n) where element_id(n) = '1a' set n.movieid=1 return n
13.4 |  <remove statement> |  GD02 |  match (n) where element_id(n) = '1a' remove n.movieid return n
13.5 |  <delete statement> |  - |  match (n) where element_id(n) = '1a' delete n
14 Query statement |  14.2 |  union |  GQ03 |  return 1 as a union return 2 as a
14.4 |  <simple match statement> |  - |  match (n) return n
<optional match statement> |  - |  match (n) where id(n)= '1a' optional match （n)-->(m) return count(*)
14.6 |  <filter statement> |  GQ08 |  match (n) where element_id(n) = '1a' return n
14.7 |  <let statement> |  GQ09 |  let a=1, value b::long=2 return a,b
14.8 |  <for statement> |  GQ10 |  for a in [1,2,3] return a
14.11 |  <return statement> |  - |  match (n) return n.name as name, n.age
15 Procedure calling |  15.3 |  <named procedure call> |  GP04 |  call db.schema()
16 Comment elements |  16.4 |  <graph pattern> |  G004 |  参见[模式匹配](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0564.html#ges_03_0564__section1951675271317)章节。
16.5 |  <insert graph pattern> |  - |  insert (n:movie{_ID_:'1a', genres: 'Comedy|Drama'}) return n
16.7 |  <quantified path primary> |  G036 |  match p=(n)-[r]->{1,3}(m) where element_id(n)= 'xx' return p
Non-local element pattern predicates |  G041 |  let a = 'Jaws (1975) ' match (n:movie where n.title=a) return n
<full edge pattern> |  G043 |  match (n),(m) where element_id(n)= '100' and element_id(m)= '120' optional match (n)-[r]->(m) with n,r,m optional match (n)-[r1]-(m) with n,r,r1,m optional match (n)<-[r2]-(m) return r,r1,r2
16.8 |  <label expression> |  - |  match (n:movie) return count(*)
<label disjunction> |  - |  match (n:movie|user) return n limit 10
<label negation> |  - |  match (n:!movie) return count(*)
<parenthesized label expression> |  - |  match (n:(!movie&!default)|user) return count(*)
16.11 |  <fixed quantifier> |  - |  参见[模式匹配](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0564.html#ges_03_0564__section1951675271317)章节的“可变长度路径”。
<general quantifier> |  - |  match p=(n)-[r]->{,3}(m) where element_id(n)= 'xx' return p
16.13 |  <where clause> |  - |  参考14.4和14.6
16.16 |  <order by clause> |  - |  match (n:movie) return n order by n.genres asc
16.18 |  <limit clause> |  GQ13 |  match (n:movie) return n skip 10 limit 10
16.19 |  <offset clause> |  GQ12
19 Predicate |  19.3 |  <comparison predicate> |  - |  let a=1,b=2 return a=b,a<>b,a<b,a>b,a<=b,a>=b
19.5 |  <null predicate> |  - |  let value a::long=1 return a is null
19.9 |  <label predicate> |  G111 |  match (n) where element_id(n)= '0' return n:movie
20 Value expressions and specifications |  20.4 |  <dynamic parameter specification> |  - |  参见[Cypher基本操作和兼容性](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0476.html)和[参数化查询支持](https://support.huaweicloud.com/intl/zh-cn/api-ges/ges_03_0476.html#ges_03_0476__li8383195704410)。
20.7 |  <simple case> |  - |  let a =2 return case a when 1 then a+1 else a+2 end
<searched case> |  - |  let a =2 return case when a=1 then a+1 else a+2 end
20.9 |  Hrizontal Aggregation |  GE09 |  match (n) return labels(n),count(distinct n),avg(n.age), max(n.age),min(n.age),sum(n.age)
20.10 |  <element_id function> |  G100 |  match (n) where element_id(n) = '1a' return n
20.11 |  <property reference> |  - |  match (n) where element_id(n) = '1a' return n.movieid
record property |  - |  return {name: 'Jay',age:1}.name
20.15 |  <list concatenation> |  - |  return [1,2,3,4]||[5,6,7,8]
20.17 |  <list value constructor> |  - |  return [1,2,3,4]
20.18 |  <record constructor> |  GV45 |  return {name: 'Jay', age:10, details:{salary:1}}
20.20 |  <boolean value expression> |  - |  return (true and false) or false
Boolean Xor |  GE07 |  return true xor false
20.21 |  <numeric value expression> |  - |  return 1+2,1-2,1*2,1/2,-2
20.22 |  <char length expression> |  - |  let value s::STRING = 'hello_world' return character_length(s)
<path length expression> |  GF04 |  match p=TRAIL (n)--{1,2}(m) where id(n)= '0' return path_length(p)
size function |  GF13 |  let list = [1,2,3,4] return size(list)
#### 支持的GQL可选特性清单
对于可选的GQL特性，GQL标准提供了特性ID和特性名称，目前GES支持的特性如下。
特性编号 |  特性名称
---|---
G004 |  Path variables
G011 |  Advanced path modes: TRAIL
G036 |  Quantified edges
G041 |  Non-local element pattern predicates
G043 |  Complete full edge patterns
G060 |  Bounded graph pattern quantifiers
G100 |  ELEMENT_ID function
G111 |  IS LABELED predicate
GD01 |  Updatable graphs
GD02 |  Graph label set changes
GE07 |  Boolean XOR
GE09 |  Horizontal aggregation
GF01 |  Enhanced numeric functions
GF02 |  Trigonometric functions
GF11 |  Advanced aggregate functions: binary set functions
GF13 |  SIZE function
GG02 |  Graph with a closed graph type
GG20 |  Explicit element type names
GP04 |  Named procedure calls
GQ03 |  Composite query: UNION
GQ08 |  Filter statement
GQ09 |  LET statement
GQ10 |  FOR statement: list value support
GQ12 |  ORDER BY and page statement: OFFSET clause
GQ13 |  ORDER BY and page statement: LIMIT clause
GQ20 |  Advanced linear composition with NEXT
GV45 |  Record types
GV47 |  Open record type
GV48 |  Nested record types
GV50 |  List value types
GV55 |  Path value types
