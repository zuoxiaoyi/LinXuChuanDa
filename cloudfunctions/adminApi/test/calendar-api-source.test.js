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
