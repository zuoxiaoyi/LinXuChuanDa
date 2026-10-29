const app = getApp()
const { normalizeRedirect } = require('../../utils/login-route')

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

  // 选择头像：Skyline 下 open-type="chooseAvatar" 原生选择器不弹窗，
  // 改用 wx.chooseMedia（普通 JS API，Skyline/WebView 均可用），从相册/拍照获取
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (file && file.tempFilePath) {
          this.setData({ avatarUrl: file.tempFilePath })
        }
      },
      fail: () => {}
    })
  },

  // 昵称输入（type="nickname" 触发微信昵称填写能力）
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async onLogin() {
    if (!this.data.canLogin || this.data.loading) return

    this.setData({ loading: true, canLogin: false, error: '' })

    try {
      // 静默登录：只换取 openid 与积分，不再调用已废弃的 wx.getUserProfile
      const loginRes = await wx.cloud.callFunction({ name: 'login', data: {} })
      if (!loginRes.result?.success || !loginRes.result.userInfo) {
        throw new Error(loginRes.result?.message || '登录服务返回异常')
      }
      const result = loginRes.result

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

      // 若用户填写了头像/昵称，则同步到云端（失败不影响登录）
      try {
        if (this.data.avatarUrl || this.data.nickName) {
          await this.saveProfile()
        }
      } catch (profileErr) {
        console.error('资料保存失败（不影响登录）:', profileErr)
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

    const res = await wx.cloud.callFunction({ name: 'login', data: updateData })
    if (res.result?.success && res.result.userInfo) {
      const merged = { ...app.globalData.userInfo, ...res.result.userInfo }
      app.globalData.userInfo = merged
      wx.setStorageSync('userInfo', merged)
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
