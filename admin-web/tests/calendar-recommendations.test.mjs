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
