/**
 * 后台「每日建议」发布快照 → 小程序展示数据的适配层（纯函数，不依赖 wx-server-sdk）。
 *
 * 形状差异：
 *   dailyRecommendations 存的是 ID 引用：
 *     bestOutfits: [{ outfitId, scene, score }] / secondaryOutfits: [...] / accessoryIds: string[]
 *   detail 页要的是完整素材对象：
 *     bestList / secondList / accessories，且按 sceneName 分列渲染。
 *
 * 后台条目的 scene 可能来自字典中文名、字典 code，或人工调整时写死的「人工调整」；
 * 详情页只认「通勤/休闲/度假」三个场景，出现别的名字会多开一列，因此统一规范化。
 */

const DEFAULT_SCENES = ['通勤', '休闲', '度假']

const SCENE_ALIASES = {
  通勤: '通勤', commute: '通勤', work: '通勤', business: '通勤', 上班: '通勤', 商务: '通勤',
  休闲: '休闲', leisure: '休闲', casual: '休闲', 日常: '休闲', 生活: '休闲',
  度假: '度假', vacation: '度假', travel: '度假', holiday: '度假', 旅行: '度假', 出游: '度假'
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function toId(value) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && typeof value.outfitId === 'string') {
    return value.outfitId.trim()
  }
  return ''
}

function unique(list) {
  return [...new Set(list.filter(Boolean))]
}

/** 素材可用性：与实时算法分支保持一致，已下架 / 软删 / 缺货的素材不能出现在用户面前 */
function isUsable(item) {
  if (!item || !item._id || item.isDeleted === true) return false
  if (item.status !== 'published') return false
  if (item.inventoryStatus === 'unavailable') return false
  return true
}

function timeOf(doc) {
  const raw = doc?.publishAt || doc?.updatedAt
  const value = raw instanceof Date ? raw.getTime() : new Date(raw || 0).getTime()
  return Number.isFinite(value) ? value : 0
}

/**
 * 从候选文档里挑出当天有效且已发布的那条。
 * 软删由内存判断（避免 neq 对缺失字段的兼容差异）；历史上出现过同 key 重复写入，
 * 因此多条命中时固定取 publishAt / updatedAt 最新的一条，避免展示结果随机漂移。
 */
function pickPublishedDay(docs, date) {
  if (!DATE_RE.test(String(date || ''))) return null
  return (Array.isArray(docs) ? docs : [])
    .filter(doc => doc && doc.date === date && doc.status === 'published' && doc.isDeleted !== true)
    .sort((a, b) => timeOf(b) - timeOf(a))[0] || null
}

/** 收集需要批量查询的素材 ID；best/second 可能重复引用同一套，统一去重后一次 in 查询 */
function referenceIds(doc) {
  const outfitIds = [
    ...toArray(doc?.bestOutfits).map(toId),
    ...toArray(doc?.secondaryOutfits).map(toId)
  ]
  return {
    outfitIds: unique(outfitIds),
    accessoryIds: unique(toArray(doc?.accessoryIds).map(toId))
  }
}

/** 把条目的 scene（中文/code/人工调整）收敛到详情页认识的三场景，取不到时按位置轮转补位 */
function sceneNameFor(entry, index, outfit) {
  const raw = entry && typeof entry === 'object' ? entry.scene : ''
  const codes = [...toArray(outfit?.sceneCodes), ...toArray(outfit?.sceneTags)]
  for (const candidate of [raw, ...codes]) {
    const key = String(candidate || '').trim().toLowerCase()
    if (SCENE_ALIASES[key]) return SCENE_ALIASES[key]
  }
  return DEFAULT_SCENES[index % DEFAULT_SCENES.length]
}

/**
 * 详情页是固定的通勤/休闲/度假三列，靠 list.find(o => o.sceneName === 列头) 取卡片。
 * 后台自动填充按颜色打分，不保证场景互斥（实测同一天三条 scene 都是「通勤」或「人工调整」），
 * 若原样输出就会有两列 find 不到 → 显示「未创建」。这里保证前三套各占一个不同的标准场景，
 * 优先尊重后台指定，冲突时补到尚未占用的列，绝不引入三列之外的新名字。
 */
function claimScene(preferred, used, index) {
  if (!used.has(preferred)) {
    used.add(preferred)
    return preferred
  }
  const free = DEFAULT_SCENES.find(name => !used.has(name))
  if (free) {
    used.add(free)
    return free
  }
  // 超过 3 套时循环复用，多出来的套数仍进相册预览，但不会多开列
  return DEFAULT_SCENES[index % DEFAULT_SCENES.length]
}

/**
 * 按后台排好的顺序展开成完整素材对象。
 * docs 由调用方先做 normalizeDoc（兼容历史 data 子对象），这里只做纯转换。
 */
function expandPublishedDay({ doc, outfitDocs = [], accessoryDocs = [] }) {
  const outfitsById = new Map(outfitDocs.filter(isUsable).map(item => [item._id, item]))
  const accessoriesById = new Map(accessoryDocs.filter(isUsable).map(item => [item._id, item]))

  const used = new Set()
  const expand = entries => {
    const picked = []
    const sceneUsed = new Set()
    toArray(entries).forEach(entry => {
      const id = toId(entry)
      const outfit = outfitsById.get(id)
      if (!outfit || used.has(id)) return
      used.add(id)
      picked.push({
        ...outfit,
        sceneName: claimScene(
          sceneNameFor(entry, picked.length, outfit),
          sceneUsed,
          picked.length
        )
      })
    })
    return picked
  }

  // 先展开 best 再展开 second，保证两组之间不重复（与实时算法的互斥规则一致）
  const bestList = expand(doc?.bestOutfits)
  const secondList = expand(doc?.secondaryOutfits)

  const accessoryUsed = new Set()
  const accessories = toArray(doc?.accessoryIds)
    .map(toId)
    .filter(id => {
      if (!accessoriesById.has(id) || accessoryUsed.has(id)) return false
      accessoryUsed.add(id)
      return true
    })
    .map(id => ({ ...accessoriesById.get(id) }))

  return { bestList, secondList, accessories }
}

/**
 * 快照缺位（素材下架 / 历史空壳被误发布）时用实时算法补齐，不留空白卡片。
 * 完整快照不会混入任何算法结果，运营排版 100% 生效。
 * @returns {{bestList: Array, secondList: Array, accessories: Array, source: 'published'|'mixed'}}
 */
function mergeWithFallback(published, fallback, minimum = { best: 3, second: 3, accessory: 3 }) {
  const fill = (primary, backup, min) => {
    const list = [...primary]
    const ids = new Set(list.map(item => item._id))
    const scenes = new Set(list.map(item => item.sceneName))
    if (list.length < min) {
      // 优先补尚未出现的场景，其次按 ID 不重复补齐
      const candidates = [...(backup || [])].sort((a, b) =>
        Number(!scenes.has(b?.sceneName)) - Number(!scenes.has(a?.sceneName))
      )
      for (const item of candidates) {
        if (list.length >= min) break
        if (!item || !item._id || ids.has(item._id)) continue
        list.push(item)
        ids.add(item._id)
        scenes.add(item.sceneName)
      }
    }
    return list
  }

  const bestList = fill(published.bestList, fallback?.bestList, minimum.best)
  const secondList = fill(published.secondList, fallback?.secondList, minimum.second)
  const accessories = fill(published.accessories, fallback?.accessories, minimum.accessory)
  const patched = bestList.length !== published.bestList.length
    || secondList.length !== published.secondList.length
    || accessories.length !== published.accessories.length

  return { bestList, secondList, accessories, source: patched ? 'mixed' : 'published' }
}

module.exports = {
  DEFAULT_SCENES,
  SCENE_ALIASES,
  isUsable,
  pickPublishedDay,
  referenceIds,
  sceneNameFor,
  expandPublishedDay,
  mergeWithFallback
}
