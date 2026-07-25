const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const SCENES = [
  { code: 'commute', name: '通勤' },
  { code: 'leisure', name: '休闲' },
  { code: 'vacation', name: '度假' }
]

function normalizeDoc(doc) {
  return doc && doc.data && typeof doc.data === 'object'
    ? { ...doc, ...doc.data, _id: doc._id }
    : doc
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

async function dictionaries(type) {
  try {
    const result = await db.collection('tagDictionaries')
      .where({ type, enabled: true })
      .limit(100)
      .get()
    return result.data.map(normalizeDoc)
  } catch {
    return []
  }
}

function colorTokens(names, colors) {
  const tokens = new Set()
  names.forEach(name => {
    const text = String(name || '').trim()
    if (!text) return
    tokens.add(text)
    const matched = colors.find(item => item.name === text || item.code === text)
    if (matched) {
      tokens.add(matched.code)
      tokens.add(matched.name)
    }
  })
  return tokens
}

function scoreOutfit(outfit, sceneCode, colorSet, temperature) {
  const primaryColors = toArray(outfit.primaryColorCodes)
  if (!primaryColors.some(code => colorSet.has(code))) return -1

  let score = Number(outfit.priority) || 0
  if (toArray(outfit.sceneCodes).includes(sceneCode)) score += 100

  const min = Number(outfit.temperatureMin)
  const max = Number(outfit.temperatureMax)
  if (Number.isFinite(temperature) && Number.isFinite(min) && Number.isFinite(max)) {
    if (temperature >= min && temperature <= max) score += 30
    else score -= Math.min(40, Math.abs(temperature - Math.max(Math.min(temperature, max), min)) * 4)
  }

  return score
}

function pickByScene(outfits, scenes, colorSet, temperature) {
  const used = new Set()
  return scenes.map(scene => {
    const ranked = outfits
      .filter(item => !used.has(item._id))
      .map(item => ({ item, score: scoreOutfit(item, scene.code, colorSet, temperature) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
    const picked = ranked[0]?.item || null
    if (!picked) return null
    used.add(picked._id)
    return { ...picked, sceneName: scene.name }
  }).filter(Boolean)
}

async function dailyRecommendation(event) {
  const [colorDict, sceneDict] = await Promise.all([
    dictionaries('color'),
    dictionaries('scene')
  ])
  const scenes = sceneDict.length
    ? SCENES.map(scene => ({
      code: sceneDict.find(item => item.name === scene.name)?.code || scene.code,
      name: scene.name
    }))
    : SCENES
  const primarySet = colorTokens(toArray(event.primaryColors), colorDict)
  const secondarySet = colorTokens(toArray(event.secondaryColors), colorDict)
  const temperature = Number(event.temperature)

  const outfitRes = await db.collection('outfits')
    .where({ status: 'published' })
    .orderBy('priority', 'desc')
    .limit(100)
    .get()
  const outfits = outfitRes.data
    .map(normalizeDoc)
    .filter(item => item.inventoryStatus !== 'unavailable')

  const bestList = pickByScene(outfits, scenes, primarySet, temperature)
  const secondList = pickByScene(
    outfits.filter(item => !bestList.some(best => best._id === item._id)),
    scenes,
    secondarySet,
    temperature
  )

  let accessories = []
  try {
    const accessoryRes = await db.collection('accessories')
      .where({ status: 'published' })
      .orderBy('priority', 'desc')
      .limit(20)
      .get()
    accessories = accessoryRes.data
      .map(normalizeDoc)
      .filter(item => toArray(item.primaryColorCodes).some(code => primarySet.has(code)))
      .slice(0, 3)
    if (!accessories.length) {
      accessories = accessoryRes.data.map(normalizeDoc).slice(0, 3)
    }
  } catch {
    accessories = []
  }

  return { bestList, secondList, accessories }
}

async function listOutfits(event) {
  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 10))
  const where = { status: 'published' }
  const result = await db.collection('outfits')
    .where(where)
    .orderBy('priority', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  const totalRes = await db.collection('outfits').where(where).count()
  const list = result.data.map(normalizeDoc)

  return {
    list,
    hasMore: (page - 1) * pageSize + list.length < totalRes.total,
    total: totalRes.total
  }
}

exports.main = async (event = {}) => {
  try {
    if (event.mode === 'dailyRecommendation') {
      return dailyRecommendation(event)
    }
    return listOutfits(event)
  } catch (err) {
    console.error('获取穿搭失败:', err)
    return event.mode === 'dailyRecommendation'
      ? { bestList: [], secondList: [], accessories: [] }
      : { list: [], hasMore: false, total: 0 }
  }
}
