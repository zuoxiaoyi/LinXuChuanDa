const app = getApp()
const { normalizeRedirect } = require('../../utils/login-route')

Page({
  data: {
    canLogin: true,
    loading: false,
    error: '',
    redirectUrl: ''
  },

  onLoad(options = {}) {
    this._pageActive = true
    const redirectUrl = normalizeRedirect(options.redirect)
    this.setData({ redirectUrl })

    if (app.globalData.isLogin && app.globalData.userInfo) {
      this.completeLoginNavigation()
    }
  },

  onUnload() {
    this._pageActive = false
  },

  async onLogin() {
    if (!this.data.canLogin || this.data.loading) return

    this.setData({ loading: true, canLogin: false, error: '' })

    try {
      const profileRes = await wx.getUserProfile({
        desc: '用于完善会员资料与展示头像昵称'
      })
      const profile = profileRes.userInfo || {}
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName: profile.nickName,
          avatarUrl: profile.avatarUrl
        }
      })
      if (!loginRes.result?.success || !loginRes.result.userInfo) {
        throw new Error(loginRes.result?.message || '登录服务返回异常')
      }
      const result = loginRes.result

      const userInfo = {
        ...result.userInfo,
        nickName: result.userInfo.nickName || profile.nickName,
        avatarUrl: result.userInfo.avatarUrl || profile.avatarUrl
      }

      app.globalData.userInfo = userInfo
      app.globalData.isLogin = true
      app.globalData.openid = result.openid
      app.globalData.points = Number(result.points) || 0
      wx.setStorageSync('userInfo', userInfo)
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.completeLoginNavigation()
    } catch (err) {
      const errMessage = err?.errMsg || err?.message || ''
      const isCancel = /cancel|deny/i.test(errMessage)

      if (!isCancel && this._pageActive) {
        console.error('登录失败:', err)
        this.setData({ error: '登录失败，请检查网络后重试' })
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    } finally {
      if (this._pageActive) {
        this.setData({ loading: false, canLogin: true })
      }
    }
  },

  onSkip() {
    wx.reLaunch({ url: '/pages/index/index' })
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

  navigateBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
