function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function scoreOutfit(outfit, sceneCode, colorSet, temperature) {
  const primaryColors = toArray(outfit.primaryColorCodes)
  let score = Number(outfit.priority) || 0
  if (primaryColors.some(code => colorSet.has(code))) score += 200
  if (toArray(outfit.sceneCodes).includes(sceneCode)) score += 100

  const min = Number(outfit.temperatureMin)
  const max = Number(outfit.temperatureMax)
  if (Number.isFinite(temperature) && Number.isFinite(min) && Number.isFinite(max)) {
    if (temperature >= min && temperature <= max) score += 30
    else score -= Math.min(40, Math.abs(temperature - Math.max(Math.min(temperature, max), min)) * 4)
  }

  return score
}

function pickByScene(outfits, scenes, colorSet, temperature, options = {}) {
  const used = new Set()
  return scenes.map(scene => {
    const rank = candidates => candidates
      .map(item => ({ item, score: scoreOutfit(item, scene.code, colorSet, temperature) }))
      .sort((a, b) => b.score - a.score)
    const unused = rank(outfits.filter(item => !used.has(item._id)))
    const ranked = unused.length || !options.allowReuse
      ? unused
      : rank(options.fallbackOutfits || outfits)
    const picked = ranked[0]?.item
    if (!picked) return null
    used.add(picked._id)
    return { ...picked, sceneName: scene.name }
  }).filter(Boolean)
}

module.exports = { pickByScene, scoreOutfit }
