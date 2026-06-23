/**
 * 个人中心页
 * 功能：签到获取积分、查看收藏列表、积分展示
 */
const app = getApp()

Page({
  data: {
    userInfo: null,        // 用户信息
    points: 0,             // 当前积分
    todayChecked: false,   // 今日是否已签到
    collectedList: [],     // 收藏列表
    loading: true
  },

  onShow() {
    this.loadUserData()
  },

  /** 加载用户数据 */
  async loadUserData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserProfile'
      })

      if (res.result) {
        const { user, todayChecked, collections } = res.result
        this.setData({
          userInfo: user,
          points: user.points || 0,
          todayChecked: !!todayChecked,
          collectedList: collections || [],
          loading: false
        })

        // 更新全局数据
        app.globalData.points = user.points || 0
      }
    } catch (err) {
      console.error('加载用户数据失败:', err)
      this.setData({ loading: false })
    }
  },

  /** 每日签到 */
  async onCheckIn() {
    if (this.data.todayChecked) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'checkIn'
      })

      if (res.result && res.result.success) {
        const newPoints = res.result.points
        this.setData({
          todayChecked: true,
          points: newPoints
        })
        app.globalData.points = newPoints
        wx.showToast({ title: `签到成功 +${res.result.addPoints}积分`, icon: 'success' })
      }
    } catch (err) {
      console.error('签到失败:', err)
      wx.showToast({ title: '签到失败', icon: 'none' })
    }
  },

  /** 跳转登录 */
  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  /** 跳转穿搭详情 */
  onGoDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
