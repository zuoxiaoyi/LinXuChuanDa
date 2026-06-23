/**
 * 云函数 - checkIn
 * 功能：每日签到，发放积分，防止重复签到
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 签到积分规则：基础5分 + 连续签到奖励
const BASE_POINTS = 5

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  try {
    // 检查今日是否已签到
    const existRes = await db.collection('checkins').where({
      _openid: OPENID,
      date: todayStr
    }).get()

    if (existRes.data.length > 0) {
      return { success: false, msg: '今日已签到' }
    }

    // 写入签到记录
    await db.collection('checkins').add({
      data: {
        _openid: OPENID,
        date: todayStr,
        points: BASE_POINTS,
        createTime: db.serverDate()
      }
    })

    // 更新用户积分（使用原子操作避免并发问题）
    await db.collection('users').where({ _openid: OPENID }).update({
      data: {
        points: db.command.inc(BASE_POINTS),
        totalPoints: db.command.inc(BASE_POINTS)
      }
    })

    // 获取最新积分
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()

    return {
      success: true,
      addPoints: BASE_POINTS,
      points: userRes.data[0]?.points || BASE_POINTS
    }
  } catch (err) {
    console.error('签到失败:', err)
    return { success: false, msg: '签到失败' }
  }
}
