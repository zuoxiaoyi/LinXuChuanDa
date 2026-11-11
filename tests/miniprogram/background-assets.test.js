const assert = require('node:assert/strict')
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs')
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

test('背景图统一用真机兼容的压缩 PNG，webP 不进小程序包', () => {
  const content = pageFiles.map(file => readFileSync(join(root, file), 'utf8')).join('\n')
  const config = JSON.parse(readFileSync(join(root, 'project.config.json'), 'utf8'))
  const ignored = config.packOptions.ignore.map(item => item.value)

  // 微信 image 组件的 webp 属性「默认不解析 webP 格式，只支持网络资源」；
  // 包内本地 .webp 在开发者工具(Chromium)正常、真机 WebView(尤其 iOS) 不渲染。
  assert.doesNotMatch(content, /index_bg\.webp/)
  assert.match(content, /\/images\/common\/index_bg\.png/)
  assert.ok(!ignored.includes('images/common/index_bg.png'), '压缩后的 PNG 必须进包')
  assert.ok(ignored.includes('images/common/index_bg.webp'), '未使用的 webP 不进包')

  const png = join(root, 'images/common/index_bg.png')
  assert.ok(existsSync(png))
  assert.ok(statSync(png).size < 120 * 1024, '背景图需保持量化压缩，不要退回 326KB 原图')
})

test('所有页面 WXML 都不引用本地 webp 资源', () => {
  const pagesDir = join(root, 'pages')
  const files = readdirSync(pagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(pagesDir, entry.name, `${entry.name}.wxml`))
    .filter(existsSync)

  assert.ok(files.length >= 5)
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\.webp/, file)
  }
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
