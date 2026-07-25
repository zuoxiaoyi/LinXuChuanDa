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
  assert.match(pageWxml, /selectedDay\.primaryColorItems/)
  assert.match(pageWxml, /selectedDay\.secondaryColorItems/)
  assert.match(pageWxml, /selectedDay\.avoidColorItems/)
})
