const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')

test('公开日历动作在管理员鉴权前处理且最多返回7天', () => {
  assert.match(source, /'calendarRecommendations\.publicRange':\s*null/)
  assert.match(source, /action === 'calendarRecommendations\.publicRange'/)
  assert.match(source, /Math\.min\(7,\s*Math\.max\(1,/)
  assert.ok(
    source.indexOf("action === 'calendarRecommendations.publicRange'")
      < source.indexOf('const uid = resolveUid')
  )
})

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

test('两个生成入口通过共享映射返回日期范围校验错误', () => {
  assert.equal(
    source.match(
      /const dates = validatedDateRange\(payload\.startDate, payload\.endDate\)/g
    )?.length,
    2
  )
  assert.match(
    source,
    /throw new ApiError\('VALIDATION_ERROR', error\.message\)/
  )
})

test('日历建议按 Node SDK 约定直接写入文档字段', () => {
  assert.match(
    source,
    /db\.collection\('dailyCalendarRecommendations'\)\.add\(\{\s*\.\.\.draft,/
  )
  assert.doesNotMatch(
    source,
    /db\.collection\('dailyCalendarRecommendations'\)\.add\(\{\s*data:/
  )
})

test('批量生成日历颜色使用启用字典色并刷新旧算法记录', () => {
  assert.match(source, /async function enabledColorNamesByElement/)
  assert.match(source, /buildCalendarRecommendation\(date,\s*ruleVersion,\s*elementColors\)/)
  assert.match(source, /existingDoc\.generationMode === 'algorithm'/)
  assert.match(source, /manualOverride !== true/)
  assert.match(source, /db\.collection\('dailyCalendarRecommendations'\)\.doc\(existingDoc\._id\)\.update/)
})
