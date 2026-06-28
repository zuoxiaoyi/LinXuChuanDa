/**
 * 云函数 - checkIn
 * 功能：
 * 1. 每日签到固定获得1积分
 * 2. 完整观看激励视频后，按递减概率获得2～5倍总积分
 */
const cloud = require('wx-server-sdk')
const { drawMultiplier } = require('./multiplier')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const BASE_POINTS = 1

function getChinaDateString() {
  const chinaTime = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year = chinaTime.getUTCFullYear()
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
        points: BASE_POINTS,
        basePoints: BASE_POINTS,
        bonusClaimed: false,
        createTime: db.serverDate()
      }
    })
    await transaction.collection('users').doc(user._id).update({
      data: {
        points: db.command.inc(BASE_POINTS),
        totalPoints: db.command.inc(BASE_POINTS)
      }
    })

    return {
      success: true,
      addPoints: BASE_POINTS,
      points: (user.points || 0) + BASE_POINTS,
      canClaimAdBonus: true
    }
  })
}

async function handleClaimBonus(openid, todayStr) {
  const [checkinRes, userRes] = await Promise.all([
    db.collection('checkins').where({
      _openid: openid,
      date: todayStr
    }).limit(1).get(),
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
    const latestCheckin = await transaction
      .collection('checkins')
      .doc(checkin._id)
      .get()

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
        points: db.command.inc(bonusPoints),
        totalPoints: db.command.inc(bonusPoints)
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const todayStr = getChinaDateString()
  const action = event.action || 'checkIn'

  try {
    if (action === 'claimAdBonus') {
      return await handleClaimBonus(OPENID, todayStr)
    }
    return await handleCheckIn(OPENID, todayStr)
  } catch (err) {
    console.error('签到操作失败:', err)
    return { success: false, msg: '签到失败，请稍后重试' }
  }
}
