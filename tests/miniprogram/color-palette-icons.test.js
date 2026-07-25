const assert = require('node:assert/strict')
const { existsSync, readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')

const iconMap = {
  绿: 'color_palette_lv.png',
  青: 'color_palette_qing.png',
  红: 'color_palette_hong.png',
  紫: 'color_palette_zi.png',
  橙: 'color_palette_cheng.png',
  黄: 'color_palette_huang.png',
  棕: 'color_palette_zong.png',
  咖: 'color_palette_ka.png',
  白: 'color_palette_bai.png',
  银: 'color_palette_yin.png',
  灰: 'color_palette_hui.png',
  黑: 'color_palette_hei.png',
  蓝: 'color_palette_lan.png'
}

test('首页色系行使用 kuang 背景和色系衣服图标', () => {
  const wxml = readFileSync(join(root, 'pages/index/index.wxml'), 'utf8')
  const js = readFileSync(join(root, 'pages/index/index.js'), 'utf8')

  assert.match(wxml, /\/images\/common\/kuang\.png/)
  assert.match(wxml, /primaryColorItems/)
  assert.match(wxml, /secondaryColorItems/)
  assert.match(wxml, /avoidColorItems/)
  assert.match(js, /COLOR_ICON_MAP/)
  assert.doesNotMatch(js, /placeholder/)

  for (const [name, file] of Object.entries(iconMap)) {
    assert.match(js, new RegExp(`${name}: '\\/images\\/common\\/${file}'`))
  }
})

test('色系图标按固定行高样式展示', () => {
  const wxss = readFileSync(join(root, 'pages/index/index.wxss'), 'utf8')

  assert.match(wxss, /\.color-row\s*\{[^}]*height:\s*200rpx/s)
  assert.match(wxss, /\.color-tags\s*\{[^}]*height:\s*100%/s)
  assert.match(wxss, /\.color-tags\s*\{[^}]*align-content:\s*center/s)
  assert.match(wxss, /\.color-palette-icon\s*\{[^}]*width:\s*50rpx[^}]*height:\s*65rpx/s)
})

test('色系衣服图标已压缩到适合主包使用', () => {
  for (const file of Object.values(iconMap)) {
    const fullPath = join(root, 'images/common', file)
    assert.ok(existsSync(fullPath), `${file} should exist`)
    assert.ok(statSync(fullPath).size < 50 * 1024, `${file} should stay below 50KB`)
  }
})
