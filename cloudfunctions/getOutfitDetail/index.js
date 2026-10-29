/**
 * 云函数 - getOutfitDetail
 * 功能：获取穿搭详情，同时判断当前用户是否已收藏
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
// Skyline 下 <image> 不支持 cloud://，返回前统一换成 https 临时链接
const { resolveImages } = require('./cloud-urls')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { outfitId } = event

  try {
    // 查询穿搭详情
    const outfitRes = await db.collection('outfits')
      .doc(outfitId)
      .get()

    if (!outfitRes.data) {
      return { outfit: null, isCollected: false }
    }

    // 判断是否已收藏
    const collectRes = await db.collection('collections').where({
      _openid: OPENID,
      outfitId: outfitId
    }).get()

    return {
      outfit: await resolveImages(outfitRes.data),
      isCollected: collectRes.data.length > 0
    }
  } catch (err) {
    console.error('获取详情失败:', err)
    return { outfit: null, isCollected: false }
  }
}
