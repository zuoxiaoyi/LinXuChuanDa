const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_DICTIONARIES } = require('../tag-defaults')
const {
  normalizeAccessory,
  normalizeOutfit,
  validatePublishMaterial
} = require('../material-rules')

test('穿搭根据颜色推导五行且忽略客户端五行', () => {
  const result = normalizeOutfit({
    primaryColorCodes: ['white', 'blue'],
    accentColorCodes: [],
    elementCodes: ['fire'],
    sceneCodes: ['commute'],
    seasonCodes: [],
    weatherCodes: [],
    temperatureMin: 10,
    temperatureMax: 20
  }, DEFAULT_DICTIONARIES)
  assert.deepEqual(result.elementCodes, ['metal', 'water'])
})

test('拒绝未知编码和错误温度范围', () => {
  assert.throws(
    () => normalizeOutfit({
      primaryColorCodes: ['missing'],
      sceneCodes: ['commute']
    }, DEFAULT_DICTIONARIES),
    /颜色编码无效/
  )
  assert.throws(
    () => normalizeOutfit({
      primaryColorCodes: ['white'],
      sceneCodes: ['commute'],
      temperatureMin: 20,
      temperatureMax: 10
    }, DEFAULT_DICTIONARIES),
    /最低温度不能高于最高温度/
  )
})

test('草稿可不完整但发布穿搭和配饰必须完整', () => {
  assert.doesNotThrow(() => normalizeOutfit({}, DEFAULT_DICTIONARIES))
  assert.throws(
    () => validatePublishMaterial('outfit', {
      title: '测试', primaryColorCodes: [], sceneCodes: []
    }, DEFAULT_DICTIONARIES),
    /发布穿搭还缺少/
  )
  assert.throws(
    () => validatePublishMaterial('accessory', {
      name: '测试', primaryColorCodes: [], sceneCodes: []
    }, DEFAULT_DICTIONARIES),
    /发布配饰还缺少/
  )
})
