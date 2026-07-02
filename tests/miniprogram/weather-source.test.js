const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const pageJs = readFileSync(join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = readFileSync(join(root, 'pages/index/index.wxml'), 'utf8')
const appConfig = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'))

test('首页通过 weatherApi 获取定位和手选城市天气', () => {
  assert.match(pageJs, /wx\.getLocation/)
  assert.match(pageJs, /name:\s*'weatherApi'/)
  assert.match(pageJs, /selectedWeatherLocation/)
  assert.match(pageJs, /lastWeatherSnapshot/)
  assert.match(pageJs, /onRegionChange/)
})

test('城市切换入口只位于天气卡片中', () => {
  const weatherCardAt = pageWxml.indexOf('class="weather-card"')
  const pickerAt = pageWxml.indexOf('<picker')

  assert.ok(weatherCardAt >= 0)
  assert.ok(pickerAt > weatherCardAt)
  assert.doesNotMatch(pageWxml, /class="account-entry"/)
  assert.equal((pageWxml.match(/切换城市/g) || []).length, 1)
})

test('首页展示天气更新时间和出行护理', () => {
  assert.match(pageWxml, /weather\.updatedText/)
  assert.match(pageWxml, /出行护理/)
  assert.match(pageWxml, /weather\.careAdvice/)
})

test('小程序声明定位用途和隐私接口', () => {
  assert.match(appConfig.permission['scope.userLocation'].desc, /天气/)
  assert.ok(appConfig.requiredPrivateInfos.includes('getLocation'))
})
