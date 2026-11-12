const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = file => readFileSync(join(root, file), 'utf8')

test('背景图使用真机兼容的压缩 PNG，webP 不进小程序包', () => {
  const indexWxml = read('pages/index/index.wxml')
  const detailWxml = read('pages/detail/detail.wxml')
  const config = JSON.parse(read('project.config.json'))
  const ignored = config.packOptions.ignore.map(item => item.value)

  assert.ok(existsSync(join(root, 'images/common/index_bg.png')))
  assert.match(indexWxml, /index_bg\.png/)
  assert.match(detailWxml, /index_bg\.png/)
  assert.doesNotMatch(indexWxml + detailWxml, /index_bg\.webp/)
  assert.ok(!ignored.includes('images/common/index_bg.png'))
  assert.ok(ignored.includes('images/common/index_bg.webp'))
})

test('六张人物图带落地阴影与轮廓分离', () => {
  const wxml = read('pages/detail/detail.wxml')
  const wxss = read('pages/detail/detail.wxss')

  assert.equal((wxml.match(/class="outfit-ground"/g) || []).length, 2)
  assert.match(wxss, /radial-gradient\(/)
  assert.match(wxss, /drop-shadow\(/)
  assert.match(wxss, /\.outfit-figure\s*\{[^}]*flex-direction:\s*column/s)
  assert.match(wxss, /\.outfit-card\s*\{[^}]*border-radius/s)
})

test('详情页日期箭头复用首页解锁与广告逻辑', () => {
  const js = read('pages/detail/detail.js')
  const wxml = read('pages/detail/detail.wxml')

  assert.match(wxml, /catchtap="onPrevDay"/)
  assert.match(wxml, /catchtap="onNextDay"/)
  assert.match(js, /FREE_DAYS\s*=\s*3/)
  assert.match(js, /MAX_DATE_INDEX\s*=\s*6/)
  assert.match(js, /windowStartDate/)
  assert.match(js, /action: 'getWeekStatus'/)
  assert.match(js, /action: 'adUnlockWeek'/)
  assert.match(js, /createRewardedVideoAd/)
  // 未开流量主阶段：解锁逻辑由统一开关控制，不再保留 dev 免费解锁后门
  assert.match(js, /isAdGateEnabled/)
  assert.doesNotMatch(js, /dev-free-unlock/)
  assert.match(js, /dateForIndex\(index\)/)
  assert.match(js, /isDateLocked\(index, dateKey\)/)
})

test('我的收藏图片完整显示人物头脚', () => {
  const wxml = read('pages/mine/mine.wxml')
  const wxss = read('pages/mine/mine.wxss')

  assert.match(wxml, /class="collection-img"[^>]*mode="aspectFit"/)
  assert.match(wxss, /\.collection-img\s*\{[^}]*height:\s*420rpx/s)
})
