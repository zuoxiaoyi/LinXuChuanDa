/**
 * 云函数 - getOutfits
 * 功能：分页获取穿搭列表（首页瀑布流）
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { page = 1, pageSize = 10 } = event

  try {
    // 分页查询穿搭列表
    const result = await db.collection('outfits')
      .field({
        title: true,
        coverUrl: true,
        tags: true,
        isLocked: true,
        createTime: true
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 判断是否还有更多数据
    const totalRes = await db.collection('outfits').count()
    const hasMore = (page - 1) * pageSize + result.data.length < totalRes.total

    return {
      list: result.data,
      hasMore,
      total: totalRes.total
    }
  } catch (err) {
    console.error('获取穿搭列表失败:', err)
    return { list: [], hasMore: false }
  }
}
