const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_DICTIONARIES } = require('../tag-defaults')

test('默认字典包含固定五行、13种颜色和V1运营标签', () => {
  const byType = type => DEFAULT_DICTIONARIES.filter(item => item.type === type)
  assert.deepEqual(byType('element').map(item => item.code), [
    'metal', 'wood', 'water', 'fire', 'earth'
  ])
  assert.deepEqual(byType('color').map(item => item.name), [
    '绿', '青',
    '红', '紫', '橙',
    '黄', '棕', '咖',
    '白', '银', '灰',
    '黑', '蓝'
  ])
  assert.deepEqual(byType('scene').map(item => item.name), ['通勤', '休闲', '度假'])
  assert.deepEqual(byType('weather').map(item => item.name), [
    '常规', '炎热', '降雨', '大风', '降雪'
  ])
})

test('每种颜色只绑定一个有效五行', () => {
  const elements = new Set(
    DEFAULT_DICTIONARIES.filter(item => item.type === 'element').map(item => item.code)
  )
  for (const color of DEFAULT_DICTIONARIES.filter(item => item.type === 'color')) {
    assert.ok(elements.has(color.elementCode))
    assert.match(color.colorHex, /^#[0-9a-f]{6}$/i)
  }
})
