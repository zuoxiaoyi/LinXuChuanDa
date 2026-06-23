/**
 * 首页 - 穿搭瀑布流展示
 * 功能：穿搭列表展示、下拉刷新、上拉加载更多、跳转详情
 */
Page({
  data: {
    outfitList: [],       // 穿搭列表数据
    page: 1,              // 当前页码
    pageSize: 10,         // 每页数量
    hasMore: true,        // 是否有更多数据
    loading: false,       // 加载状态
    refreshing: false     // 下拉刷新状态
  },

  onLoad() {
    this.fetchOutfits()
  },

  /** 获取穿搭列表 */
  async fetchOutfits(isRefresh = false) {
    if (this.data.loading) return

    const page = isRefresh ? 1 : this.data.page
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getOutfits',
        data: { page, pageSize: this.data.pageSize }
      })

      console.log('getOutfits 返回:', JSON.stringify(res))

      if (res.result) {
        const { list, hasMore, total } = res.result
        console.log(`穿搭数据: ${list ? list.length : 0} 条, 总计: ${total}, hasMore: ${hasMore}`)
        this.setData({
          outfitList: isRefresh ? list : [...this.data.outfitList, ...list],
          page: page + 1,
          hasMore: !!hasMore,
          loading: false,
          refreshing: false
        })
      } else {
        console.warn('getOutfits 返回空 result')
        this.setData({ loading: false, refreshing: false, hasMore: false })
      }
    } catch (err) {
      console.error('获取穿搭列表失败:', err)
      this.setData({ loading: false, refreshing: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /** 下拉刷新 */
  onRefresh() {
    this.setData({ refreshing: true })
    this.fetchOutfits(true)
  },

  /** 上拉加载更多 */
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.fetchOutfits()
  },

  /** 跳转穿搭详情 */
  onGoDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
