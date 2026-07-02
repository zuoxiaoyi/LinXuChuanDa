const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const indexPath = join(__dirname, '..', 'index.js')

test('weatherApi 只从环境变量读取和风天气凭据', () => {
  assert.equal(existsSync(indexPath), true)
  const source = readFileSync(indexPath, 'utf8')

  for (const name of [
    'QWEATHER_API_HOST',
    'QWEATHER_PROJECT_ID',
    'QWEATHER_CREDENTIAL_ID',
    'QWEATHER_PRIVATE_KEY'
  ]) {
    assert.match(source, new RegExp(`process\\.env\\.${name}`))
  }
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/)
})

test('weatherApi 提供城市搜索和天气查询两个动作', () => {
  const source = readFileSync(indexPath, 'utf8')

  assert.match(source, /action === 'searchCity'/)
  assert.match(source, /action === 'getWeather'/)
  assert.match(source, /\/geo\/v2\/city\/lookup/)
  assert.match(source, /\/v7\/weather\/now/)
  assert.match(source, /\/v7\/weather\/7d/)
  assert.match(source, /\/v7\/indices\/3d/)
})
