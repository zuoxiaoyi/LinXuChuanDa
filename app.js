/**
 * 灵序穿搭 - 小程序入口
 * 功能：初始化云开发环境、全局数据管理
 */
// 云开发初始化
// 注意：env 参数需替换为你的云环境ID
const CLOUD_ENV = 'cloudbase-d7gr1giub2c847b49' // TODO: 替换为实际云环境ID

App({
  /** 全局数据 */
  globalData: {
    userInfo: null,    // 用户信息
    isLogin: false,    // 登录状态
    points: 0,         // 当前积分
    openid: ''         // 用户openid
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

    // 【临时】首次启动自动填充测试数据（仅执行一次）
    this.seedDataOnce()
  },

  /**
   * 【临时函数】首次启动自动调用 seedOutfits 填充测试数据
   * 数据插入成功后会在本地标记，后续不再重复执行
   * 正式上线前请删除此函数及其调用
   */
  seedDataOnce() {
    const seeded = wx.getStorageSync('_seed_done')
    if (seeded) return

    wx.cloud.callFunction({ name: 'seedOutfits' }).then(res => {
      if (res.result && res.result.success) {
        wx.setStorageSync('_seed_done', true)
        console.log('测试数据填充成功:', res.result.count, '条')
      }
    }).catch(err => {
      console.warn('测试数据填充失败（可能已存在数据）:', err.message)
    })
  },

  /** 检查本地登录状态 */
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLogin = true
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
