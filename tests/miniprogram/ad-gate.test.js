const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = file => readFileSync(join(root, file), 'utf8')

test('广告门槛开关集中配置：未开流量主时默认关闭', () => {
  const gate = read('utils/ad-gate.js')
  const app = read('app.js')

  assert.ok(existsSync(join(root, 'utils/ad-gate.js')))
  // 必须双条件判定，避免只开开关却忘填广告位 ID 时又出现假门槛
  assert.match(gate, /globals\.adGateEnabled && globals\.rewardedVideoAdUnitId/)
  assert.match(gate, /module\.exports/)
  assert.match(app, /adGateEnabled:\s*false/)
  assert.match(app, /rewardedVideoAdUnitId:\s*''/)
})

test('三页锁态均由统一开关控制，且删除免费解锁后门', () => {
  const index = read('pages/index/index.js')
  const detail = read('pages/detail/detail.js')
  const mine = read('pages/mine/mine.js')
  const all = index + detail + mine

  assert.match(index, /isLocked:\s*isAdGateEnabled\(\)\s*&&\s*index >= 3/)
  assert.match(detail, /isDateLocked\(index, dateKey\)[\s\S]{0,220}isAdGateEnabled\(\)/)
  assert.match(index, /if \(!isAdGateEnabled\(\)\) return/)
  assert.match(detail, /if \(!isAdGateEnabled\(\)\) return Promise\.resolve\(\[\]\)/)
  for (const js of [index, detail, mine]) {
    assert.match(js, /require\('\.\.\/\.\.\/utils\/ad-gate'\)/)
  }

  // 开发期「不看广告直接放行」的兜底与开发态文案不能混进正式包
  assert.doesNotMatch(all, /dev-free-unlock|freeUnlockWeek/)
  assert.doesNotMatch(all, /广告位尚未配置|当前版本限时开放|立即解锁/)
})

test('我的页：广告翻倍入口随开关隐藏，补签不受广告阻塞', () => {
  const wxml = read('pages/mine/mine.wxml')
  const js = read('pages/mine/mine.js')

  assert.match(wxml, /adGateEnabled && todayChecked && !todayBonusClaimed/)
  assert.match(wxml, /adGateEnabled && todayBonusClaimed/)
  assert.match(js, /showBonusOffer\(\) \{[\s\S]{0,160}if \(!isAdGateEnabled\(\)\) return/)
  assert.match(js, /if \(!isAdGateEnabled\(\)\) \{[\s\S]{0,120}await this\.claimMakeUp\(\)/)
})

test('sitemap 只收录内容页，登录/隐私/我的/开屏不参与收录', () => {
  const sitemap = JSON.parse(read('sitemap.json'))
  const rules = sitemap.rules.map(rule => `${rule.action}:${rule.page}`)
  for (const rule of [
    'allow:pages/index/index',
    'allow:pages/detail/detail',
    'disallow:pages/login/login',
    'disallow:pages/legal/legal',
    'disallow:pages/mine/mine',
    'disallow:pages/splash/splash',
    'disallow:*'
  ]) {
    assert.ok(rules.includes(rule), `缺少 sitemap 规则 ${rule}`)
  }
})

test('分享标题带真实搜索词，且不含任何诱导分享表述', () => {
  const share = read('utils/share.js')
  const index = read('pages/index/index.js')
  const detail = read('pages/detail/detail.js')
  const all = share + index + detail

  assert.match(share, /今天穿什么颜色？灵序穿搭每日顺时建议/)
  assert.match(index, /穿什么颜色？灵序穿搭每日顺时建议/)
  assert.match(index, /timeline\(\) \{[\s\S]{0,200}穿什么颜色/)
  assert.match(detail, /灵序穿搭每日顺时建议/)
  assert.doesNotMatch(all, /分享得|分享解锁|转发领取|邀请得|分享后才能/)
})
