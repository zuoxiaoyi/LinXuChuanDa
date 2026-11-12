const assert = require('node:assert/strict')
const { join } = require('node:path')
const test = require('node:test')

const {
  DEFAULT_SCENES,
  isUsable,
  pickPublishedDay,
  referenceIds,
  sceneNameFor,
  expandPublishedDay,
  mergeWithFallback
} = require(join(__dirname, '..', '..', 'cloudfunctions/getOutfits/published-recommendation'))

const outfit = (id, extra = {}) => ({
  _id: id,
  title: `穿搭${id}`,
  coverUrl: `cloud://demo/${id}.png`,
  status: 'published',
  primaryColorCodes: ['white'],
  ...extra
})

const accessory = (id, extra = {}) => ({
  _id: id,
  name: `配饰${id}`,
  imageUrl: `cloud://demo/${id}.png`,
  status: 'published',
  ...extra
})

const threeAccessories = () => [accessory('p1'), accessory('p2'), accessory('p3')]

const publishedDoc = (extra = {}) => ({
  date: '2026-11-12',
  status: 'published',
  ruleVersion: '2026.1',
  bestOutfits: [
    { outfitId: 'a', scene: '人工调整', score: 99 },
    { outfitId: 'b', scene: '人工调整', score: 98 },
    { outfitId: 'c', scene: '人工调整', score: 97 }
  ],
  secondaryOutfits: [
    { outfitId: 'd', scene: '人工调整', score: 90 },
    { outfitId: 'e', scene: '人工调整', score: 89 },
    { outfitId: 'f', scene: '人工调整', score: 88 }
  ],
  // 详情页幸运配饰是固定三列，完整快照应给满 3 个
  accessoryIds: ['p1', 'p2', 'p3'],
  ...extra
})

test('只认当天、已发布且未软删的每日建议快照', () => {
  const docs = [
    { date: '2026-11-12', status: 'draft' },
    { date: '2026-11-13', status: 'published' },
    { date: '2026-11-12', status: 'published', isDeleted: true },
    { date: '2026-11-12', status: 'published', isDeleted: false }
  ]
  assert.equal(pickPublishedDay(docs, '2026-11-12'), docs[3])
  assert.equal(pickPublishedDay([], '2026-11-12'), null)
  assert.equal(pickPublishedDay(docs, ''), null)
  assert.equal(pickPublishedDay(docs, '2026-11-12T00:00:00Z'), null)
})

test('同一天被重复写入多条已发布记录时，固定取最新发布的一条', () => {
  const older = { date: '2026-11-12', status: 'published', publishAt: new Date('2026-11-01T00:00:00Z') }
  const newer = { date: '2026-11-12', status: 'published', publishAt: new Date('2026-11-10T00:00:00Z') }
  assert.equal(pickPublishedDay([older, newer], '2026-11-12'), newer)
  assert.equal(pickPublishedDay([newer, older], '2026-11-12'), newer)
})

test('快照引用 ID 支持对象/字符串混合且自动去重', () => {
  const ids = referenceIds({
    bestOutfits: [{ outfitId: 'a' }, 'b', { outfitId: 'a' }],
    secondaryOutfits: [{ outfitId: 'c' }],
    accessoryIds: ['p1', 'p1', '']
  })
  assert.deepEqual(ids.outfitIds, ['a', 'b', 'c'])
  assert.deepEqual(ids.accessoryIds, ['p1'])
})

test('按后台排好的顺序展开，DB 返回顺序打乱也不影响', () => {
  const doc = publishedDoc()
  // 故意倒序 + 混入无关文档，模拟 _.in 查询的无序返回
  const outfitDocs = [outfit('f'), outfit('e'), outfit('d'), outfit('c'), outfit('b'), outfit('a')]
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: threeAccessories() })

  assert.deepEqual(result.bestList.map(item => item._id), ['a', 'b', 'c'])
  assert.deepEqual(result.secondList.map(item => item._id), ['d', 'e', 'f'])
  assert.deepEqual(result.accessories.map(item => item._id), ['p1', 'p2', 'p3'])
  assert.equal(result.bestList[0].coverUrl, 'cloud://demo/a.png')
})

test('下架 / 软删 / 缺货素材不会出现在已发布快照里', () => {
  const doc = publishedDoc()
  const outfitDocs = [
    outfit('a'),
    outfit('b', { status: 'draft' }),
    outfit('c', { isDeleted: true }),
    outfit('d', { inventoryStatus: 'unavailable' }),
    outfit('e'),
    outfit('f')
  ]
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: threeAccessories() })
  assert.deepEqual(result.bestList.map(item => item._id), ['a'])
  assert.deepEqual(result.secondList.map(item => item._id), ['e', 'f'])
  assert.equal(isUsable({ _id: 'x' }), false)
  assert.equal(isUsable(outfit('x')), true)
})

test('两组穿搭不重复引用同一套', () => {
  const doc = publishedDoc({
    secondaryOutfits: [
      { outfitId: 'a', scene: '人工调整' },
      { outfitId: 'e', scene: '人工调整' },
      { outfitId: 'f', scene: '人工调整' }
    ]
  })
  const outfitDocs = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => outfit(id))
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: [] })
  assert.deepEqual(result.secondList.map(item => item._id), ['e', 'f'])
})

test('场景名收敛到通勤/休闲/度假，不产生额外列', () => {
  const doc = publishedDoc()
  const outfitDocs = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => outfit(id))
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: threeAccessories() })

  for (const list of [result.bestList, result.secondList]) {
    assert.deepEqual(list.map(item => item.sceneName), DEFAULT_SCENES)
  }
  assert.equal(sceneNameFor({ scene: 'commute' }, 0, {}), '通勤')
  assert.equal(sceneNameFor({ scene: '度假' }, 0, {}), '度假')
  assert.equal(sceneNameFor({ scene: '人工调整' }, 1, { sceneCodes: ['travel'] }), '度假')
  assert.equal(sceneNameFor({ scene: '人工调整' }, 2, {}), '度假')
})

// 复现 2026-11-12 真机「未创建」：后台三条 scene 全是「人工调整」，
// 且素材 sceneCodes 本身也重复（度假/通勤/通勤），旧逻辑会输出两个「通勤」而缺「休闲」。
test('后台场景重复或素材场景码重复时，三列仍各有一套，不出现未创建', () => {
  const doc = publishedDoc()
  const outfitDocs = [
    outfit('a', { sceneCodes: ['vacation'] }),
    outfit('b', { sceneCodes: ['commute'] }),
    outfit('c', { sceneCodes: ['commute'] }),
    outfit('d', { sceneCodes: ['leisure'] }),
    outfit('e', { sceneCodes: ['leisure'] }),
    outfit('f', { sceneCodes: ['vacation'] })
  ]
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: threeAccessories() })
  for (const list of [result.bestList, result.secondList]) {
    assert.equal(new Set(list.map(item => item.sceneName)).size, 3)
    for (const scene of DEFAULT_SCENES) {
      assert.ok(list.some(item => item.sceneName === scene), `${scene} 列不能为空`)
    }
  }
})

test('后台直接指定重复场景时也会被纠正为三列', () => {
  const doc = publishedDoc({
    bestOutfits: [
      { outfitId: 'a', scene: '通勤' },
      { outfitId: 'b', scene: '通勤' },
      { outfitId: 'c', scene: '度假' }
    ]
  })
  const outfitDocs = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => outfit(id))
  const result = expandPublishedDay({ doc, outfitDocs, accessoryDocs: threeAccessories() })
  assert.deepEqual(result.bestList.map(item => item.sceneName), ['通勤', '休闲', '度假'])
})

test('完整快照（含 3 个配饰）完全不混入实时算法结果', () => {
  const published = expandPublishedDay({
    doc: publishedDoc(),
    outfitDocs: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => outfit(id)),
    accessoryDocs: threeAccessories()
  })
  const fallback = {
    bestList: [outfit('x1'), outfit('x2'), outfit('x3')],
    secondList: [outfit('y1'), outfit('y2'), outfit('y3')],
    accessories: [accessory('z1'), accessory('z2'), accessory('z3')]
  }
  const merged = mergeWithFallback(published, fallback)
  assert.equal(merged.source, 'published')
  assert.deepEqual(merged.bestList.map(item => item._id), ['a', 'b', 'c'])
  assert.deepEqual(merged.secondList.map(item => item._id), ['d', 'e', 'f'])
  assert.deepEqual(merged.accessories.map(item => item._id), ['p1', 'p2', 'p3'])
})

test('快照只配了 1 个配饰时补齐到 3 个，且不重复已有 ID', () => {
  const published = expandPublishedDay({
    doc: publishedDoc({ accessoryIds: ['p1'] }),
    outfitDocs: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => outfit(id)),
    accessoryDocs: [accessory('p1')]
  })
  const fallback = {
    bestList: [outfit('x1')],
    secondList: [outfit('y1')],
    accessories: [accessory('p1'), accessory('z2'), accessory('z3')]
  }
  const merged = mergeWithFallback(published, fallback)
  assert.equal(merged.source, 'mixed')
  assert.deepEqual(merged.bestList.map(item => item._id), ['a', 'b', 'c'])
  assert.deepEqual(merged.secondList.map(item => item._id), ['d', 'e', 'f'])
  assert.equal(merged.accessories.length, 3)
  assert.deepEqual(merged.accessories.map(item => item._id), ['p1', 'z2', 'z3'])
})

test('穿搭缺位时用算法补齐，且不重复已有 ID', () => {
  const published = expandPublishedDay({
    doc: publishedDoc(),
    outfitDocs: ['a', 'b', 'f'].map(id => outfit(id)),
    accessoryDocs: threeAccessories()
  })
  const fallback = {
    bestList: [outfit('a', { sceneName: '休闲' }), outfit('x2', { sceneName: '休闲' }), outfit('x3', { sceneName: '度假' })],
    secondList: [outfit('f', { sceneName: '通勤' }), outfit('y2', { sceneName: '休闲' }), outfit('y3', { sceneName: '度假' })],
    accessories: [accessory('z1'), accessory('z2'), accessory('z3')]
  }
  const merged = mergeWithFallback(published, fallback)
  assert.equal(merged.source, 'mixed')
  assert.equal(merged.bestList.length, 3)
  assert.equal(merged.secondList.length, 3)
  assert.equal(merged.accessories.length, 3)
  assert.equal(new Set(merged.bestList.map(item => item._id)).size, merged.bestList.length)
  assert.equal(new Set(merged.secondList.map(item => item._id)).size, merged.secondList.length)
  assert.equal(merged.bestList[0]._id, 'a')
  assert.equal(merged.secondList[0]._id, 'f')
})
