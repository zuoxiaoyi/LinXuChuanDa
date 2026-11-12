// 每日建议草稿的自动填充规则。
// 背景：早期 generateRecommendations 只写空壳（bestOutfits/secondaryOutfits/accessoryIds 全为空），
// 而发布接口要求「至少 3 套最佳 + 3 套次佳 + 1 个配饰」，导致批量生成的草稿一条都发不出去。
// 这里按当日宜穿色从已发布素材库里挑选，生成即可发布，运营仍可在「查看/调整」里人工替换。
//
// 注意：colorAdvice.colors 存的是中文颜色名（白/银/灰），素材的 primaryColorCodes 存的是字典 code
// （white/silver/gray），所以调用方必须传 nameByCode（字典 code -> 中文名）做转换。

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function namesOf(codes, nameByCode) {
  return toArray(codes).map(code => nameByCode[code] || code)
}

function scoreMaterial(item, colorAdvice, nameByCode) {
  const primary = new Set(toArray(colorAdvice?.primary?.colors))
  const secondary = new Set(toArray(colorAdvice?.secondary?.colors))
  const avoid = new Set(toArray(colorAdvice?.avoid?.colors))

  let value = Number(item.priority) || 0
  for (const name of namesOf(item.primaryColorCodes, nameByCode)) {
    if (primary.has(name)) value += 200
    else if (secondary.has(name)) value += 100
    else if (avoid.has(name)) value -= 80
  }
  // 辅助色只做小幅加权，不喧宾夺主
  for (const name of namesOf(item.accentColorCodes, nameByCode)) {
    if (primary.has(name)) value += 40
    else if (avoid.has(name)) value -= 20
  }
  return value
}

function pickTop(items, count, used, colorAdvice, nameByCode) {
  return (items || [])
    .filter(item => item && item._id && !used.has(item._id))
    .map(item => ({ item, value: scoreMaterial(item, colorAdvice, nameByCode) }))
    .sort((a, b) => b.value - a.value)
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
  const bestOutfits = pickTop(outfits, 3, used, colorAdvice, nameByCode)
  const secondaryOutfits = pickTop(outfits, 3, used, colorAdvice, nameByCode)
  const accessoryIds = pickTop(accessories, 1, new Set(), colorAdvice, nameByCode)
    .map(item => item.outfitId)

  return { bestOutfits, secondaryOutfits, accessoryIds }
}

module.exports = { buildAutoFill, scoreMaterial, toArray }
