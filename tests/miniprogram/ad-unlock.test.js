const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const indexJs = readFileSync(join(root, 'pages/index/index.js'), 'utf8')
const unlockFn = readFileSync(join(root, 'cloudfunctions/unlockOutfit/index.js'), 'utf8')

test('首页点击锁定日期走广告解锁当前七日窗口', () => {
  assert.match(indexJs, /createRewardedVideoAd/)
  assert.match(indexJs, /onUnlockWeekByAd/)
  assert.match(indexJs, /refreshUnlockStatus/)
  assert.match(indexJs, /action:\s*'adUnlockWeek'/)
})

test('unlockOutfit 改为按日期记录永久解锁', () => {
  assert.match(unlockFn, /adUnlockWeek/)
  assert.match(unlockFn, /getWeekStatus/)
  assert.match(unlockFn, /collection\('unlocks'\)/)
  assert.match(unlockFn, /targetType:\s*'date'/)
  assert.doesNotMatch(unlockFn, /UNLOCK_COST\s*=\s*10/)
})

test('home falls back to free unlock when reward ad is unavailable', () => {
  assert.match(indexJs, /freeUnlockWeek/)
  assert.match(indexJs, /dev-free-unlock/)
  assert.match(indexJs, /限时开放/)
})
