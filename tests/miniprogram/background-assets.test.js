const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const pageFiles = [
  'pages/splash/splash.wxml',
  'pages/login/login.wxml',
  'pages/index/index.wxml',
  'pages/detail/detail.wxml',
  'pages/mine/mine.wxml'
]

test('background pages reuse the smaller common background asset', () => {
  const content = pageFiles.map(file => readFileSync(join(root, file), 'utf8')).join('\n')

  assert.ok(existsSync(join(root, 'images/common/bg.png')))
  assert.ok(existsSync(join(root, 'images/common/index_bg.png')))
  assert.doesNotMatch(content, /\/images\/splash\/bg\.png/)
  assert.match(content, /\/images\/common\/bg\.png/)
  assert.match(content, /\/images\/common\/index_bg\.png/)
  assert.match(content, /\/images\/common\/title\.png/)
})

test('splash page matches prototype asset layout', () => {
  const wxml = readFileSync(join(root, 'pages/splash/splash.wxml'), 'utf8')
  const wxss = readFileSync(join(root, 'pages/splash/splash.wxss'), 'utf8')
  const js = readFileSync(join(root, 'pages/splash/splash.js'), 'utf8')

  assert.match(wxml, /src="\/images\/common\/bg\.png"\s+mode="aspectFill"/)
  assert.match(wxml, /src="\/images\/common\/title\.png"\s+mode="widthFix"/)
  assert.match(wxml, /-穿出你的好运势-/)
  assert.match(wxml, /<navigation-bar/)
  assert.match(wxml, /style="\{\{skipStyle\}\}"/)
  assert.match(wxss, /\.skip-area\s*\{[^}]*height:\s*42rpx/s)
  assert.match(wxss, /\.skip-text\s*\{[^}]*color:\s*#000/s)
  assert.match(js, /getMenuButtonBoundingClientRect/)
  assert.match(js, /wx\.redirectTo\(\{\s*url:\s*'\/pages\/index\/index'/)
})
