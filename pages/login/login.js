/**
 * 登录页
 * 功能：微信一键授权登录，获取用户头像昵称
 */
// 获取全局应用实例
const app = getApp()

Page({
  data: {
    canLogin: true,       // 是否可点击登录
    loading: false,       // 加载状态
    avatarUrl: '',        // 默认头像
    nickName: '',         // 默认昵称
    error: '',
    redirectUrl: ''
  },

  onLoad(options) {
    let redirectUrl = ''
    if (options.redirect) {
      try {
        const decoded = decodeURIComponent(options.redirect)
        if (decoded.startsWith('/pages/')) redirectUrl = decoded
      } catch (err) {
        console.warn('登录回跳地址解析失败:', err)
      }
    }
    this.setData({ redirectUrl })

    if (app.globalData.isLogin) {
      this.completeLoginNavigation()
    }
  },

  /** 一键微信登录 */
  async onLogin() {
    if (!this.data.canLogin || this.data.loading) return

    this.setData({ loading: true, canLogin: false, error: '' })

    try {
      // 1. 获取微信用户头像昵称（新版API需用户主动选择）
      const profileRes = await wx.getUserProfile({
        desc: '用于展示个人资料'
      })

      const userInfo = profileRes.userInfo

      // 2. 调用云函数登录/注册
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      })

      // 3. 存储用户信息
      if (loginRes.result) {
        app.globalData.userInfo = userInfo
        app.globalData.isLogin = true
        app.globalData.openid = loginRes.result.openid
        app.globalData.points = loginRes.result.points || 0

        wx.setStorageSync('userInfo', userInfo)

        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => this.completeLoginNavigation(), 800)
      }
    } catch (err) {
      console.error('登录失败:', err)
      const isCancel = err && /cancel|deny/i.test(err.errMsg || '')
      this.setData({
        error: isCancel ? '' : '登录失败，请检查网络后重试'
      })
      if (!isCancel) {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ loading: false, canLogin: true })
    }
  },

  /** 跳过登录（游客模式） */
  onSkip() {
    this.navigateBack()
  },

  completeLoginNavigation() {
    if (this.data.redirectUrl) {
      wx.redirectTo({
        url: this.data.redirectUrl,
        fail: () => wx.reLaunch({ url: '/pages/index/index' })
      })
      return
    }
    this.navigateBack()
  },

  /** 返回上一页 */
  navigateBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  }
})
