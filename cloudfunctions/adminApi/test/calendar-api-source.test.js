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
