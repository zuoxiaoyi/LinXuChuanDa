const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 默认昵称：小灵 + 4 位随机数字，保证每个用户稳定且彼此不同。
// 仅在用户未填写、或历史上遗留的"微信用户"/空值时生成一次，生成后不再变化。
function generateDefaultNickname() {
  return '小灵' + Math.floor(1000 + Math.random() * 9000)
}

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
          nickName: nickName || generateDefaultNickname(),
          avatarUrl: avatarUrl || '',
          points: 0,
          totalPoints: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          lastActiveAt: db.serverDate()
        }
      })
    } else {
      const currentUser = userRes.data[0]
      // 历史上遗留的"微信用户"或空昵称，在下次登录时补生成默认昵称；
      // 已是"小灵xxx"等真实昵称则保持不变，避免每次登录都换名字。
      const legacyNick = !currentUser.nickName || currentUser.nickName === '微信用户'
      const nextNickName = nickName || (legacyNick ? generateDefaultNickname() : currentUser.nickName)
      await db.collection('users').doc(currentUser._id).update({
        data: {
          nickName: nextNickName,
          avatarUrl: avatarUrl || currentUser.avatarUrl,
          updateTime: db.serverDate(),
          lastActiveAt: db.serverDate()
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
