const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { pickByScene } = require('./recommendation-rules')
// Skyline 下 <image> 不支持 cloud://，返回前统一换成 https 临时链接
const { resolveImages } = require('./cloud-urls')
// 后台「每日建议」发布快照（ID 引用）→ 小程序展示对象（完整素材）
const {
  pickPublishedDay,
  referenceIds,
  expandPublishedDay,
  mergeWithFallback
} = require('./published-recommendation')

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

async function resolveAllImages(result) {
  await Promise.all([
    resolveImages(result.bestList),
    resolveImages(result.secondList),
    resolveImages(result.accessories)
  ])
  return result
}

// 兜底：原先的实时算法，按当日宜穿色 + 场景 + 温度从素材库打分挑选。
// 当天没有「已发布」的每日建议、或快照展开失败时走这里，保证线上永远不空白。
async function algorithmDailyRecommendation(event) {
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

  const bestList = pickByScene(outfits, scenes, primarySet, temperature, { allowReuse: true })
  const secondList = pickByScene(
    outfits.filter(item => !bestList.some(best => best._id === item._id)),
    scenes,
    secondarySet,
    temperature,
    { allowReuse: true, fallbackOutfits: outfits }
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

// 按 _id 批量取素材；分批避免单次 in 过长，并兼容历史文档把字段藏在 data 子对象里的情况
async function fetchByIds(collection, ids) {
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(
      db.collection(collection)
        .where({ _id: _.in(ids.slice(i, i + 50)) })
        .limit(50)
        .get()
    )
  }
  const results = await Promise.all(chunks)
  return results.flatMap(res => (res.data || []).map(normalizeDoc))
}

async function findPublishedDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null
  try {
    const res = await db.collection('dailyRecommendations')
      .where({ date, status: 'published' })
      .limit(10)
      .get()
    return pickPublishedDay(res.data, date)
  } catch (err) {
    // 集合不存在 / 权限异常不能让小程序白屏，静默回退到实时算法
    console.warn('[getOutfits] 每日建议快照读取失败，回退实时算法:', err && err.message)
    return null
  }
}

async function expandPublishedDayFromDb(doc) {
  const { outfitIds, accessoryIds } = referenceIds(doc)
  const [outfitDocs, accessoryDocs] = await Promise.all([
    fetchByIds('outfits', outfitIds),
    fetchByIds('accessories', accessoryIds)
  ])
  return expandPublishedDay({ doc, outfitDocs, accessoryDocs })
}

/**
 * 每日推荐统一入口：后台已发布的每日建议优先，实时算法兜底。
 * detail 页早就把 date 传进来了却一直没用，这里正好按日期取快照，小程序端零改动。
 * source 仅用于联调核对：published=完全按后台排版 / mixed=快照缺位已补齐 / algorithm=未发布。
 */
async function dailyRecommendation(event) {
  const date = String(event.date || '')
  const doc = await findPublishedDay(date)

  if (doc) {
    try {
      const published = await expandPublishedDayFromDb(doc)
      const complete = published.bestList.length >= 3
        && published.secondList.length >= 3
        && published.accessories.length >= 1

      let result = published
      let source = 'published'
      if (!complete) {
        // 素材下架或历史空壳被发布：缺的卡位用实时算法补齐，其余仍尊重运营排版
        const fallback = await algorithmDailyRecommendation(event)
        const merged = mergeWithFallback(published, fallback)
        result = merged
        source = merged.source
      }
      await resolveAllImages(result)
      return {
        bestList: result.bestList,
        secondList: result.secondList,
        accessories: result.accessories,
        source,
        date,
        ruleVersion: doc.ruleVersion || ''
      }
    } catch (err) {
      console.warn('[getOutfits] 已发布快照展开失败，回退实时算法:', err && err.message)
    }
  }

  const fallback = await algorithmDailyRecommendation(event)
  await resolveAllImages(fallback)
  return { ...fallback, source: 'algorithm', date, ruleVersion: '' }
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
  const list = await resolveImages(result.data.map(normalizeDoc))

  return {
    list,
    hasMore: (page - 1) * pageSize + list.length < totalRes.total,
    total: totalRes.total
  }
}

exports.main = async (event = {}) => {
  try {
    if (event.mode === 'dailyRecommendation') {
      // 必须 await：否则 async 分支抛错会绕过这里的 try/catch 变成 unhandled rejection
      return await dailyRecommendation(event)
    }
    return await listOutfits(event)
  } catch (err) {
    console.error('获取穿搭失败:', err)
    return event.mode === 'dailyRecommendation'
      ? { bestList: [], secondList: [], accessories: [] }
      : { list: [], hasMore: false, total: 0 }
  }
}
