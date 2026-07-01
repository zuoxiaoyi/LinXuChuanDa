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
