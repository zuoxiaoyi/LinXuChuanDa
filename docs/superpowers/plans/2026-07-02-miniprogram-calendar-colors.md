# 小程序日历与五行颜色联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页从服务端获取连续7天的农历、干支和五行颜色，并在切换日期时同步展示。

**Architecture:** 复用 `adminApi/calendar-rules.js`，在管理员鉴权前增加一个受限的公开只读动作。小程序首页一次获取7天结果并与现有日期条合并，不复制算法、不新增依赖。

**Tech Stack:** 微信小程序、CloudBase 云函数、Node.js CommonJS、`lunar-javascript@1.7.7`、`node:test`

## Global Constraints

- 公开接口最多返回连续7天。
- 日期使用 `YYYY-MM-DD`，由现有日历规则模块严格校验。
- 城市和天气不参与五行颜色计算。
- 接口失败时不得继续展示伪随机颜色。
- 用户负责通过微信开发者工具上传云函数，Codex 不执行云端部署。
- 不处理工作区现有的 `小程序流程.pptx` 删除记录。

---

## File Map

- Modify: `cloudfunctions/adminApi/index.js` — 增加公开只读动作及鉴权前分流。
- Modify: `cloudfunctions/adminApi/test/calendar-api-source.test.js` — 锁定公开动作和安全边界。
- Create: `tests/miniprogram/calendar-colors.test.js` — 锁定首页调用与展示契约。
- Modify: `pages/index/index.js` — 获取、合并和切换日历颜色结果。
- Modify: `pages/index/index.wxml` — 展示农历、干支和动态颜色。
- Modify: `pages/index/index.wxss` — 补充农历信息排版。

---

### Task 1: `adminApi` 公开只读日历接口

**Files:**

- Modify: `cloudfunctions/adminApi/test/calendar-api-source.test.js`
- Modify: `cloudfunctions/adminApi/index.js`

**Interfaces:**

- Consumes: `{ action: 'calendarRecommendations.publicRange', payload: { startDate: string, days: number } }`
- Produces: `{ success: true, data: { days: CalendarRecommendation[] }, requestId: string }`

- [ ] **Step 1: 添加失败测试**

在 `calendar-api-source.test.js` 增加：

```js
test('公开日历动作在管理员鉴权前处理且最多返回7天', () => {
  assert.match(source, /'calendarRecommendations\.publicRange':\s*null/)
  assert.match(source, /action === 'calendarRecommendations\.publicRange'/)
  assert.match(source, /Math\.min\(7,\s*Math\.max\(1,/)
  assert.ok(
    source.indexOf("action === 'calendarRecommendations.publicRange'")
      < source.indexOf('const uid = resolveUid')
  )
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test --prefix cloudfunctions/adminApi
```

Expected: 新测试因缺少 `calendarRecommendations.publicRange` 而失败。

- [ ] **Step 3: 实现最小公开动作**

在 `ACTION_PERMISSIONS` 增加：

```js
'calendarRecommendations.publicRange': null,
```

增加纯计算函数：

```js
function publicCalendarRange(payload) {
  const startDate = requiredString(payload.startDate, '开始日期', 10)
  const days = Math.min(7, Math.max(1, Number.parseInt(payload.days, 10) || 7))
  const [year, month, day] = startDate.split('-').map(Number)
  const end = new Date(Date.UTC(year, month - 1, day + days - 1))
  const endDate = [
    end.getUTCFullYear(),
    String(end.getUTCMonth() + 1).padStart(2, '0'),
    String(end.getUTCDate()).padStart(2, '0')
  ].join('-')
  return {
    days: buildDateRange(startDate, endDate)
      .map(date => buildCalendarRecommendation(date, '2026.1'))
  }
}
```

在 `exports.main` 中、`resolveUid` 之前增加：

```js
if (action === 'calendarRecommendations.publicRange') {
  return success(publicCalendarRange(event.payload || {}), requestId)
}
```

- [ ] **Step 4: 运行云函数测试**

Run:

```powershell
npm test --prefix cloudfunctions/adminApi
node --check cloudfunctions/adminApi/index.js
```

Expected: 全部通过。

- [ ] **Step 5: 提交云函数改动**

```powershell
git add cloudfunctions/adminApi/index.js cloudfunctions/adminApi/test/calendar-api-source.test.js
git commit -m "feat: expose calendar color range"
```

---

### Task 2: 首页动态日历和颜色

**Files:**

- Create: `tests/miniprogram/calendar-colors.test.js`
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`

**Interfaces:**

- Calls: `wx.cloud.callFunction({ name: 'adminApi', data: { action: 'calendarRecommendations.publicRange', payload } })`
- Stores: each `dateList` item receives `date`, `calendar`, and `colorAdvice`
- Displays: `selectedDay.lunarText`, `selectedDay.ganZhiText`, and three color arrays

- [ ] **Step 1: 添加失败测试**

创建 `tests/miniprogram/calendar-colors.test.js`：

```js
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const pageJs = readFileSync(join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = readFileSync(join(root, 'pages/index/index.wxml'), 'utf8')

test('首页从 adminApi 获取7天日历和颜色', () => {
  assert.match(pageJs, /name:\s*'adminApi'/)
  assert.match(pageJs, /calendarRecommendations\.publicRange/)
  assert.match(pageJs, /loadCalendarColors/)
  assert.doesNotMatch(pageJs, /COLOR_RULES/)
})

test('首页展示农历干支和服务端颜色', () => {
  assert.match(pageWxml, /selectedDay\.lunarText/)
  assert.match(pageWxml, /selectedDay\.ganZhiText/)
  assert.match(pageWxml, /selectedDay\.primaryColors/)
  assert.match(pageWxml, /selectedDay\.secondaryColors/)
  assert.match(pageWxml, /selectedDay\.avoidColors/)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test
```

Expected: 新测试因仍存在 `COLOR_RULES`、缺少公开动作调用和农历展示而失败。

- [ ] **Step 3: 改造首页数据流**

在 `pages/index/index.js`：

- 删除 `COLOR_RULES`。
- `buildDateList()` 为每项生成本地时区稳定的 `date`。
- `onLoad()` 在初始化天气之外调用 `loadCalendarColors()`。
- `loadCalendarColors()` 一次请求7天，按 `date` 合并响应。
- `buildDayDetail(index)` 从对应日期条目读取：

```js
return {
  dateText: `${item.month}月${item.day}日`,
  weekText: item.calendar?.weekText || item.week.replace('周', '星期'),
  lunarText: item.calendar
    ? `${item.calendar.lunarYear}年 农历${item.calendar.lunarText}`
    : '农历加载中',
  ganZhiText: item.calendar
    ? `${item.calendar.yearGanZhi}年 ${item.calendar.monthGanZhi}月 ${item.calendar.dayGanZhi}日`
    : '',
  primaryColors: item.colorAdvice?.primary?.colors || [],
  secondaryColors: item.colorAdvice?.secondary?.colors || [],
  avoidColors: item.colorAdvice?.avoid?.colors || []
}
```

请求失败时设置 `lunarText: '农历加载失败'`，颜色保持空数组。

- [ ] **Step 4: 增加页面展示**

在日期标题内增加：

```xml
<view class="calendar-meta">
  <text class="lunar-text">{{selectedDay.lunarText}}</text>
  <text class="ganzhi-text" wx:if="{{selectedDay.ganZhiText}}">
    {{selectedDay.ganZhiText}}
  </text>
</view>
```

在 `index.wxss` 将 `.date-heading` 调整为居中布局，并为 `.calendar-meta`、`.lunar-text`、`.ganzhi-text` 增加紧凑的两行样式。

- [ ] **Step 5: 运行小程序测试**

Run:

```powershell
npm test
node --check pages/index/index.js
```

Expected: 全部通过。

- [ ] **Step 6: 提交首页改动**

```powershell
git add pages/index/index.js pages/index/index.wxml pages/index/index.wxss tests/miniprogram/calendar-colors.test.js
git commit -m "feat: show lunar calendar colors on home"
```

---

### Task 3: 全量验证与人工部署交接

**Files:**

- No production file changes.

- [ ] **Step 1: 运行全量检查**

```powershell
npm test
npm test --prefix cloudfunctions/adminApi
node --check pages/index/index.js
node --check cloudfunctions/adminApi/index.js
git diff --check
```

Expected: 全部退出码为0。

- [ ] **Step 2: 检查工作区**

```powershell
git status --short
git log -5 --oneline
```

Expected: 只保留用户原有的 `小程序流程.pptx` 删除记录。

- [ ] **Step 3: 用户手动上传并验收**

用户在微信开发者工具中：

1. 右键 `cloudfunctions/adminApi`。
2. 选择“上传并部署：云端安装依赖”。
3. 重新编译小程序。
4. 验证当天及未来两天的农历、干支、颜色会随日期变化。
5. 切换城市，确认天气变化而颜色不变。
