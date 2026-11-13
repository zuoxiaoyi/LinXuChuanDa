// 每日建议草稿的自动填充规则。
// 背景：早期 generateRecommendations 只写空壳（bestOutfits/secondaryOutfits/accessoryIds 全为空），
// 而发布接口要求「至少 3 套最佳 + 3 套次佳 + 1 个配饰」，导致批量生成的草稿一条都发不出去。
// 这里按当日宜穿色从已发布素材库里挑选，生成即可发布，运营仍可在「查看/调整」里人工替换。
// 配饰按小程序详情页固定三列排版给满 3 个；素材不足时如实少给，由小程序端用算法补齐。
//
// 注意：colorAdvice.colors 存的是中文颜色名（白/银/灰），素材的 primaryColorCodes 存的是字典 code
// （white/silver/gray），所以调用方必须传 nameByCode（字典 code -> 中文名）做转换。
//
// 2026-11-13 修复：最佳 / 次佳必须按「各自的色系」挑选。
// 早期两组共用同一份打分（主色 +200 / 辅助色 +100），只要主色素材超过 3 套，
// 第 4 套主色素材就会带着 +200 挤进次佳 —— 详情页「绿/青」色系栏下出现红色素材即由此而来。
// 现在按组切换目标色系并做三层优先级：命中目标色 → 中性色 → 忌穿色（仅不足时兜底）。

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function namesOf(codes, nameByCode) {
  return toArray(codes).map(code => nameByCode[code] || code)
}

/** 打分仍保留（用于同层内排序与后台展示的 score 字段），但主/次佳的目标色权重按组切换 */
function scoreMaterial(item, colorAdvice, nameByCode, group = 'best') {
  const primary = new Set(toArray(colorAdvice?.primary?.colors))
  const secondary = new Set(toArray(colorAdvice?.secondary?.colors))
  const avoid = new Set(toArray(colorAdvice?.avoid?.colors))
  const primaryBonus = group === 'secondary' ? 60 : 200
  const secondaryBonus = group === 'secondary' ? 200 : 100

  let value = Number(item.priority) || 0
  for (const name of namesOf(item.primaryColorCodes, nameByCode)) {
    if (primary.has(name)) value += primaryBonus
    else if (secondary.has(name)) value += secondaryBonus
    else if (avoid.has(name)) value -= 80
  }
  // 辅助色只做小幅加权，不喧宾夺主
  for (const name of namesOf(item.accentColorCodes, nameByCode)) {
    if (primary.has(name)) value += 40
    else if (avoid.has(name)) value -= 20
  }
  return value
}

/** 色系分层：0=命中本组目标色，1=中性色，2=当日忌穿色（只在候选不足时兜底） */
function colorTier(item, target, avoid, nameByCode) {
  const primaryNames = namesOf(item.primaryColorCodes, nameByCode)
  if (primaryNames.some(name => target.has(name))) return 0
  if (primaryNames.some(name => avoid.has(name))) return 2
  return 1
}

function pickTop(items, count, used, colorAdvice, nameByCode, group = 'best') {
  const target = new Set(toArray(
    group === 'secondary' ? colorAdvice?.secondary?.colors : colorAdvice?.primary?.colors
  ))
  const avoid = new Set(toArray(colorAdvice?.avoid?.colors))

  return (items || [])
    .filter(item => item && item._id && !used.has(item._id))
    .map(item => ({
      item,
      value: scoreMaterial(item, colorAdvice, nameByCode, group),
      tier: colorTier(item, target, avoid, nameByCode)
    }))
    // 先按色系分层再按分数降序：分数再高的主色素材也不能越过次佳组的辅助色素材
    .sort((a, b) => a.tier - b.tier || b.value - a.value)
    .slice(0, count)
    .map(({ item, value }) => {
      used.add(item._id)
      return {
        outfitId: item._id,
        scene: nameByCode[toArray(item.sceneCodes)[0]] || toArray(item.sceneTags)[0] || '日常',
        score: value
      }
    })
}

/**
 * 为某一天挑选推荐内容。
 * @returns {{ bestOutfits: Array, secondaryOutfits: Array, accessoryIds: string[] }}
 */
function buildAutoFill({ colorAdvice, outfits = [], accessories = [], nameByCode = {} }) {
  const used = new Set()
  // 先挑最佳再挑次佳，used 保证两组不重复；配饰单独用一份 used，不与穿搭互斥
  const bestOutfits = pickTop(outfits, 3, used, colorAdvice, nameByCode, 'best')
  const secondaryOutfits = pickTop(outfits, 3, used, colorAdvice, nameByCode, 'secondary')
  const accessoryIds = pickTop(accessories, 3, new Set(), colorAdvice, nameByCode, 'best')
    .map(item => item.outfitId)

  return { bestOutfits, secondaryOutfits, accessoryIds }
}

module.exports = { buildAutoFill, scoreMaterial, colorTier, toArray }
