const app = getApp()
const { normalizeRedirect } = require('../../utils/login-route')

// 云环境 ID（与 app.js 保持一致）。极端情况下 onLaunch 的 cloud.init 尚未就绪时用于兜底初始化。
const CLOUD_ENV = 'cloudbase-d7gr1giub2c847b49'

Page({
  data: {
    canLogin: true,
    loading: false,
    error: '',
    redirectUrl: '',
    // 头像昵称填写能力（选填，替代已废弃的 wx.getUserProfile）
    avatarUrl: '',
    nickName: ''
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

  // 选择头像：WebView 下 open-type="chooseAvatar" 弹出微信头像选择器，
  // 用户选择后通过 bind:chooseavatar 事件回传头像临时路径（e.detail.avatarUrl）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail || {}
    if (avatarUrl) this.setData({ avatarUrl })
  },

  // 昵称输入（type="nickname" 触发微信昵称填写能力）
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async onLogin() {
    if (!this.data.canLogin || this.data.loading) return

    this.setData({ loading: true, canLogin: false, error: '' })

    try {
      // 兜底：极少数情况下 onLaunch 的 cloud.init 尚未完成，这里确保云环境已就绪
      if (!wx.cloud || !wx.cloud.customEnv) {
        try { wx.cloud.init({ env: CLOUD_ENV, traceUser: true }) } catch (e) {}
      }

      // 静默登录：只换取 openid 与积分，不再调用已废弃的 wx.getUserProfile
      const loginRes = await this.callLoginWithRetry({})
      const result = loginRes.result || {}
      if (!result.success || !result.userInfo) {
        // 登录态失效（安卓偶发会话过期）：清掉本地残留并引导重进，等价于手动删除小程序重扫
        if (result.code === 'NO_OPENID') {
          this.handleStaleSession(result.message)
          return
        }
        throw new Error(result.message || '登录服务返回异常')
      }

      const userInfo = {
        ...result.userInfo,
        nickName: result.userInfo.nickName || '灵序用户',
        avatarUrl: result.userInfo.avatarUrl || ''
      }

      app.globalData.userInfo = userInfo
      app.globalData.isLogin = true
      app.globalData.openid = result.openid
      app.globalData.points = Number(result.points) || 0
      wx.setStorageSync('userInfo', userInfo)
      wx.showToast({ title: '登录成功', icon: 'success' })

      // 若用户填写了头像/昵称，则同步到云端（失败不影响登录主流程，但需提示）
      try {
        if (this.data.avatarUrl || this.data.nickName) {
          await this.saveProfile()
        }
      } catch (profileErr) {
        console.error('资料保存失败（不影响登录）:', profileErr)
        wx.showToast({ title: '资料同步失败，可稍后重试', icon: 'none' })
      }

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

  // 带重试的云函数登录调用：应对安卓上云函数冷启动/瞬时网络抖动造成的偶发失败
  // （一次失败后用户重扫往往就好，这里自动重试一次，多数情况自愈）。
  async callLoginWithRetry(data, retries = 1) {
    let lastErr = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await wx.cloud.callFunction({ name: 'login', data })
        // 云端明确返回了结果对象就视为成功通信，由调用方判断 success
        if (res && res.result) return res
        lastErr = new Error('云端返回空响应')
      } catch (callErr) {
        lastErr = callErr
        console.warn(`[login] 调用失败(第 ${attempt + 1} 次):`, callErr)
      }
    }
    throw lastErr
  },

  // 登录态失效（NO_OPENID）：清掉本地残留并引导用户退出重进，
  // 等价于手动"删除小程序重新扫码进入"，避免用户卡在失败态。
  handleStaleSession(message) {
    try { wx.removeStorageSync('userInfo') } catch (e) {}
    app.globalData.userInfo = null
    app.globalData.isLogin = false
    app.globalData.openid = ''
    if (!this._pageActive) return
    this.setData({ loading: false, canLogin: true, error: '' })
    wx.showModal({
      title: '登录态失效',
      content: (message || '登录态已失效') + '，请退出小程序后重新进入，即可恢复正常登录。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 将填写的头像/昵称上传并写入用户资料
  async saveProfile() {
    let avatarUrl = this.data.avatarUrl

    // 用户选择的头像为本地临时路径，需先上传到云存储得到可持久化的 fileID
    if (avatarUrl && !avatarUrl.startsWith('cloud://')) {
      try {
        const ext = (avatarUrl.match(/\.(\w+)$/) || [])[1] || 'png'
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/${app.globalData.openid || Date.now()}_${Date.now()}.${ext}`,
          filePath: avatarUrl
        })
        if (uploadRes.statusCode === 200 && uploadRes.fileID) {
          avatarUrl = uploadRes.fileID
        } else {
          avatarUrl = ''
        }
      } catch (uploadErr) {
        console.error('头像上传失败:', uploadErr)
        avatarUrl = ''
      }
    }

    const updateData = {}
    const nickName = (this.data.nickName || '').trim()
    if (nickName) updateData.nickName = nickName
    if (avatarUrl) updateData.avatarUrl = avatarUrl
    if (!Object.keys(updateData).length) return

    let res
    try {
      res = await this.callLoginWithRetry(updateData)
    } catch (callErr) {
      console.error('头像/昵称上报云端失败:', callErr)
      throw new Error('头像同步到云端失败')
    }
    if (res.result?.success && res.result.userInfo) {
      const merged = { ...app.globalData.userInfo, ...res.result.userInfo }
      app.globalData.userInfo = merged
      wx.setStorageSync('userInfo', merged)
    } else {
      console.error('头像/昵称上报返回异常:', res && res.result)
      throw new Error((res && res.result && res.result.message) || '头像同步到云端失败')
    }
  },

  onSkip() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onOpenLegal(event) {
    const type = event.currentTarget.dataset.type
    if (!type) return
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` })
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
