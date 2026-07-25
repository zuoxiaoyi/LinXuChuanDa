const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function weekLockedDates(windowStart) {
  return [3, 4, 5, 6].map(offset => addDays(windowStart, offset))
}

async function ensureUser(openid) {
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return userRes.data[0] || null
}

async function getWeekStatus(openid, event) {
  const windowStart = event.windowStart
  if (!validDate(windowStart)) return { success: false, msg: '日期参数错误' }
  const dates = weekLockedDates(windowStart)
  const result = await db.collection('unlocks').where({
    _openid: openid,
    targetType: 'date',
    targetKey: _.in(dates)
  }).get()

  return {
    success: true,
    unlockedDates: result.data.map(item => item.targetKey)
  }
}

async function addUnlock(openid, date, method, windowStart, adEventId) {
  const existing = await db.collection('unlocks').where({
    _openid: openid,
    targetType: 'date',
    targetKey: date
  }).limit(1).get()
  if (existing.data.length) return false

  await db.collection('unlocks').add({
    data: {
      _openid: openid,
      targetType: 'date',
      targetKey: date,
      method,
      windowStart,
      adEventId: adEventId || '',
      createTime: db.serverDate()
    }
  })
  return true
}

async function adUnlockWeek(openid, event) {
  const user = await ensureUser(openid)
  if (!user) return { success: false, msg: '请先登录' }

  const windowStart = event.windowStart
  if (!validDate(windowStart)) return { success: false, msg: '日期参数错误' }

  const adEventId = String(event.adEventId || `${openid}-${Date.now()}`)
  const eventRes = await db.collection('adRewardEvents').where({
    _openid: openid,
    eventId: adEventId
  }).limit(1).get()
  if (!eventRes.data.length) {
    await db.collection('adRewardEvents').add({
      data: {
        _openid: openid,
        eventId: adEventId,
        type: 'unlock_week',
        windowStart,
        createTime: db.serverDate()
      }
    })
  }

  let created = 0
  for (const date of weekLockedDates(windowStart)) {
    if (await addUnlock(openid, date, 'ad', windowStart, adEventId)) created += 1
  }

  return {
    success: true,
    created,
    unlockedDates: weekLockedDates(windowStart)
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  try {
    if (event.action === 'getWeekStatus') return getWeekStatus(OPENID, event)
    if (event.action === 'adUnlockWeek') return adUnlockWeek(OPENID, event)
    return { success: false, msg: '未知操作' }
  } catch (err) {
    console.error('解锁失败:', err)
    return { success: false, msg: '解锁失败' }
  }
}
