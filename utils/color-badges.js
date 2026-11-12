/**
 * 颜色徽标工具（纯函数）
 * 从 pages/detail/detail.js 抽出：日签海报页也要「颜色中文名 → 徽标底色」映射，
 * 两处共享一份定义，避免新增颜色时只改一处。
 */

const COLOR_BADGE_MAP = {
  green: { name: '绿', bgColor: '#4f9660' },
  cyan: { name: '青', bgColor: '#459b94' },
  red: { name: '红', bgColor: '#d34e44' },
  purple: { name: '紫', bgColor: '#8a68a0' },
  orange: { name: '橙', bgColor: '#e58c35' },
  yellow: { name: '黄', bgColor: '#e1bc4a' },
  brown: { name: '棕', bgColor: '#9d704b' },
  coffee: { name: '咖', bgColor: '#7a5335' },
  white: { name: '白', bgColor: '#fffaf1', borderColor: '#d8c8aa' },
  silver: { name: '银', bgColor: '#c8c8c8' },
  gray: { name: '灰', bgColor: '#9a9a9a' },
  black: { name: '黑', bgColor: '#24231f', textColor: '#fff' },
  blue: { name: '蓝', bgColor: '#4879a9', textColor: '#fff' }
}

const COLOR_ALIASES = {
  lv: 'green',
  绿: 'green',
  qing: 'cyan',
  青: 'cyan',
  hong: 'red',
  红: 'red',
  zi: 'purple',
  紫: 'purple',
  cheng: 'orange',
  橙: 'orange',
  huang: 'yellow',
  黄: 'yellow',
  zong: 'brown',
  棕: 'brown',
  ka: 'coffee',
  咖: 'coffee',
  bai: 'white',
  白: 'white',
  yin: 'silver',
  银: 'silver',
  hui: 'gray',
  灰: 'gray',
  hei: 'black',
  黑: 'black',
  lan: 'blue',
  蓝: 'blue'
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function toColorBadges(colors = []) {
  return toArray(colors).map(color => {
    const matched = COLOR_BADGE_MAP[COLOR_ALIASES[color] || color]
    return {
      name: matched?.name || color,
      bgColor: matched?.bgColor || '#eadfc9',
      borderColor: matched?.borderColor || 'rgba(104, 75, 32, .22)',
      textColor: matched?.textColor || '#5d4728'
    }
  })
}

module.exports = { COLOR_BADGE_MAP, COLOR_ALIASES, toArray, toColorBadges }
