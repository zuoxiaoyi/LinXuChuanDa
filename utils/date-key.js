/**
 * 日期键规范化与换算（纯函数，供详情页 / 日签页共用）
 *
 * 项目里的日期有两套写法：
 * - dateKey：YYYY-MM-DD（数据库、日历接口都用它）
 * - 小程序码 scene：d=YYYYMMDD（compact，节省 scene 的 32 字符额度）
 */

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_COMPACT_RE = /^\d{4}\d{2}\d{2}$/

/** 把 YYYY-MM-DD / YYYYMMDD 统一成 YYYY-MM-DD；非法输入返回 '' */
function normalizeDateKey(value) {
  const raw = String(value == null ? '' : value).trim()
  if (DATE_ISO_RE.test(raw)) return raw
  if (DATE_COMPACT_RE.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  return ''
}

/** 当天日期键（本地时区） */
function todayDateKey() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-')
}

/** dateKey 相对今天偏移几天（dateKey 在未来为正）；非法输入返回 NaN */
function daysFromToday(dateKey) {
  const key = normalizeDateKey(dateKey)
  if (!key) return NaN
  const one = 24 * 60 * 60 * 1000
  const target = new Date(`${key}T00:00:00`).getTime()
  const today = new Date(`${todayDateKey()}T00:00:00`).getTime()
  return Math.round((target - today) / one)
}

module.exports = { normalizeDateKey, todayDateKey, daysFromToday }
