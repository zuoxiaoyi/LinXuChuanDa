const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const { orderPreviewColumns } = require('../../utils/preview-order')

const root = join(__dirname, '..', '..')
const detailJs = readFileSync(join(root, 'pages/detail/detail.js'), 'utf8')
const detailWxml = readFileSync(join(root, 'pages/detail/detail.wxml'), 'utf8')

const outfit = (id, sceneName) => ({ _id: id, coverUrl: `https://cdn.test/${id}.png`, sceneName })
const col = (sceneName, item) => ({ sceneName, item })

// 页面列顺序固定为 通勤 / 休闲 / 度假，但接口返回顺序可能是反的（后台人工调整过）
const bestColumns = [
  col('通勤', outfit('b-tong', '通勤')),
  col('休闲', outfit('b-xiu', '休闲')),
  col('度假', outfit('b-du', '度假'))
]
const secondColumns = [
  col('通勤', outfit('s-tong', '通勤')),
  col('休闲', outfit('s-xiu', '休闲')),
  col('度假', outfit('s-du', '度假'))
]

test('相册编号严格跟随页面可见顺序：第一排 1/2/3、第二排 4/5/6', () => {
  const { bestColumns: best, secondColumns: second, ordered } = orderPreviewColumns(bestColumns, secondColumns)

  assert.deepEqual(best.map(c => c.albumIndex), [0, 1, 2])
  assert.deepEqual(second.map(c => c.albumIndex), [3, 4, 5])
  assert.deepEqual(ordered.map(x => x.albumIndex), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(ordered.map(x => x.outfit._id), [
    'b-tong', 'b-xiu', 'b-du', 's-tong', 's-xiu', 's-du'
  ])
  assert.deepEqual(ordered.map(x => x.rank), [
    '最佳', '最佳', '最佳', '次佳', '次佳', '次佳'
  ])
})

test('空列与缺封面卡片不进相册，且不占用编号', () => {
  const best = [
    col('通勤', outfit('b1', '通勤')),
    col('休闲', null),
    col('度假', { _id: 'no-cover', sceneName: '度假' })
  ]
  const { bestColumns: decorated, secondColumns: decoratedSecond, ordered } =
    orderPreviewColumns(best, [col('通勤', outfit('s1', '通勤'))])

  assert.deepEqual(decorated.map(c => c.albumIndex), [0, -1, -1])
  assert.deepEqual(decoratedSecond.map(c => c.albumIndex), [1])
  assert.deepEqual(ordered.map(x => x.outfit._id), ['b1', 's1'])
  assert.deepEqual(ordered.map(x => x.albumIndex), [0, 1])
})

test('同一素材 ID 重复出现时各自有独立编号，不靠 _id 反查', () => {
  const duplicated = [
    col('通勤', outfit('same', '通勤')),
    col('休闲', outfit('same', '休闲')),
    col('度假', outfit('other', '度假'))
  ]
  const { ordered } = orderPreviewColumns(duplicated, [])
  assert.deepEqual(ordered.map(x => x.albumIndex), [0, 1, 2])
  assert.equal(new Set(ordered.map(x => x.albumIndex)).size, 3)
})

test('入参非数组时安全降级，不抛异常', () => {
  const layout = orderPreviewColumns(null, undefined)
  assert.deepEqual(layout.bestColumns, [])
  assert.deepEqual(layout.secondColumns, [])
  assert.deepEqual(layout.ordered, [])
})

test('详情页以下标定位预览，六宫格与单套图都传 albumIndex', () => {
  assert.match(detailJs, /orderPreviewColumns/)
  assert.match(detailJs, /buildPreviewLayout\(/)
  assert.match(detailJs, /dataset\.albumIndex/)
  assert.match(detailJs, /albumIndex/)
  // 不能再按接口原始数组顺序构造相册
  assert.doesNotMatch(detailJs, /buildPreviewList\(bestList, secondList\)/)
  // 收藏后重建列，也要重算下标
  assert.match(detailJs, /previewList: layout\.previewList/)

  const albumIndexTags = detailWxml.match(/data-album-index=/g) || []
  assert.equal(albumIndexTags.length, 3, '最佳、次佳、单套三处图片都要带可见序号')
  assert.match(detailWxml, /wx:key="albumIndex"/)
  assert.match(detailWxml, /previewIndex \+ 1/)
})
