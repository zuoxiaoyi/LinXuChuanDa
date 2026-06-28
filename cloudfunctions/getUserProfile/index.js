/**
 * 云函数 - getUserProfile
 * 功能：获取用户资料、积分、签到状态、收藏列表
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`

  try {
    // 查询用户信息
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()

    const user = userRes.data[0] || null

    // 查询今日是否已签到
    const checkinRes = await db.collection('checkins').where({
      _openid: OPENID,
      date: todayStr
    }).get()

    // 查询收藏列表（关联穿搭数据）
    const collectRes = await db.collection('collections').where({
      _openid: OPENID
    }).orderBy('createTime', 'desc').get()

    // 提取收藏的穿搭ID列表并查询穿搭信息
    const outfitIds = collectRes.data.map(item => item.outfitId)
    let collections = []
    if (outfitIds.length > 0) {
      const outfitsRes = await db.collection('outfits').where({
        _id: db.command.in(outfitIds)
      }).field({
        title: true,
        coverUrl: true,
        tags: true
      }).get()
      collections = outfitsRes.data
    }

    return {
      user,
      todayChecked: checkinRes.data.length > 0,
      todayBonusClaimed: checkinRes.data.length > 0
        ? !!checkinRes.data[0].bonusClaimed
        : false,
      collections
    }
  } catch (err) {
    console.error('获取用户资料失败:', err)
    return {
      user: null,
      todayChecked: false,
      todayBonusClaimed: false,
      collections: []
    }
  }
}
