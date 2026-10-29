const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 默认昵称：小灵 + 4 位随机数字，保证每个用户稳定且彼此不同。
// 仅在用户未填写、或历史上遗留的"微信用户"/空值时生成一次，生成后不再变化。
function generateDefaultNickname() {
  return '小灵' + Math.floor(1000 + Math.random() * 9000)
}

// 幂等建号/更新：并发登录同一新用户时，两条流程可能都走到"不存在"分支，
// 这里捕获写入冲突后回退读取已存在记录，避免重复创建导致查询返回多条。
async function upsertUser(OPENID, nickName, avatarUrl) {
  const userRes = await db.collection('users').where({ _openid: OPENID }).get()

  if (userRes.data.length === 0) {
    try {
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
    } catch (addErr) {
      console.error('[login] 新建用户冲突，回退读已存在记录:', addErr)
    }
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

  const latestUserRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  return latestUserRes.data[0]
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { nickName, avatarUrl } = event
  const requestId = Date.now() + '-' + Math.random().toString(36).slice(2, 8)

  // 守卫：OPENID 缺失通常是微信会话失效（安卓偶发），此时不应创建脏记录，
  // 而是明确返回 NO_OPENID，让前端引导用户退出重进（等同于手动删除小程序重扫）。
  if (!OPENID) {
    console.error('[login] 缺失 OPENID，requestId=', requestId)
    return {
      success: false,
      code: 'NO_OPENID',
      message: '登录态失效，请退出小程序后重新进入再试'
    }
  }

  try {
    const userInfo = await upsertUser(OPENID, nickName, avatarUrl)
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
    console.error('[login] 失败 requestId=', requestId, 'err=', err)
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: '登录服务暂时不可用，请重试',
      requestId
    }
  }
}
