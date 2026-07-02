# 小程序日历与五行颜色联动设计

## 目标

首页连续展示从当天起7天的公历、农历、年月日干支、日支五行，以及由五行生克计算出的首选、次选和不建议颜色。切换日期时，日期标题和三档颜色同步变化；切换城市只更新天气。

## 架构

复用 `cloudfunctions/adminApi/calendar-rules.js` 中已经过测试的算法，不在小程序内复制另一套规则。

`adminApi` 增加只读公开动作 `calendarRecommendations.publicRange`。该动作在管理员鉴权前处理，只接受开始日期和1至7天的数量，调用现有 `buildDateRange()` 与 `buildCalendarRecommendation()` 返回结果，不读取或修改数据库，也不暴露其他后台能力。

小程序首页加载时并行请求天气和7天日历颜色。现有日期条目增加稳定的 `YYYY-MM-DD` 日期字段；日历响应按日期合并到条目中。选择日期时直接读取对应条目，不重复请求云函数。

## 返回数据

每一天返回：

- `date`
- `calendar.gregorianDate`
- `calendar.weekText`
- `calendar.lunarYear`
- `calendar.lunarText`
- `calendar.yearGanZhi`
- `calendar.monthGanZhi`
- `calendar.dayGanZhi`
- `calendar.dayBranch`
- `calendar.dayElement`
- `colorAdvice.primary`
- `colorAdvice.secondary`
- `colorAdvice.avoid`
- `ruleVersion`

首页标题展示公历月日、星期、农历日期，以及“年干支、月干支、日干支”。

## 失败处理

公历日期条和天气继续可用。农历区域显示“农历加载失败”，颜色列表留空，不再使用当前伪随机颜色，避免展示错误建议。用户重新进入首页时自动重试。

## 安全边界

- 公开动作仅允许最多7天的只读计算。
- 输入日期必须通过现有严格日期校验。
- 公开动作不接受集合名、查询条件、规则脚本或管理员信息。
- 其他 `adminApi` 动作继续执行管理员身份和权限校验。

## 测试与验收

- 云函数测试确认公开动作存在、无需管理员身份，并限制最多7天。
- 已知日期 `2026-06-29` 返回甲戌日、戌土、首选金、次选土、不建议水。
- 小程序测试确认删除伪随机 `COLOR_RULES`，调用公开动作并展示农历和三档动态颜色。
- 切换7天内任意已解锁日期，日期、农历、干支和颜色同步更新。
- 切换城市后颜色保持不变，天气正常更新。

## 本次不做

- 穿搭素材匹配、幸运配饰、广告解锁和下一周。
- 后台规则编辑。
- 新建独立日历云函数。
