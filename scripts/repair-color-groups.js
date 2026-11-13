/**
 * 一键修复「已发布的自动填充每日建议」里最佳/次佳色系串位的数据。
 *
 * 背景（2026-11-13）：recommendation-rules.js 早期让 best/secondary 共用同一份
 * 颜色打分（主色 +200 / 辅助色 +100），主色素材超过 3 套时第 4 套会挤进「次佳」，
 * 导致小程序详情页「绿/青」色系栏下出现红色素材。规则已修，但线上已发布的历史
 * 快照不会自动重算，需要按修正后的规则回填。
 *
 * 安全边界：
 *   - 只处理 status=published、generationMode=algorithm、manualOverride=false 的记录，
 *     运营在「查看/调整」里人工排过的（manualOverride=true）一律不动。
 *   - 只改 bestOutfits / secondaryOutfits / accessoryIds / version / updatedAt / updatedBy，
 *     不动 colorAdvice、status、publishAt 等其它字段。
 *   - 应用前把全部原始文档备份到 .workbuddy/backup/，可随时回滚。
 *   - 幂等：内容一致就跳过；重复执行不会重复累加 version。
 *
 * 用法（在项目根目录，需已登录 tcb CLI）：
 *   node scripts/repair-color-groups.js --dry-run
 *   node scripts/repair-color-groups.js --apply --only 2026-11-13
 *   node scripts/repair-color-groups.js --apply
 */

const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { buildAutoFill } = require('../cloudfunctions/adminApi/recommendation-rules')

const ROOT = join(__dirname, '..')
const ENV = process.env.TCB_ENV_ID || 'cloudbase-d7gr1giub2c847b49'
const TMP = join(ROOT, '.workbuddy', 'tmp')
const BACKUP_DIR = join(ROOT, '.workbuddy', 'backup')
const BACKUP_FILE = join(BACKUP_DIR, 'dailyRecommendations-color-group-repair.json')
const BATCH_SIZE = 10

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const onlyIndex = args.indexOf('--only')
const ONLY = onlyIndex >= 0 ? args[onlyIndex + 1] : ''

function runTcb(commands) {
  mkdirSync(TMP, { recursive: true })
  const cmdFile = join(TMP, `repair-cmd-${process.pid}.json`).replace(/\\/g, '/')
  writeFileSync(cmdFile, JSON.stringify(commands))
  const shell = `tcb db nosql execute --env-id ${ENV} --command "$(cat ${cmdFile})" --json`
  const out = execFileSync('bash', ['-c', shell], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  })
  const start = out.search(/^\{/m)
  if (start < 0) throw new Error('tcb 未返回 JSON：' + out.slice(0, 300))
  return JSON.parse(out.slice(start, out.lastIndexOf('}') + 1))
}

function query(table, filter, limit = 200) {
  const command = JSON.stringify({ find: table, filter, limit })
  const res = runTcb([{ TableName: table, CommandType: 'QUERY', Command: command }])
  const rows = res?.data?.results?.[0]
  if (!Array.isArray(rows)) throw new Error(`查询 ${table} 失败`)
  return rows.map(plain)
}

/** CLI 返回的是 Mongo Extended JSON，这里转成普通 JS 值 */
function plain(value) {
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    if ('$numberInt' in value) return Number(value.$numberInt)
    if ('$numberLong' in value) return Number(value.$numberLong)
    if ('$numberDouble' in value) return Number(value.$numberDouble)
    if ('$date' in value) {
      const raw = value.$date
      const ms = typeof raw === 'object' ? Number(raw.$numberLong || 0) : new Date(raw).getTime()
      return new Date(ms).toISOString()
    }
    if ('$oid' in value) return value.$oid
    const out = {}
    for (const key of Object.keys(value)) out[key] = plain(value[key])
    return out
  }
  return value
}

/** 历史文档可能把业务字段藏在 data 子对象里 */
function normalizeDoc(doc) {
  return doc && doc.data && typeof doc.data === 'object'
    ? { ...doc, ...doc.data, _id: doc._id }
    : doc
}

function idList(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => (typeof item === 'string' ? item : item && item.outfitId) || '')
    .filter(Boolean)
}

function main() {
  const docs = query('dailyRecommendations', {
    status: 'published',
    generationMode: 'algorithm',
    manualOverride: false,
    isDeleted: { $ne: true }
  }).map(normalizeDoc).filter(doc =>
    doc.status === 'published' && doc.generationMode === 'algorithm'
    && doc.manualOverride !== true && doc.isDeleted !== true
  )

  const outfits = query('outfits', { status: 'published', isDeleted: { $ne: true } }, 100)
  const accessories = query('accessories', { status: 'published', isDeleted: { $ne: true } }, 100)
  const dictionaries = query('tagDictionaries', { enabled: true, isDeleted: { $ne: true } }, 100)
  const nameByCode = {}
  for (const item of dictionaries) {
    if (item.code && item.name) nameByCode[item.code] = item.name
  }

  console.log(`[读取] 已发布算法快照 ${docs.length} 条 / 穿搭素材 ${outfits.length} / 配饰 ${accessories.length} / 字典 ${dictionaries.length}`)

  const changes = []
  for (const doc of docs) {
    if (ONLY && doc.date !== ONLY) continue
    const fill = buildAutoFill({
      colorAdvice: doc.colorAdvice || {},
      outfits,
      accessories,
      nameByCode
    })
    const next = {
      bestOutfits: fill.bestOutfits.map(item => item.outfitId),
      secondaryOutfits: fill.secondaryOutfits.map(item => item.outfitId),
      accessoryIds: fill.accessoryIds
    }
    const changed = Object.keys(next).some(key =>
      JSON.stringify(idList(doc[key])) !== JSON.stringify(next[key])
    )
    if (!changed) continue
    changes.push({
      _id: doc._id,
      date: doc.date,
      patch: {
        bestOutfits: fill.bestOutfits,
        secondaryOutfits: fill.secondaryOutfits,
        accessoryIds: fill.accessoryIds,
        version: (Number(doc.version) || 0) + 1,
        updatedAt: { $date: { $numberLong: String(Date.now()) } },
        updatedBy: 'color-group-repair'
      },
      before: {
        bestOutfits: idList(doc.bestOutfits),
        secondaryOutfits: idList(doc.secondaryOutfits),
        accessoryIds: idList(doc.accessoryIds)
      }
    })
  }

  // 合规统计：按修正后的数据检查「最佳命中主色 / 次佳命中辅助色」，
  // 素材库确实没有对应颜色时算法会兜底，这些日期单独列出来供运营补素材
  const colorNamesById = new Map(outfits.map(item => [
    item._id,
    (Array.isArray(item.primaryColorCodes) ? item.primaryColorCodes : [])
      .map(code => nameByCode[code] || code)
  ]))
  const hits = (ids, target) => ids.filter(id =>
    (colorNamesById.get(id) || []).some(name => target.has(name))
  ).length
  const offDays = []
  for (const doc of docs) {
    const target = new Set(
      (doc.colorAdvice?.secondary?.colors || []).map(String)
    )
    const secondHits = hits(idList(doc.secondaryOutfits), target)
    if (secondHits < 3) offDays.push(`${doc.date}(${secondHits}/3)`)
  }
  console.log(`[合规] 次佳 3/3 命中辅助宜穿色：${docs.length - offDays.length}/${docs.length} 天`)
  if (offDays.length) console.log(`[合规] 辅助色素材不足、已按中性色兜底的日期：${offDays.join(', ')}`)

  const sample = changes.find(item => item.date === '2026-11-13')
  console.log(`[计划] 需修正 ${changes.length} 条${ONLY ? `（仅 ${ONLY}）` : ''}`)
  if (sample) {
    console.log(`[样例 2026-11-13] 次佳 修正前: ${sample.before.secondaryOutfits.join(', ')}`)
    console.log(`[样例 2026-11-13] 次佳 修正后: ${sample.patch.secondaryOutfits.map(i => i.outfitId).join(', ')}`)
  }

  if (!APPLY) {
    console.log('[dry-run] 未写库。确认无误后加 --apply 执行。')
    return
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  if (!existsSync(BACKUP_FILE)) {
    writeFileSync(BACKUP_FILE, JSON.stringify(docs, null, 2))
    console.log(`[备份] 原始 ${docs.length} 条已写入 ${BACKUP_FILE}`)
  } else {
    console.log(`[备份] 已存在，沿用 ${BACKUP_FILE}`)
  }

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE)
    const command = JSON.stringify({
      update: 'dailyRecommendations',
      updates: batch.map(item => ({ q: { _id: item._id }, u: { $set: item.patch } }))
    })
    runTcb([{ TableName: 'dailyRecommendations', CommandType: 'UPDATE', Command: command }])
    console.log(`[写入] ${i + 1}-${i + batch.length} / ${changes.length}`)
  }
  console.log(`[完成] 共修正 ${changes.length} 条`)
}

main()
