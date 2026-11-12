const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const { toColorBadges } = require('../../utils/color-badges')
const { normalizeDateKey, todayDateKey, daysFromToday } = require('../../utils/date-key')

const root = join(__dirname, '..', '..')
const posterJs = readFileSync(join(root, 'pages/poster/poster.js'), 'utf8')
const posterWxml = readFileSync(join(root, 'pages/poster/poster.wxml'), 'utf8')
const detailJs = readFileSync(join(root, 'pages/detail/detail.js'), 'utf8')
const detailWxml = readFileSync(join(root, 'pages/detail/detail.wxml'), 'utf8')
const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'))
const qrFn = readFileSync(join(root, 'cloudfunctions/getShareQrCode/index.js'), 'utf8')

test('颜色徽标共享模块：中文名 / 拼音 / 未知色都有确定输出', () => {
  const badges = toColorBadges(['白', 'lv', '珍珠白'])
  assert.equal(badges.length, 3)
  assert.equal(badges[0].name, '白')
  assert.equal(badges[0].bgColor, '#fffaf1')
  assert.equal(badges[1].name, '绿')
  assert.equal(badges[1].bgColor, '#4f9660')
  // 未知色：原样显示名字，底色回退到品牌米色，不能出现 undefined
  assert.equal(badges[2].name, '珍珠白')
  assert.equal(badges[2].bgColor, '#eadfc9')
  assert.ok(badges[0].borderColor && badges[0].textColor)
  // 字符串逗号分隔输入也能解析
  assert.equal(toColorBadges('白,银').length, 2)
})

test('日期键工具：ISO / scene 紧凑格式互认，非法输入返回空串', () => {
  assert.equal(normalizeDateKey('2026-11-13'), '2026-11-13')
  assert.equal(normalizeDateKey('20261113'), '2026-11-13')
  assert.equal(normalizeDateKey(''), '')
  assert.equal(normalizeDateKey('2026/11/13'), '')
  assert.equal(normalizeDateKey('2026-1-3'), '')
  assert.equal(normalizeDateKey(null), '')
  assert.match(todayDateKey(), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(daysFromToday(todayDateKey()), 0)
  assert.ok(Number.isNaN(daysFromToday('bad-date')))
})

test('日签页：canvas 2d 绘制 + 保存相册走隐私授权 + 失败兜底', () => {
  assert.match(posterJs, /type:\s*'2d'|createSelectorQuery/)
  assert.match(posterJs, /canvas\.getContext\('2d'\)/)
  assert.match(posterJs, /ctx\.scale\(dpr, dpr\)/)
  assert.match(posterWxml, /<canvas[^>]*type="2d"/)
  assert.match(posterJs, /ensurePrivacyAuthorize\(\)/)
  assert.match(posterJs, /wx\.saveImageToPhotosAlbum/)
  assert.match(posterJs, /wx\.canvasToTempFilePath/)
  // 拒绝授权引导 openSetting，而不是静默失败
  assert.match(posterJs, /wx\.openSetting/)
  assert.match(posterJs, /截图保存/)
  // 数据源：日历宜穿色 + 最佳穿搭封面 + 小程序码，任一失败不阻塞其它
  assert.match(posterJs, /calendarRecommendations\.publicRange/)
  assert.match(posterJs, /getShareQrCode/)
  assert.match(posterJs, /mode:\s*'dailyRecommendation'/)
  assert.match(posterJs, /qrUrl/)
})

test('日签页：扫码 / 深链日期解析与分享路径', () => {
  assert.match(posterJs, /decodeURIComponent/)
  assert.match(posterJs, /d=\(\\d\{8\}\)/, '需解析 scene=d=YYYYMMDD')
  assert.match(posterJs, /\/pages\/poster\/poster\?date=/)
  assert.match(posterJs, /onShareTimeline/)
  // 分享标题把宜穿色带出去，提升卡片点击率
  assert.match(posterJs, /宜穿/)
})

test('详情页：支持小程序码 scene 与 date 深链，日签入口跳转', () => {
  assert.match(detailJs, /normalizeDateKey/)
  assert.match(detailJs, /daysFromToday/)
  assert.match(detailJs, /decodeURIComponent\(String\(options\.scene \|\| ''\)\)/)
  assert.match(detailJs, /options\.date/)
  assert.match(detailJs, /onGoPoster/)
  assert.match(detailJs, /\/pages\/poster\/poster\?date=/)
  assert.match(detailWxml, /poster-entry/)
  assert.match(detailWxml, /onGoPoster/)
  // 颜色映射改为共享模块，页面内不再维护一份副本
  assert.match(detailJs, /require\('\.\.\/\.\.\/utils\/color-badges'\)/)
  assert.doesNotMatch(detailJs, /const COLOR_BADGE_MAP/)
  assert.ok(appJson.pages.includes('pages/poster/poster'), 'app.json 需注册日签页')
})

test('getShareQrCode 云函数：scene 合法性校验 + checkPath 关闭 + 云存储换 https', () => {
  assert.match(qrFn, /wxacode\.getUnlimited/)
  assert.match(qrFn, /checkPath:\s*false/)
  assert.match(qrFn, /const LANDING_PAGE = 'pages\/detail\/detail'/)
  assert.match(qrFn, /DATE_RE/)
  assert.match(qrFn, /cloud\.uploadFile/)
  assert.match(qrFn, /getTempFileURL/)
  assert.match(qrFn, /d=\$\{date/)
  // 失败要有 success:false 结构化返回，前端才能降级成无码海报
  assert.match(qrFn, /success:\s*false/)
  assert.match(qrFn, /errMsg/)
})
