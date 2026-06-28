const { isLoggedIn, requireLogin } = require('../../utils/auth')

const SCENES = ['通勤', '休闲', '度假', '约会', '日常', '轻运动']
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    dateIndex: 0,
    dateText: '',
    bestList: [],
    secondList: [],
    accessories: [
      { id: 'wood', name: '黄水晶', description: '温暖明亮', symbol: '💎' },
      { id: 'bracelet', name: '蜜蜡手串', description: '柔和沉稳', symbol: '📿' },
      { id: 'jade', name: '和田玉镯', description: '清雅温润', symbol: '◯' }
    ],
    collectingId: '',
    loading: true,
    error: ''
  },

  onLoad(options) {
    const dateIndex = Math.max(0, Math.min(2, Number(options.dateIndex) || 0))
    const redirectUrl = `/pages/detail/detail?dateIndex=${dateIndex}`
    if (!isLoggedIn()) {
      this.setData({ loading: false })
      requireLogin('登录后才能查看完整穿搭详情', redirectUrl)
      return
    }

    const date = new Date()
    date.setDate(date.getDate() + dateIndex)
    this.setData({
      dateIndex,
      dateText: `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`
    })
    this.loadDailyOutfits()
  },

  async loadDailyOutfits() {
    this.setData({ loading: true, error: '' })
    try {
      const [outfitRes, profileRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getOutfits',
          data: { page: 1, pageSize: 6 }
        }),
        wx.cloud.callFunction({ name: 'getUserProfile' })
      ])

      const outfitList = outfitRes.result && Array.isArray(outfitRes.result.list)
        ? outfitRes.result.list
        : []
      const collections = profileRes.result && Array.isArray(profileRes.result.collections)
        ? profileRes.result.collections
        : []
      const collectedIds = new Set(collections.map(item => item._id))
      const offset = outfitList.length ? this.data.dateIndex % outfitList.length : 0
      const orderedList = outfitList.map((item, index) => {
        const source = outfitList[(index + offset) % outfitList.length]
        return {
          ...source,
          sceneName: SCENES[index],
          isCollected: collectedIds.has(source._id)
        }
      })

      this.setData({
        bestList: orderedList.slice(0, 3),
        secondList: orderedList.slice(3, 6)
      })
    } catch (err) {
      console.error('加载每日穿搭详情失败:', err)
      this.setData({ error: '穿搭详情加载失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onToggleCollect(e) {
    if (!requireLogin('登录后才能收藏单套穿搭')) return
    const outfitId = e.currentTarget.dataset.id
    const target = [...this.data.bestList, ...this.data.secondList]
      .find(item => item._id === outfitId)
    if (!target || this.data.collectingId) return

    this.setData({ collectingId: outfitId })
    try {
      const res = await wx.cloud.callFunction({
        name: 'collectOutfit',
        data: {
          outfitId,
          action: target.isCollected ? 'cancel' : 'collect'
        }
      })

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.msg) || '收藏失败')
      }

      const updateList = list => list.map(item => (
        item._id === outfitId
          ? { ...item, isCollected: !item.isCollected }
          : item
      ))
      this.setData({
        bestList: updateList(this.data.bestList),
        secondList: updateList(this.data.secondList)
      })
      wx.showToast({
        title: target.isCollected ? '已取消收藏' : '收藏成功',
        icon: 'success'
      })
    } catch (err) {
      console.error('收藏操作失败:', err)
      wx.showToast({ title: err.message || '收藏失败', icon: 'none' })
    } finally {
      this.setData({ collectingId: '' })
    }
  },

  onRetry() {
    this.loadDailyOutfits()
  }
})
