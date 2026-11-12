import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const contentPage = read('../src/pages/ContentPage.vue')
const recommendationsPage = read('../src/pages/RecommendationsPage.vue')
const adminLayout = read('../src/layout/AdminLayout.vue')
const adminApi = read('../../cloudfunctions/adminApi/index.js')
const autoGen = read('../../cloudfunctions/recommendationAutoGen/index.js')
const { buildAutoFill } = require('../../cloudfunctions/adminApi/recommendation-rules.js')

test('内容配置：英文 key / 状态 / 语言标记改为中文', () => {
  assert.match(contentPage, /const keyLabels/)
  assert.match(contentPage, /const statusLabels/)
  assert.match(contentPage, /const localeLabels/)
  assert.doesNotMatch(contentPage, /\{\{\s*item\.key\s*\}\}/)
  assert.doesNotMatch(contentPage, /\{\{\s*item\.status\s*\}\}/)
  assert.match(contentPage, /keyLabels\[item\.key\]/)
  assert.match(contentPage, /statusLabels\[item\.status\]/)
  assert.match(contentPage, /localeLabels\[item\.locale\]/)
})

test('内容配置：嵌套 data 不能覆盖顶层字段，重复记录按 key 折叠', () => {
  // 顶层字段必须后展开，否则旧 data 会反过来盖住编辑后的新内容
  assert.match(contentPage, /\.\.\.data,\s*\.\.\.row/s)
  assert.match(contentPage, /function dedupe/)
  assert.match(contentPage, /duplicateCount/)
  assert.match(contentPage, /group\.sort/)
  assert.match(contentPage, /已折叠/, '重复记录要有可见提示')
  assert.match(contentPage, /小程序「协议」页会优先展示后台版本/)
})

test('后台页面小标题、顶栏、角色均为中文', () => {
  const pageDir = new URL('../src/pages/', import.meta.url)
  for (const file of readdirSync(pageDir).filter(name => name.endsWith('.vue'))) {
    const source = readFileSync(new URL(file, pageDir), 'utf8')
    const match = source.match(/eyebrow="([^"]*)"/)
    if (match) {
      assert.doesNotMatch(
        match[1],
        /[A-Za-z]/,
        `${file} 的 eyebrow 仍含英文：${match[1]}`
      )
    }
  }
  assert.doesNotMatch(adminLayout, /LINXU \/ OPERATIONS/)
  assert.match(adminLayout, /灵序穿搭 · 运营控制台/)
  assert.match(adminLayout, /roleLabels\[auth\.admin/)
})

test('每日建议：枚举值中文、创建/更新时间两列', () => {
  assert.match(recommendationsPage, /generationModeLabels/)
  assert.match(recommendationsPage, /statusLabels\[row\.status\]/)
  assert.match(recommendationsPage, /label="创建时间"/)
  assert.match(recommendationsPage, /label="更新时间"/)
  assert.match(recommendationsPage, /formatDateTime\(row\.createdAt\)/)
  assert.match(recommendationsPage, /formatDateTime\(row\.updatedAt\)/)
  assert.doesNotMatch(recommendationsPage, /\{\{\s*row\.generationMode\s*\}\}/)
  assert.doesNotMatch(recommendationsPage, /\{\{\s*row\.status\s*\}\}/)
})

test('每日建议：查看/调整可点击并支持自动挑选与保存', () => {
  assert.match(recommendationsPage, /@click="openDetail\(row\)"/)
  assert.match(recommendationsPage, /<el-drawer/)
  assert.match(recommendationsPage, /'recommendations\.autoFill'/)
  assert.match(recommendationsPage, /'recommendations\.save'/)
  assert.match(recommendationsPage, /按今日宜穿色自动挑选/)
  assert.match(recommendationsPage, /保存并发布/)
})

test('每日建议：批量生成可回填空草稿，且不覆盖已发布/人工调整记录', () => {
  assert.match(recommendationsPage, /overwriteDraft/)
  assert.match(recommendationsPage, /回填已有草稿/)
  assert.match(adminApi, /payload\.overwriteDraft === true/)
  assert.match(adminApi, /existing\.status !== 'published'/)
  assert.match(adminApi, /existing\.manualOverride !== true/)
})

test('每日建议：批量发布走多选与独立接口，失败明细可见', () => {
  assert.match(recommendationsPage, /type="selection"/)
  assert.match(recommendationsPage, /@selection-change="onSelectionChange"/)
  assert.match(recommendationsPage, /'recommendations\.batchPublish'/)
  assert.match(recommendationsPage, /批量发布确认/)
  assert.match(recommendationsPage, /publishResult\.details/)
  assert.match(recommendationsPage, /center:\s*true/)
})

test('adminApi：批量发布与自动生成动作均已注册且有 __timer__ 保护', () => {
  assert.match(adminApi, /'recommendations\.batchPublish':\s*'recommendations\.publish'/)
  assert.match(adminApi, /'recommendations\.autoFill':\s*'recommendations\.write'/)
  assert.match(adminApi, /async function batchPublishRecommendations/)
  assert.match(adminApi, /function missingPublishFields/)
  assert.match(adminApi, /async function autoGenerateMonthRecommendations/)
  assert.match(adminApi, /action === 'recommendations\.autoGenerateMonth'/)
  assert.match(adminApi, /action === 'recommendations\.batchPublish'/)
  assert.match(adminApi, /action === 'recommendations\.autoFill'/)
  // 定时任务分支必须排在管理员鉴权之前，且带来源校验
  const timerBranch = adminApi.indexOf("action === 'recommendations.autoGenerateMonth'")
  assert.ok(timerBranch > -1 && timerBranch < adminApi.indexOf('const uid = resolveUid'))
  assert.match(adminApi, /event\.__timer__ !== true/)
})

test('adminApi：生成改为批量查重并自动填充可发布内容', () => {
  assert.match(adminApi, /async function loadAutoFillContext/)
  assert.match(adminApi, /date: command\.in\(dates\)/)
  assert.match(adminApi, /buildAutoFill\(\{/)
  assert.match(adminApi, /const unfilled = \[\.\.\.drafts, \.\.\.updates\.map/)
  assert.match(adminApi, /doc\.bestOutfits\.length < 3/)
  assert.match(adminApi, /payload\.overwriteDraft === true/)
  assert.match(adminApi, /existing\.manualOverride !== true/)
  // 不再写空壳
  assert.doesNotMatch(adminApi, /bestOutfits: \[\],\s*secondaryOutfits: \[\],\s*accessoryIds: \[\]/s)
})

test('recommendationAutoGen：沿用月末判断范式调用每日建议生成', () => {
  assert.match(autoGen, /function parsePlanDate/)
  assert.match(autoGen, /triggerTime/)
  assert.match(autoGen, /isMonthEnd/)
  assert.match(autoGen, /not-month-end/)
  assert.match(autoGen, /recommendations\.autoGenerateMonth/)
  assert.match(autoGen, /__timer__:\s*true/)
  assert.match(autoGen, /generatedMonth/)
})

test('自动挑选规则：首选色优先、两组不重复、配饰取 1 个', () => {
  const nameByCode = {
    white: '白', silver: '银', gray: '灰',
    black: '黑', blue: '蓝', red: '红', commute: '通勤'
  }
  const colorAdvice = {
    primary: { element: '金', colors: ['白', '银', '灰'] },
    secondary: { element: '水', colors: ['黑', '蓝'] },
    avoid: { element: '火', colors: ['红', '紫'] }
  }
  const outfits = [
    { _id: 'o1', primaryColorCodes: ['white'], sceneCodes: ['commute'], priority: 1 },
    { _id: 'o2', primaryColorCodes: ['black'], priority: 1 },
    { _id: 'o3', primaryColorCodes: ['red'], priority: 1 },
    { _id: 'o4', primaryColorCodes: ['silver'], priority: 1 },
    { _id: 'o5', primaryColorCodes: ['gray'], priority: 1 },
    { _id: 'o6', primaryColorCodes: ['blue'], priority: 1 }
  ]
  const accessories = [{ _id: 'a1', primaryColorCodes: ['white'], priority: 1 }]

  const fill = buildAutoFill({ colorAdvice, outfits, accessories, nameByCode })
  assert.equal(fill.bestOutfits.length, 3)
  assert.equal(fill.secondaryOutfits.length, 3)
  assert.deepEqual(fill.accessoryIds, ['a1'])
  assert.deepEqual(
    fill.bestOutfits.map(item => item.outfitId).sort(),
    ['o1', 'o4', 'o5']
  )
  assert.equal(fill.bestOutfits[0].scene, '通勤')
  const all = [...fill.bestOutfits, ...fill.secondaryOutfits].map(item => item.outfitId)
  assert.equal(new Set(all).size, 6, '最佳与次佳不能重复')
})

test('自动挑选规则：素材不足时如实返回，不伪造条目', () => {
  const fill = buildAutoFill({
    colorAdvice: { primary: { colors: ['白'] }, secondary: { colors: [] }, avoid: { colors: [] } },
    outfits: [{ _id: 'only', primaryColorCodes: ['white'] }],
    accessories: [],
    nameByCode: { white: '白' }
  })
  assert.equal(fill.bestOutfits.length, 1)
  assert.equal(fill.secondaryOutfits.length, 0)
  assert.deepEqual(fill.accessoryIds, [])
})
