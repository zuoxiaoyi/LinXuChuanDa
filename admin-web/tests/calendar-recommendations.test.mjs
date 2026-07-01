import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const domainTypes = read('../src/types/domain.ts')
const demoApi = read('../src/services/demo-api.ts')
const page = read('../src/pages/CalendarRecommendationsPage.vue')
const router = read('../src/router/index.ts')
const layout = read('../src/layout/AdminLayout.vue')

test('后台定义基础日历结果类型', () => {
  assert.match(domainTypes, /export interface CalendarRecommendation/)
  assert.match(domainTypes, /dayElement: ElementCode/)
  assert.match(domainTypes, /primary: ColorAdviceLevel/)
})

test('演示接口支持基础日历列表和生成', () => {
  assert.match(demoApi, /calendarRecommendations\.list/)
  assert.match(demoApi, /calendarRecommendations\.generate/)
})

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
