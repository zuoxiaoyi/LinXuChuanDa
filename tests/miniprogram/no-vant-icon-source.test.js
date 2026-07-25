const assert = require('node:assert/strict')
const { existsSync, readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const files = [
  'pages/index/index.wxml',
  'pages/detail/detail.wxml',
  'pages/mine/mine.wxml',
  'components/bottom-nav/bottom-nav.wxml'
]

test('business pages no longer depend on Vant icon fonts', () => {
  const appWxss = readFileSync(join(root, 'app.wxss'), 'utf8')
  const source = files.map(file => readFileSync(join(root, file), 'utf8')).join('\n')

  assert.doesNotMatch(source, /<van-icon\b/)
  assert.doesNotMatch(appWxss, /https:\/\/img01\.yzcdn\.cn\/vant\/vant-icon/)
  assert.doesNotMatch(appWxss, /data:font/)
  assert.doesNotMatch(appWxss, /vant-icon-local/)
})

test('business icon placeholders use local png assets', () => {
  const source = files.map(file => readFileSync(join(root, file), 'utf8')).join('\n')
  const iconSources = [...source.matchAll(/src="(\/images\/icons\/[^"]+\.png)"/g)].map(match => match[1])

  assert.ok(iconSources.length >= 14)
  assert.doesNotMatch(source, /<text class="(?:local-icon|lock-icon|state-icon|image-placeholder-icon|avatar-icon|arrow-icon|empty-icon)"/)

  for (const iconSource of new Set(iconSources)) {
    const iconPath = join(root, iconSource.slice(1))
    assert.ok(existsSync(iconPath), `${iconSource} should exist`)
    assert.ok(statSync(iconPath).size < 5000, `${iconSource} should stay small`)
  }
})
