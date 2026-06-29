const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { nickName, avatarUrl } = event

  try {
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()

    if (userRes.data.length === 0) {
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickName: nickName || '微信用户',
          avatarUrl: avatarUrl || '',
          points: 0,
          totalPoints: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    } else {
      const currentUser = userRes.data[0]
      await db.collection('users').doc(currentUser._id).update({
        data: {
          nickName: nickName || currentUser.nickName,
          avatarUrl: avatarUrl || currentUser.avatarUrl,
          updateTime: db.serverDate()
        }
      })
    }

    const latestUserRes = await db.collection('users').where({
      _openid: OPENID
    }).limit(1).get()
    const userInfo = latestUserRes.data[0]

    if (!userInfo) {
      throw new Error('用户记录创建失败')
    }

    return {
      success: true,
      openid: OPENID,
      points: Number(userInfo.points) || 0,
      userInfo
    }
  } catch (err) {
    console.error('登录失败:', err)
    return {
      success: false,
      message: '登录服务暂时不可用'
    }
  }
}
