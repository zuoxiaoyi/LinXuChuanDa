/**
 * 云函数 - checkIn
 * 功能：
 * 1. 每日签到固定获得 1 积分
 * 2. 连续签到阶梯奖励（满 3 天 +1，满 7 天 +2）
 * 3. 完整观看激励视频后，按递减概率获得 2～5 倍当日积分
 * 4. 观看激励视频补签昨日（阶段 6：补签）
 */
const cloud = require('wx-server-sdk')
const { drawMultiplier } = require('./multiplier')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const BASE_POINTS = 1

function getChinaDateString(offset = 0) {
  const base = Date.now() + 8 * 60 * 60 * 1000 + offset * 24 * 60 * 60 * 1000
  const chinaTime = new Date(base)
  const year = chinaTime.getUTCFullYear()
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// 连续签到阶梯：满 3 天 +1，满 7 天再 +2
function computeStreakBonus(streak) {
  if (streak >= 7) return 2
  if (streak >= 3) return 1
  return 0
}

// 从 anchor 往前连续签到的天数（dateSet 为已签到的日期集合）
function computeStreak(dateSet, anchor) {
  let streak = 0
  let cursor = anchor
  while (dateSet.has(cursor)) {
    streak += 1
    cursor = prevDateStr(cursor)
  }
  return streak
}

async function getUserCheckinDates(openid, limit = 120) {
  const res = await db.collection('checkins')
    .where({ _openid: openid })
    .field({ date: true })
    .orderBy('date', 'desc')
    .limit(limit)
    .get()
  return new Set(res.data.map(item => item.date))
}

async function handleCheckIn(openid, todayStr) {
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (userRes.data.length === 0) {
    return { success: false, msg: '请先登录' }
  }

  const existed = await db.collection('checkins').where({
    _openid: openid,
    date: todayStr
  }).limit(1).get()
  if (existed.data.length > 0) {
    return {
      success: false,
      alreadyChecked: true,
      bonusClaimed: !!existed.data[0].bonusClaimed,
      msg: '今日已签到'
    }
  }

  const user = userRes.data[0]

  // 基于已提交数据 + 今天，重算连续天数（事务内写入尚未提交，故在事务外先算）
  const priorSet = await getUserCheckinDates(openid)
  priorSet.add(todayStr)
  const streakCount = computeStreak(priorSet, todayStr)
  const streakBonus = computeStreakBonus(streakCount)
  const totalPoints = BASE_POINTS + streakBonus

  const checkinId = `${openid}_${todayStr}`
  return db.runTransaction(async transaction => {
    const checkinRef = transaction.collection('checkins').doc(checkinId)
    let checkinExists = false
    try {
      const checkinRes = await checkinRef.get()
      checkinExists = !!checkinRes.data
    } catch (err) {
      checkinExists = false
    }

    if (checkinExists) {
      return { success: false, alreadyChecked: true, msg: '今日已签到' }
    }

    await checkinRef.set({
      data: {
        _openid: openid,
        date: todayStr,
        points: totalPoints,
        basePoints: BASE_POINTS,
        streakBonus,
        streakCount,
        bonusClaimed: false,
        createTime: db.serverDate()
      }
    })
    await transaction.collection('users').doc(user._id).update({
      data: {
        points: _.inc(totalPoints),
        totalPoints: _.inc(totalPoints),
        streakCount,
        lastCheckInDate: todayStr
      }
    })

    return {
      success: true,
      addPoints: totalPoints,
      points: (user.points || 0) + totalPoints,
      streakCount,
      streakBonus,
      canClaimAdBonus: true
    }
  })
}

async function handleClaimBonus(openid, todayStr) {
  const [checkinRes, userRes] = await Promise.all([
    db.collection('checkins').where({ _openid: openid, date: todayStr }).limit(1).get(),
    db.collection('users').where({ _openid: openid }).limit(1).get()
  ])

  if (checkinRes.data.length === 0) {
    return { success: false, msg: '请先完成今日签到' }
  }
  if (userRes.data.length === 0) {
    return { success: false, msg: '请先登录' }
  }

  const checkin = checkinRes.data[0]
  const user = userRes.data[0]
  const multiplier = drawMultiplier()
  const bonusPoints = BASE_POINTS * (multiplier - 1)

  return db.runTransaction(async transaction => {
    const latestCheckin = await transaction.collection('checkins').doc(checkin._id).get()

    if (latestCheckin.data.bonusClaimed) {
      return {
        success: false,
        alreadyClaimed: true,
        multiplier: latestCheckin.data.multiplier,
        msg: '今日翻倍奖励已领取'
      }
    }

    await transaction.collection('checkins').doc(checkin._id).update({
      data: {
        bonusClaimed: true,
        multiplier,
        bonusPoints,
        totalAwardPoints: BASE_POINTS + bonusPoints,
        bonusTime: db.serverDate()
      }
    })
    await transaction.collection('users').doc(user._id).update({
      data: {
        points: _.inc(bonusPoints),
        totalPoints: _.inc(bonusPoints)
      }
    })

    return {
      success: true,
      multiplier,
      bonusPoints,
      totalAwardPoints: BASE_POINTS + bonusPoints,
      points: (user.points || 0) + bonusPoints
    }
  })
}

async function handleMakeUp(openid, todayStr) {
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (userRes.data.length === 0) {
    return { success: false, msg: '请先登录' }
  }

  const yesterdayStr = getChinaDateString(-1)
  const existed = await db.collection('checkins').where({
    _openid: openid,
    date: yesterdayStr
  }).limit(1).get()
  if (existed.data.length > 0) {
    return { success: false, msg: '昨日已签到或已补签' }
  }

  const user = userRes.data[0]

  // 重算连续天数（以昨日为锚点；若今日已签到，最新日期仍为今日）
  const priorSet = await getUserCheckinDates(openid)
  priorSet.add(yesterdayStr)
  const streakCount = computeStreak(priorSet, yesterdayStr)
  const streakBonus = computeStreakBonus(streakCount)
  const totalPoints = BASE_POINTS + streakBonus
  const latestDate = priorSet.has(todayStr) ? todayStr : yesterdayStr

  const checkinId = `${openid}_${yesterdayStr}`
  return db.runTransaction(async transaction => {
    const checkinRef = transaction.collection('checkins').doc(checkinId)
    let checkinExists = false
    try {
      const checkinRes = await checkinRef.get()
      checkinExists = !!checkinRes.data
    } catch (err) {
      checkinExists = false
    }
    if (checkinExists) {
      return { success: false, msg: '昨日已补签' }
    }

    await checkinRef.set({
      data: {
        _openid: openid,
        date: yesterdayStr,
        points: totalPoints,
        basePoints: BASE_POINTS,
        streakBonus,
        streakCount,
        bonusClaimed: true,
        makeUp: true,
        createTime: db.serverDate()
      }
    })
    await transaction.collection('users').doc(user._id).update({
      data: {
        points: _.inc(totalPoints),
        totalPoints: _.inc(totalPoints),
        streakCount,
        lastCheckInDate: latestDate
      }
    })

    return {
      success: true,
      addPoints: totalPoints,
      points: (user.points || 0) + totalPoints,
      streakCount,
      streakBonus,
      madeUpDate: yesterdayStr
    }
  })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const todayStr = getChinaDateString()
  const action = event.action || 'checkIn'

  try {
    if (action === 'claimAdBonus') {
      return await handleClaimBonus(OPENID, todayStr)
    }
    if (action === 'makeUpCheckIn') {
      return await handleMakeUp(OPENID, todayStr)
    }
    return await handleCheckIn(OPENID, todayStr)
  } catch (err) {
    console.error('签到操作失败:', err)
    return { success: false, msg: '签到失败，请稍后重试' }
  }
}
