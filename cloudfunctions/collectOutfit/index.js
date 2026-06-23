/**
 * 云函数 - collectOutfit
 * 功能：收藏/取消收藏穿搭
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { outfitId, action } = event // action: 'collect' | 'cancel'

  try {
    if (action === 'collect') {
      // 收藏：先检查是否已收藏
      const existRes = await db.collection('collections').where({
        _openid: OPENID,
        outfitId
      }).get()

      if (existRes.data.length > 0) {
        return { success: true, msg: '已收藏' }
      }

      await db.collection('collections').add({
        data: {
          _openid: OPENID,
          outfitId,
          createTime: db.serverDate()
        }
      })
    } else {
      // 取消收藏
      await db.collection('collections').where({
        _openid: OPENID,
        outfitId
      }).remove()
    }

    return { success: true }
  } catch (err) {
    console.error('收藏操作失败:', err)
    return { success: false, msg: '操作失败' }
  }
}
