# 日历与颜色基础 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让运营后台能够按日期生成、查看并核对公历、农历、年月日干支、日支五行和首选/次选/不建议颜色。

**Architecture:** 使用 `lunar-javascript@1.7.7` 负责农历和干支计算，在 `adminApi` 内增加一个不依赖数据库的纯规则模块；管理接口只负责鉴权、落库和审计。全局日历结果写入独立的 `dailyCalendarRecommendations`，不与后续按城市生成的天气穿搭快照混在一起。

**Tech Stack:** Node.js CommonJS、`lunar-javascript@1.7.7`、CloudBase NoSQL、Vue 3、Element Plus、Node.js 内置 `node:test`。

## Global Constraints

- 日期业务主键固定为服务端校验后的 `YYYY-MM-DD`。
- 日历和颜色只使用日期，不读取用户资料或城市天气。
- 日支映射：子亥水、辰戌丑未土、寅卯木、巳午火、申酉金。
- 首选为天时所生五行，次选为同五行，不建议为天时所克五行。
- “我生天”和“我克天”不展示。
- V1 规则代码固定并记录 `ruleVersion`，后台不允许执行任意脚本。
- 本计划不修改小程序、不接天气、不匹配穿搭、不建设标签字典。
- 不提交工作区已有的 `小程序流程.pptx` 删除记录。

---

## File Map

- Create: `cloudfunctions/adminApi/calendar-rules.js` — 日期解析、农历干支和五行颜色纯函数。
- Create: `cloudfunctions/adminApi/test/calendar-rules.test.js` — 已知日期和非法输入测试。
- Create: `cloudfunctions/adminApi/test/calendar-api-source.test.js` — 管理接口路由和独立集合契约测试。
- Modify: `cloudfunctions/adminApi/package.json` — 锁定农历依赖和测试命令。
- Create: `cloudfunctions/adminApi/package-lock.json` — 云端安装可复现依赖。
- Modify: `cloudfunctions/adminApi/index.js` — 增加基础日历结果的列表和批量生成接口。
- Modify: `admin-web/src/types/domain.ts` — 增加日历、颜色建议和基础结果类型。
- Modify: `admin-web/src/services/demo-api.ts` — 支持演示模式列表和生成动作。
- Create: `admin-web/src/pages/CalendarRecommendationsPage.vue` — 基础日历结果页面。
- Modify: `admin-web/src/router/index.ts` — 增加 `/calendar-recommendations` 路由。
- Modify: `admin-web/src/layout/AdminLayout.vue` — 增加“日历与颜色”菜单。
- Create: `admin-web/tests/calendar-recommendations.test.mjs` — 页面和接口动作契约测试。
- Modify: `admin-web/package.json` — 将新测试纳入默认测试命令。
- Modify: `docs/ADMIN_IMPLEMENTATION_CHECKLIST.md` — 记录集合、索引、部署与验收结果。

---

### Task 1: 日历与五行纯规则模块

**Files:**

- Create: `cloudfunctions/adminApi/calendar-rules.js`
- Create: `cloudfunctions/adminApi/test/calendar-rules.test.js`
- Modify: `cloudfunctions/adminApi/package.json`
- Create: `cloudfunctions/adminApi/package-lock.json`

**Interfaces:**

- Produces: `buildCalendar(date: string): CalendarInfo`
- Produces: `buildColorAdvice(dayElement: Element): ColorAdvice`
- Produces: `buildCalendarRecommendation(date: string, ruleVersion: string): CalendarRecommendationDraft`
- Produces: `buildDateRange(startDate: string, endDate: string): string[]`

- [ ] **Step 1: 添加失败测试**

Create `cloudfunctions/adminApi/test/calendar-rules.test.js`:

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildCalendar,
  buildColorAdvice,
  buildCalendarRecommendation,
  buildDateRange
} = require('../calendar-rules')

test('2026-04-15 与原型标注的农历和干支一致', () => {
  const result = buildCalendar('2026-04-15')

  assert.equal(result.gregorianDate, '2026-04-15')
  assert.equal(result.weekText, '星期三')
  assert.equal(result.lunarText, '二月廿八')
  assert.equal(result.yearGanZhi, '丙午')
  assert.equal(result.monthGanZhi, '壬辰')
  assert.equal(result.dayGanZhi, '己未')
  assert.equal(result.dayBranch, '未')
  assert.equal(result.dayElement, '土')
})

test('甲戌日按土生金、土同土、土克水生成三档颜色', () => {
  const calendar = buildCalendar('2026-06-29')
  const advice = buildColorAdvice(calendar.dayElement)

  assert.equal(calendar.dayGanZhi, '甲戌')
  assert.equal(calendar.dayBranch, '戌')
  assert.deepEqual(advice.primary, {
    element: '金',
    colors: ['白', '银', '浅灰', '金属色']
  })
  assert.deepEqual(advice.secondary, {
    element: '土',
    colors: ['黄', '棕', '咖', '驼', '杏', '褐']
  })
  assert.deepEqual(advice.avoid, {
    element: '水',
    colors: ['黑', '蓝', '深灰']
  })
})

test('基础结果包含规则版本且只生成日历与颜色', () => {
  const result = buildCalendarRecommendation('2026-06-29', '2026.1')

  assert.equal(result.date, '2026-06-29')
  assert.equal(result.ruleVersion, '2026.1')
  assert.equal(result.calendar.dayElement, '土')
  assert.equal(result.colorAdvice.primary.element, '金')
  assert.equal(result.status, 'draft')
})

test('拒绝不存在的日期和非标准日期格式', () => {
  assert.throws(() => buildCalendar('2026-02-30'), /日期格式或日期值不正确/)
  assert.throws(() => buildCalendar('2026/06/29'), /日期格式或日期值不正确/)
  assert.throws(
    () => buildCalendarRecommendation('2026-06-29', ''),
    /规则版本不能为空/
  )
})

test('日期范围不会因东八区转 UTC 而提前一天', () => {
  assert.deepEqual(
    buildDateRange('2026-06-29', '2026-07-01'),
    ['2026-06-29', '2026-06-30', '2026-07-01']
  )
  assert.throws(
    () => buildDateRange('2026-07-01', '2026-06-29'),
    /日期范围不正确/
  )
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test cloudfunctions/adminApi/test/calendar-rules.test.js
```

Expected: FAIL，提示找不到 `../calendar-rules`。

- [ ] **Step 3: 锁定依赖和测试命令**

将 `cloudfunctions/adminApi/package.json` 改为：

```json
{
  "name": "adminApi",
  "version": "1.0.0",
  "description": "灵序穿搭Web运营后台统一管理接口",
  "main": "index.js",
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "@cloudbase/node-sdk": "^2.11.0",
    "lunar-javascript": "1.7.7"
  }
}
```

Run:

```powershell
npm install --prefix cloudfunctions/adminApi
```

Expected: 生成或更新 `cloudfunctions/adminApi/package-lock.json`，安装 `lunar-javascript@1.7.7`。

- [ ] **Step 4: 实现最小纯规则模块**

Create `cloudfunctions/adminApi/calendar-rules.js`:

```js
const { Solar } = require('lunar-javascript')

const BRANCH_ELEMENT = Object.freeze({
  子: '水',
  亥: '水',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土',
  寅: '木',
  卯: '木',
  巳: '火',
  午: '火',
  申: '金',
  酉: '金'
})

const ELEMENT_COLORS = Object.freeze({
  木: ['绿', '青'],
  火: ['红', '粉', '紫', '橙'],
  土: ['黄', '棕', '咖', '驼', '杏', '褐'],
  金: ['白', '银', '浅灰', '金属色'],
  水: ['黑', '蓝', '深灰']
})

const GENERATES = Object.freeze({
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木'
})

const CONTROLS = Object.freeze({
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木'
})

function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error('日期格式或日期值不正确')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error('日期格式或日期值不正确')
  }
  return { year, month, day }
}

function buildCalendar(date) {
  const { year, month, day } = parseDate(date)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const dayBranch = lunar.getDayZhi()
  const dayElement = BRANCH_ELEMENT[dayBranch]

  if (!dayElement) throw new Error(`不支持的日支：${dayBranch}`)

  return {
    gregorianDate: date,
    weekText: `星期${solar.getWeekInChinese()}`,
    lunarYear: lunar.getYear(),
    lunarText: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    dayBranch,
    dayElement
  }
}

function buildColorAdvice(dayElement) {
  if (!ELEMENT_COLORS[dayElement]) throw new Error(`不支持的五行：${dayElement}`)

  const primaryElement = GENERATES[dayElement]
  const avoidElement = CONTROLS[dayElement]
  return {
    primary: {
      element: primaryElement,
      colors: [...ELEMENT_COLORS[primaryElement]]
    },
    secondary: {
      element: dayElement,
      colors: [...ELEMENT_COLORS[dayElement]]
    },
    avoid: {
      element: avoidElement,
      colors: [...ELEMENT_COLORS[avoidElement]]
    }
  }
}

function buildCalendarRecommendation(date, ruleVersion) {
  if (!String(ruleVersion || '').trim()) throw new Error('规则版本不能为空')
  const calendar = buildCalendar(date)
  return {
    date,
    calendar,
    colorAdvice: buildColorAdvice(calendar.dayElement),
    ruleVersion: String(ruleVersion).trim(),
    generationMode: 'algorithm',
    manualOverride: false,
    status: 'draft'
  }
}

function formatUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function buildDateRange(startDate, endDate) {
  const startParts = parseDate(startDate)
  const endParts = parseDate(endDate)
  const start = Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  const end = Date.UTC(endParts.year, endParts.month - 1, endParts.day)

  if (start > end) throw new Error('日期范围不正确')

  const dates = []
  for (let time = start; time <= end; time += 86400000) {
    if (dates.length >= 31) throw new Error('单次最多生成31天')
    dates.push(formatUtcDate(new Date(time)))
  }
  return dates
}

module.exports = {
  BRANCH_ELEMENT,
  ELEMENT_COLORS,
  buildCalendar,
  buildColorAdvice,
  buildCalendarRecommendation,
  buildDateRange
}
```

- [ ] **Step 5: 运行规则测试**

Run:

```powershell
npm test --prefix cloudfunctions/adminApi
```

Expected: 5 tests PASS。

- [ ] **Step 6: 提交规则模块**

```powershell
git add cloudfunctions/adminApi/package.json cloudfunctions/adminApi/package-lock.json cloudfunctions/adminApi/calendar-rules.js cloudfunctions/adminApi/test/calendar-rules.test.js
git commit -m "feat: add calendar and five-element rules"
```

---

### Task 2: 基础日历结果管理接口

**Files:**

- Create: `cloudfunctions/adminApi/test/calendar-api-source.test.js`
- Modify: `cloudfunctions/adminApi/index.js`

**Interfaces:**

- Consumes: `buildCalendarRecommendation(date, ruleVersion)`
- Produces: `calendarRecommendations.list`
- Produces: `calendarRecommendations.get`
- Produces: `calendarRecommendations.generate({ startDate, endDate, ruleVersion })`
- Persists: `dailyCalendarRecommendations`

- [ ] **Step 1: 添加失败的路由契约测试**

Create `cloudfunctions/adminApi/test/calendar-api-source.test.js`:

```js
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')

test('基础日历使用独立集合和独立管理动作', () => {
  assert.match(
    source,
    /calendarRecommendations:\s*'dailyCalendarRecommendations'/
  )
  assert.match(source, /'calendarRecommendations\.list'/)
  assert.match(source, /'calendarRecommendations\.get'/)
  assert.match(source, /'calendarRecommendations\.generate'/)
  assert.match(source, /buildCalendarRecommendation/)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test --prefix cloudfunctions/adminApi
```

Expected: 新增测试 FAIL，缺少 `calendarRecommendations` 动作。

- [ ] **Step 3: 增加权限、集合映射和依赖**

在 `cloudfunctions/adminApi/index.js` 顶部加入：

```js
const {
  buildCalendarRecommendation,
  buildDateRange
} = require('./calendar-rules')
```

在 `ACTION_PERMISSIONS` 中加入：

```js
'calendarRecommendations.list': 'recommendations.read',
'calendarRecommendations.get': 'recommendations.read',
'calendarRecommendations.generate': 'recommendations.write',
```

在 `COLLECTION_MAP` 中加入：

```js
calendarRecommendations: 'dailyCalendarRecommendations',
```

删除 `index.js` 中现有的 `dateRange()`，并将两处调用统一改为：

```js
const dates = buildDateRange(payload.startDate, payload.endDate)
```

这同时修复现有实现把东八区午夜转成 UTC 后日期提前一天的问题。

- [ ] **Step 4: 实现批量生成**

在现有 `generateRecommendations` 前增加：

```js
async function generateCalendarRecommendations(payload, admin, requestId) {
  const dates = buildDateRange(payload.startDate, payload.endDate)
  const ruleVersion = requiredString(payload.ruleVersion, '规则版本', 30)
  let generated = 0
  let skipped = 0

  for (const date of dates) {
    const existing = await db.collection('dailyCalendarRecommendations').where({
      date,
      isDeleted: command.neq(true)
    }).limit(1).get()

    if (existing.data.length) {
      skipped += 1
      continue
    }

    const draft = buildCalendarRecommendation(date, ruleVersion)
    await db.collection('dailyCalendarRecommendations').add({
      data: {
        ...draft,
        version: 1,
        createdAt: db.serverDate(),
        createdBy: admin.uid,
        updatedAt: db.serverDate(),
        updatedBy: admin.uid,
        isDeleted: false,
        deletedAt: null
      }
    })
    generated += 1
  }

  await writeAudit(
    admin,
    'generate',
    'dailyCalendarRecommendations',
    '',
    `${payload.startDate}~${payload.endDate}, generated=${generated}`,
    requestId
  )
  return { generated, skipped }
}
```

在 `route()` 中、现有 `recommendations.generate` 分支之前加入：

```js
if (action === 'calendarRecommendations.generate') {
  return generateCalendarRecommendations(payload, admin, requestId)
}
```

`list` 和 `get` 继续复用现有 `COLLECTION_MAP` 通用路由，不增加新的分页实现。

- [ ] **Step 5: 运行云函数测试**

Run:

```powershell
npm test --prefix cloudfunctions/adminApi
```

Expected: 所有测试 PASS。

- [ ] **Step 6: 提交接口**

```powershell
git add cloudfunctions/adminApi/index.js cloudfunctions/adminApi/test/calendar-api-source.test.js
git commit -m "feat: add calendar recommendation admin api"
```

---

### Task 3: 后台类型与演示数据

**Files:**

- Modify: `admin-web/src/types/domain.ts`
- Modify: `admin-web/src/services/demo-api.ts`
- Create: `admin-web/tests/calendar-recommendations.test.mjs`
- Modify: `admin-web/package.json`

**Interfaces:**

- Consumes: `calendarRecommendations.list/generate`
- Produces: `CalendarRecommendation` TypeScript 类型

- [ ] **Step 1: 添加失败的后台契约测试**

Create `admin-web/tests/calendar-recommendations.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const domainTypes = read('../src/types/domain.ts')
const demoApi = read('../src/services/demo-api.ts')

test('后台定义基础日历结果类型', () => {
  assert.match(domainTypes, /export interface CalendarRecommendation/)
  assert.match(domainTypes, /dayElement: ElementCode/)
  assert.match(domainTypes, /primary: ColorAdviceLevel/)
})

test('演示接口支持基础日历列表和生成', () => {
  assert.match(demoApi, /calendarRecommendations\.list/)
  assert.match(demoApi, /calendarRecommendations\.generate/)
})
```

在 `admin-web/package.json` 的 `test` 脚本末尾加入新文件：

```json
"test": "node --test tests/login-page.test.mjs tests/auth-flow.test.mjs tests/data-compat.test.mjs tests/calendar-recommendations.test.mjs"
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test --prefix admin-web
```

Expected: 新增的 2 个测试 FAIL。

- [ ] **Step 3: 增加精确类型**

在 `admin-web/src/types/domain.ts` 中加入：

```ts
export type ElementCode = '木' | '火' | '土' | '金' | '水'

export interface ColorAdviceLevel {
  element: ElementCode
  colors: string[]
}

export interface CalendarInfo {
  gregorianDate: string
  weekText: string
  lunarYear: number
  lunarText: string
  yearGanZhi: string
  monthGanZhi: string
  dayGanZhi: string
  dayBranch: string
  dayElement: ElementCode
}

export interface CalendarRecommendation {
  _id?: string
  date: string
  calendar: CalendarInfo
  colorAdvice: {
    primary: ColorAdviceLevel
    secondary: ColorAdviceLevel
    avoid: ColorAdviceLevel
  }
  ruleVersion: string
  generationMode: 'algorithm'
  manualOverride: boolean
  status: PublishStatus
  version?: number
  updatedAt?: string
}
```

- [ ] **Step 4: 增加演示数据和动作**

在 `admin-web/src/services/demo-api.ts` 的类型导入中加入 `CalendarRecommendation`，并在 `recommendations` 常量后加入：

```ts
const calendarRecommendations: CalendarRecommendation[] = [
  {
    _id: 'demo-calendar-2026-04-15',
    date: '2026-04-15',
    calendar: {
      gregorianDate: '2026-04-15',
      weekText: '星期三',
      lunarYear: 2026,
      lunarText: '二月廿八',
      yearGanZhi: '丙午',
      monthGanZhi: '壬辰',
      dayGanZhi: '己未',
      dayBranch: '未',
      dayElement: '土'
    },
    colorAdvice: {
      primary: { element: '金', colors: ['白', '银', '浅灰', '金属色'] },
      secondary: { element: '土', colors: ['黄', '棕', '咖', '驼', '杏', '褐'] },
      avoid: { element: '水', colors: ['黑', '蓝', '深灰'] }
    },
    ruleVersion: '2026.1',
    generationMode: 'algorithm',
    manualOverride: false,
    status: 'draft',
    version: 1
  }
]
```

在 `callDemoAction` 中加入：

```ts
if (action === 'calendarRecommendations.list') {
  return paginate(calendarRecommendations, payload)
}
if (action === 'calendarRecommendations.generate') {
  return { generated: 0, skipped: calendarRecommendations.length }
}
```

- [ ] **Step 5: 运行测试、类型检查**

Run:

```powershell
npm test --prefix admin-web
npm run typecheck --prefix admin-web
```

Expected: 所有测试 PASS，`vue-tsc` 退出码为 0。

- [ ] **Step 6: 提交类型和演示接口**

```powershell
git add admin-web/package.json admin-web/src/types/domain.ts admin-web/src/services/demo-api.ts admin-web/tests/calendar-recommendations.test.mjs
git commit -m "feat: add calendar recommendation admin types"
```

---

### Task 4: 日历与颜色后台页面

**Files:**

- Create: `admin-web/src/pages/CalendarRecommendationsPage.vue`
- Modify: `admin-web/src/router/index.ts`
- Modify: `admin-web/src/layout/AdminLayout.vue`
- Modify: `admin-web/tests/calendar-recommendations.test.mjs`

**Interfaces:**

- Consumes: `calendarRecommendations.list`
- Consumes: `calendarRecommendations.generate`
- Displays: 公历、农历、年月日干支、日支五行和三档颜色。

- [ ] **Step 1: 扩充失败的页面契约测试**

在 `admin-web/tests/calendar-recommendations.test.mjs` 中加入：

```js
const page = read('../src/pages/CalendarRecommendationsPage.vue')
const router = read('../src/router/index.ts')
const layout = read('../src/layout/AdminLayout.vue')

test('日历与颜色页面展示核心结果并调用独立接口', () => {
  assert.match(page, /calendarRecommendations\.list/)
  assert.match(page, /calendarRecommendations\.generate/)
  assert.match(page, /农历/)
  assert.match(page, /日支五行/)
  assert.match(page, /首选颜色/)
  assert.match(page, /次选颜色/)
  assert.match(page, /不建议色/)
})

test('后台注册日历与颜色路由和菜单', () => {
  assert.match(router, /calendar-recommendations/)
  assert.match(layout, /日历与颜色/)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
npm test --prefix admin-web
```

Expected: 新增页面测试 FAIL，页面文件不存在。

- [ ] **Step 3: 创建页面**

Create `admin-web/src/pages/CalendarRecommendationsPage.vue`:

```vue
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { CalendarRecommendation } from '@/types/domain'

const loading = ref(false)
const generating = ref(false)
const list = ref<CalendarRecommendation[]>([])
const total = ref(0)
const generateVisible = ref(false)
const generateRange = ref<[string, string] | null>(null)
const ruleVersion = ref('2026.1')
const query = reactive({ page: 1, pageSize: 20 })

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<CalendarRecommendation>>(
      'calendarRecommendations.list',
      query
    )
    list.value = data.list
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '日历与颜色加载失败')
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!generateRange.value) {
    ElMessage.warning('请选择生成日期范围')
    return
  }
  generating.value = true
  try {
    const result = await callAdminApi<{ generated: number; skipped: number }>(
      'calendarRecommendations.generate',
      {
        startDate: generateRange.value[0],
        endDate: generateRange.value[1],
        ruleVersion: ruleVersion.value
      }
    )
    ElMessage.success(`生成${result.generated}天，跳过${result.skipped}天`)
    generateVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Calendar & colors"
    title="日历与颜色"
    description="先核对农历、干支和五行颜色，再由后续推荐流程叠加城市天气与穿搭。"
  >
    <el-button :icon="Refresh" @click="load">刷新</el-button>
    <el-button type="primary" :icon="MagicStick" @click="generateVisible = true">
      批量生成
    </el-button>
  </PageHeader>

  <section class="surface">
    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
        <el-table-column prop="date" label="公历" width="120" />
        <el-table-column label="农历" min-width="120">
          <template #default="{ row }">{{ row.calendar.lunarText }}</template>
        </el-table-column>
        <el-table-column label="干支" min-width="190">
          <template #default="{ row }">
            {{ row.calendar.yearGanZhi }}年
            {{ row.calendar.monthGanZhi }}月
            {{ row.calendar.dayGanZhi }}日
          </template>
        </el-table-column>
        <el-table-column label="日支五行" width="100">
          <template #default="{ row }">
            {{ row.calendar.dayBranch }} · {{ row.calendar.dayElement }}
          </template>
        </el-table-column>
        <el-table-column label="首选颜色" min-width="170">
          <template #default="{ row }">
            {{ row.colorAdvice.primary.element }}：
            {{ row.colorAdvice.primary.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column label="次选颜色" min-width="170">
          <template #default="{ row }">
            {{ row.colorAdvice.secondary.element }}：
            {{ row.colorAdvice.secondary.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column label="不建议色" min-width="150">
          <template #default="{ row }">
            {{ row.colorAdvice.avoid.element }}：
            {{ row.colorAdvice.avoid.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column prop="ruleVersion" label="规则版本" width="100" />
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="query.pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>
  </section>

  <el-dialog v-model="generateVisible" title="生成日历与颜色" width="480px">
    <el-form label-position="top">
      <el-form-item label="日期范围">
        <el-date-picker
          v-model="generateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="规则版本">
        <el-input v-model="ruleVersion" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="generateVisible = false">取消</el-button>
      <el-button type="primary" :loading="generating" @click="generate">
        开始生成
      </el-button>
    </template>
  </el-dialog>
</template>
```

- [ ] **Step 4: 注册路由和菜单**

在 `admin-web/src/router/index.ts` 的后台子路由中、`recommendations` 前加入：

```ts
{
  path: 'calendar-recommendations',
  name: 'calendar-recommendations',
  component: () => import('@/pages/CalendarRecommendationsPage.vue')
},
```

在 `admin-web/src/layout/AdminLayout.vue` 的 `menuItems` 中、每日建议前加入：

```ts
{ path: '/calendar-recommendations', label: '日历与颜色', icon: Calendar },
```

- [ ] **Step 5: 运行测试、类型检查和构建**

Run:

```powershell
npm test --prefix admin-web
npm run typecheck --prefix admin-web
npm run build --prefix admin-web
```

Expected: 所有测试 PASS；类型检查和生产构建退出码均为 0。

- [ ] **Step 6: 提交页面**

```powershell
git add admin-web/src/pages/CalendarRecommendationsPage.vue admin-web/src/router/index.ts admin-web/src/layout/AdminLayout.vue admin-web/tests/calendar-recommendations.test.mjs
git commit -m "feat: add calendar color admin page"
```

---

### Task 5: 全量回归、数据库索引与部署交接

**Files:**

- Modify: `docs/ADMIN_IMPLEMENTATION_CHECKLIST.md`

**Interfaces:**

- Database: `dailyCalendarRecommendations`
- Unique index: `date`
- Deployment: `cloudfunctions/adminApi`、`admin-web`

- [ ] **Step 1: 运行全量本地检查**

Run:

```powershell
npm test
npm test --prefix cloudfunctions/adminApi
npm test --prefix admin-web
npm run typecheck --prefix admin-web
npm run build --prefix admin-web
git diff --check
```

Expected:

- 小程序现有测试全部 PASS。
- `adminApi` 日历规则和路由测试全部 PASS。
- `admin-web` 测试全部 PASS。
- 类型检查与构建退出码为 0。
- `git diff --check` 无输出。

- [ ] **Step 2: 更新实施检查清单**

在 `docs/ADMIN_IMPLEMENTATION_CHECKLIST.md` 增加：

```markdown
## 日历与颜色基础

- [x] `lunar-javascript@1.7.7` 锁定并通过已知日期测试
- [x] `dailyCalendarRecommendations` 使用独立集合
- [x] 后台可生成和查看农历、干支、日支五行及三档颜色
- [ ] CloudBase 已创建 `dailyCalendarRecommendations.date` 唯一索引
- [ ] `adminApi` 已重新上传并选择云端安装依赖
- [ ] `admin-web` 已重新发布
- [ ] 2026-04-15 与 2026-06-29 已在生产环境人工复核
```

- [ ] **Step 3: 提交检查清单**

```powershell
git add docs/ADMIN_IMPLEMENTATION_CHECKLIST.md
git commit -m "docs: add calendar color deployment checklist"
```

- [ ] **Step 4: 创建 CloudBase 唯一索引**

在 CloudBase 控制台执行：

1. 创建或打开集合 `dailyCalendarRecommendations`。
2. 新建唯一索引，字段为 `date`，升序。
3. 确认索引状态为“正常”后再生成数据。

Expected: 同一日期无法插入第二条基础结果。

- [ ] **Step 5: 部署云函数**

在微信开发者工具中：

1. 右键 `cloudfunctions/adminApi`。
2. 选择“上传并部署：云端安装依赖”。
3. 调用 `calendarRecommendations.generate` 生成 `2026-04-15` 和 `2026-06-29`。
4. 检查返回 `success: true`，数据库各新增一条记录。

- [ ] **Step 6: 发布并验证 admin-web**

Run:

```powershell
npm run build --prefix admin-web
```

将 `admin-web/dist` 发布到现有 CloudBase 静态托管，随后验证：

1. “日历与颜色”菜单可进入。
2. 2026-04-15 显示“二月廿八、丙午年、壬辰月、己未日、未土”。
3. 2026-06-29 显示“甲戌日、戌土”，首选金、次选土、不建议水。
4. 重复生成同一日期时返回 `skipped`，不产生重复数据。

- [ ] **Step 7: 最终状态检查**

Run:

```powershell
git status --short
git log -5 --oneline
```

Expected: 只保留用户原有的 `小程序流程.pptx` 删除记录；本计划产生 5 个边界清晰的提交。
