const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const mineJs = readFileSync(join(root, 'pages/mine/mine.js'), 'utf8')
const mineWxml = readFileSync(join(root, 'pages/mine/mine.wxml'), 'utf8')
const contentPage = readFileSync(join(root, 'admin-web/src/pages/ContentPage.vue'), 'utf8')

test('「我的」页简介从后台内容配置读取，失败时保留本地兜底', () => {
  assert.match(mineJs, /async loadIntro\(\)/)
  assert.match(mineJs, /action: 'content\.publicGet'/)
  assert.match(mineJs, /key: 'about'/)
  assert.match(mineJs, /locale: 'zh-CN'/)
  assert.match(mineJs, /res\.result\?\.data\?\.content/)
  assert.match(mineJs, /this\.loadIntro\(\)/)
  assert.match(mineJs, /console\.warn\('加载灵序穿搭简介失败/)
  assert.match(mineWxml, /\{\{introText\}\}/)
})

test('本地兜底文案与后台已发布版本一致，且不含风水/运势等审核敏感表述', () => {
  assert.match(mineJs, /const DEFAULT_INTRO = '灵序穿搭，每天告诉你穿什么颜色/)
  assert.match(mineJs, /introText: DEFAULT_INTRO/)
  assert.doesNotMatch(mineJs, /风水能量/)
  assert.doesNotMatch(mineJs, /提升运势/)
  assert.doesNotMatch(mineJs, /个人磁场/)
})

test('后台说明同步更新：简介发布后会影响「我的」页', () => {
  assert.match(contentPage, /「我的」页简介同步更新/)
  assert.doesNotMatch(contentPage, /「灵序穿搭简介」「分享文案」目前仅供后台留存/)
})
