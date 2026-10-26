const assert = require('node:assert/strict')
const test = require('node:test')

const { pickByScene } = require('../recommendation-rules')

const scenes = [
  { code: 'commute', name: '通勤' },
  { code: 'leisure', name: '休闲' },
  { code: 'vacation', name: '度假' }
]

test('颜色不命中时仍从已发布素材中按场景匹配', () => {
  const result = pickByScene([
    { _id: '1', primaryColorCodes: ['black'], sceneCodes: ['commute'], priority: 1 },
    { _id: '2', primaryColorCodes: ['white'], sceneCodes: ['leisure'], priority: 2 }
  ], scenes, new Set(['red']), 20)

  assert.deepEqual(result.map(item => item._id), ['1', '2'])
})

test('素材不足时允许复用以填满每个场景卡位', () => {
  const result = pickByScene(
    [{ _id: '1', primaryColorCodes: ['black'], sceneCodes: ['commute'], priority: 1 }],
    scenes,
    new Set(['red']),
    20,
    { allowReuse: true }
  )

  assert.deepEqual(result.map(item => item._id), ['1', '1', '1'])
})
