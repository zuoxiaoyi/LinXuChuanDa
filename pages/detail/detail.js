/**
 * 穿搭详情页
 * 功能：展示穿搭详情、广告解锁、积分解锁、收藏
 */
Page({
  data: {
    outfitId: '',          // 穿搭ID
    outfit: null,          // 穿搭详情数据
    isCollected: false,    // 是否已收藏
    isLocked: false,       // 是否锁定
    currentDateIndex: 0,   // 当前查看的日期索引
    loading: true          // 加载状态
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.setData({ outfitId: id })
      this.fetchDetail(id)
    }
  },

  /** 获取穿搭详情 */
  async fetchDetail(outfitId) {
    try {
      this.setData({ loading: true })
      const res = await wx.cloud.callFunction({
        name: 'getOutfitDetail',
        data: { outfitId }
      })

      if (res.result) {
        const { outfit, isCollected } = res.result
        this.setData({
          outfit,
          isCollected: !!isCollected,
          isLocked: outfit.isLocked || false
        })
      }
    } catch (err) {
      console.error('获取详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /** 收藏/取消收藏 */
  async onToggleCollect() {
    const { outfitId, isCollected } = this.data
    try {
      const res = await wx.cloud.callFunction({
        name: 'collectOutfit',
        data: {
          outfitId,
          action: isCollected ? 'cancel' : 'collect'
        }
      })

      if (res.result && res.result.success) {
        this.setData({ isCollected: !isCollected })
        wx.showToast({
          title: isCollected ? '已取消收藏' : '收藏成功',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('收藏操作失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /** 看广告解锁更多 */
  onWatchAd() {
    // TODO: 接入微信激励视频广告
    wx.showToast({ title: '广告功能即将上线', icon: 'none' })
  },

  /** 积分解锁 */
  async onUnlockByPoints() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'unlockOutfit',
        data: { outfitId: this.data.outfitId }
      })

      if (res.result && res.result.success) {
        this.setData({ isLocked: false })
        wx.showToast({ title: '解锁成功', icon: 'success' })
        // 刷新全局积分
        const app = getApp()
        app.globalData.points = res.result.remainPoints
      } else {
        wx.showToast({ title: res.result.msg || '积分不足', icon: 'none' })
      }
    } catch (err) {
      console.error('解锁失败:', err)
      wx.showToast({ title: '解锁失败', icon: 'none' })
    }
  },

  /** 切换日期查看 */
  onDateChange(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ currentDateIndex: index })
  }
})
