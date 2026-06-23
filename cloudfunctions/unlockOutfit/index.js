/**
 * 云函数 - unlockOutfit
 * 功能：使用积分解锁穿搭内容
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 解锁所需积分
const UNLOCK_COST = 10

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { outfitId } = event

  try {
    // 查询用户当前积分
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()

    if (userRes.data.length === 0) {
      return { success: false, msg: '请先登录' }
    }

    const user = userRes.data[0]
    if ((user.points || 0) < UNLOCK_COST) {
      return { success: false, msg: '积分不足' }
    }

    // 扣除积分
    await db.collection('users').where({ _openid: OPENID }).update({
      data: {
        points: db.command.inc(-UNLOCK_COST)
      }
    })

    return {
      success: true,
      remainPoints: (user.points || 0) - UNLOCK_COST,
      costPoints: UNLOCK_COST
    }
  } catch (err) {
    console.error('解锁失败:', err)
    return { success: false, msg: '解锁失败' }
  }
}
