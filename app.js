/**
 * 灵序穿搭 - 小程序入口
 * 功能：初始化云开发环境、全局数据管理
 */
// 云开发初始化
const CLOUD_ENV = 'cloudbase-d7gr1giub2c847b49'

App({
  /** 全局数据 */
  globalData: {
    userInfo: null,    // 用户信息
    isLogin: false,    // 登录状态
    points: 0,         // 当前积分
    openid: '',        // 用户openid
    // 在公众平台创建激励视频广告位后填写，例如 adunit-xxxxxxxx
    rewardedVideoAdUnitId: ''
  },

  onLaunch() {
    // 初始化云开发（Skyline + 新版基础库适配）
    if (!wx.cloud) {
      console.warn('当前基础库不支持云能力，请升级至 2.2.3 以上')
      this.checkLoginStatus()
      return
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      })
      console.log('云环境初始化成功:', CLOUD_ENV)
    } catch (err) {
      console.error('云环境初始化异常:', err)
    }

    // 检查登录状态
    this.checkLoginStatus()

  },

  /** 检查本地登录状态 */
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLogin = true
    } else {
      this.globalData.userInfo = null
      this.globalData.isLogin = false
    }
  },

  /** 获取用户openid（调用云函数） */
  async getOpenid() {
    if (this.globalData.openid) return this.globalData.openid
    const res = await wx.cloud.callFunction({ name: 'login' })
    if (res.result) {
      this.globalData.openid = res.result.openid
      return res.result.openid
    }
    return ''
  }
})
