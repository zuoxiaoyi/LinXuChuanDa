const createItems = (type, items, systemLocked = false) => items.map((item, index) => ({
  type,
  order: index + 1,
  enabled: true,
  systemLocked,
  ...item
}))

const elements = createItems('element', [
  { code: 'metal', name: '金' },
  { code: 'wood', name: '木' },
  { code: 'water', name: '水' },
  { code: 'fire', name: '火' },
  { code: 'earth', name: '土' }
], true)

const colors = createItems('color', [
  { code: 'green', name: '绿', elementCode: 'wood', colorHex: '#4f8f5b' },
  { code: 'cyan', name: '青', elementCode: 'wood', colorHex: '#3f8f88' },
  { code: 'red', name: '红', elementCode: 'fire', colorHex: '#c94b45' },
  { code: 'purple', name: '紫', elementCode: 'fire', colorHex: '#80649a' },
  { code: 'orange', name: '橙', elementCode: 'fire', colorHex: '#db873b' },
  { code: 'yellow', name: '黄', elementCode: 'earth', colorHex: '#d9b84f' },
  { code: 'brown', name: '棕', elementCode: 'earth', colorHex: '#8a6246' },
  { code: 'coffee', name: '咖', elementCode: 'earth', colorHex: '#6f4e37' },
  { code: 'white', name: '白', elementCode: 'metal', colorHex: '#f7f4ed' },
  { code: 'silver', name: '银', elementCode: 'metal', colorHex: '#bfc2c5' },
  { code: 'gray', name: '灰', elementCode: 'metal', colorHex: '#9a9a9a' },
  { code: 'black', name: '黑', elementCode: 'water', colorHex: '#242424' },
  { code: 'blue', name: '蓝', elementCode: 'water', colorHex: '#416b9b' }
], true)

const DEFAULT_DICTIONARIES = [
  ...elements,
  ...colors,
  ...createItems('scene', [
    { code: 'commute', name: '通勤' },
    { code: 'leisure', name: '休闲' },
    { code: 'vacation', name: '度假' }
  ]),
  ...createItems('season', [
    { code: 'spring', name: '春' },
    { code: 'summer', name: '夏' },
    { code: 'autumn', name: '秋' },
    { code: 'winter', name: '冬' }
  ]),
  ...createItems('weather', [
    { code: 'normal', name: '常规' },
    { code: 'hot', name: '炎热' },
    { code: 'rain', name: '降雨' },
    { code: 'wind', name: '大风' },
    { code: 'snow', name: '降雪' }
  ]),
  ...createItems('accessoryType', [
    { code: 'necklace', name: '项链' },
    { code: 'earring', name: '耳饰' },
    { code: 'bracelet', name: '手链' },
    { code: 'ring', name: '戒指' },
    { code: 'watch', name: '手表' },
    { code: 'bag', name: '包' },
    { code: 'hat', name: '帽子' },
    { code: 'other', name: '其他' }
  ])
]

module.exports = { DEFAULT_DICTIONARIES }
