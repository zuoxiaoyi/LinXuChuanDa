/**
 * 云函数 - login
 * 功能：用户登录/注册，返回用户信息和openid
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { nickName, avatarUrl } = event

  try {
    // 查找是否已有该用户
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()

    if (userRes.data.length === 0) {
      // 新用户 -> 注册
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickName: nickName || '微信用户',
          avatarUrl: avatarUrl || '',
          points: 0,
          totalPoints: 0,
          createTime: db.serverDate()
        }
      })
    } else {
      // 老用户 -> 更新信息
      await db.collection('users').where({ _openid: OPENID }).update({
        data: {
          nickName: nickName || userRes.data[0].nickName,
          avatarUrl: avatarUrl || userRes.data[0].avatarUrl
        }
      })
    }

    // 返回最新用户数据
    const latestUser = await db.collection('users').where({
      _openid: OPENID
    }).get()

    return {
      openid: OPENID,
      points: latestUser.data[0].points || 0,
      userInfo: latestUser.data[0]
    }
  } catch (err) {
    console.error('登录失败:', err)
    return { openid: OPENID, points: 0 }
  }
}
