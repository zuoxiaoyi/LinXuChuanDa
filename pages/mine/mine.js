const app = getApp()
const { isLoggedIn, requireLogin } = require('../../utils/auth')

Page({
  data: {
    userInfo: null,
    points: 0,
    todayChecked: false,
    todayBonusClaimed: false,
    collectedList: [],
    loading: false,
    error: '',
    isLogin: false,
    introText: '灵序穿搭，融合东方天时五行智慧与现代穿搭美学，以风水能量调和个人磁场，用专业色彩美学塑造独特气质。团队汇聚二十年资深服装设计师、深耕传统文化的985硕士、专业技术工程师与新锐运营人才，致力于让每一套穿搭，都成为你提升运势、绽放气场的能量载体。'
  },

  onLoad() {
    this.initRewardedVideoAd()
  },

  onUnload() {
    if (!this.rewardedVideoAd) return
    if (this.handleAdClose) this.rewardedVideoAd.offClose(this.handleAdClose)
    if (this.handleAdError) this.rewardedVideoAd.offError(this.handleAdError)
  },

  onShow() {
    const loggedIn = isLoggedIn()
    this.setData({
      isLogin: loggedIn,
      userInfo: loggedIn ? app.globalData.userInfo : null
    })
    if (loggedIn) {
      this.loadUserData()
    } else {
      this.setData({
        userInfo: null,
        points: 0,
        todayChecked: false,
        todayBonusClaimed: false,
        collectedList: [],
        loading: false,
        error: ''
      })
    }
  },

  async loadUserData() {
    this.setData({ loading: true, error: '' })
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserProfile' })
      const result = res.result || {}
      const user = result.user

      if (!user) {
        throw new Error('用户资料不存在')
      }

      this.setData({
        userInfo: user,
        points: user.points || 0,
        todayChecked: !!result.todayChecked,
        todayBonusClaimed: !!result.todayBonusClaimed,
        collectedList: result.collections || []
      })

      app.globalData.points = user.points || 0
      app.globalData.userInfo = {
        nickName: user.nickName,
        avatarUrl: user.avatarUrl
      }
      wx.setStorageSync('userInfo', app.globalData.userInfo)
    } catch (err) {
      console.error('加载用户数据失败:', err)
      this.setData({ error: '个人资料加载失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onCheckIn() {
    if (!requireLogin('登录后才能签到领取积分')) return
    if (this.data.todayChecked) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'checkIn' })
      const result = res.result || {}
      if (result.success) {
        this.setData({
          todayChecked: true,
          todayBonusClaimed: false,
          points: result.points
        })
        app.globalData.points = result.points
        this.showBonusOffer()
      } else {
        if (result.alreadyChecked) {
          this.setData({
            todayChecked: true,
            todayBonusClaimed: !!result.bonusClaimed
          })
        }
        wx.showToast({ title: result.msg || '签到失败', icon: 'none' })
      }
    } catch (err) {
      console.error('签到失败:', err)
      wx.showToast({ title: '签到失败，请重试', icon: 'none' })
    }
  },

  showBonusOffer() {
    wx.showModal({
      title: '签到成功 +1积分',
      content: '观看一段激励视频，可随机获得2～5倍签到积分。倍数越高，抽中概率越低。',
      cancelText: '暂不翻倍',
      confirmText: '看广告翻倍',
      success: ({ confirm }) => {
        if (confirm) this.onWatchCheckInAd()
      }
    })
  },

  initRewardedVideoAd() {
    const adUnitId = app.globalData.rewardedVideoAdUnitId
    if (!adUnitId || !wx.createRewardedVideoAd) return

    this.rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId })
    this.handleAdClose = (res) => {
      if (res === undefined || res.isEnded) {
        this.claimCheckInBonus()
      } else {
        wx.showToast({ title: '完整观看广告后才能翻倍', icon: 'none' })
      }
    }
    this.handleAdError = (err) => {
      console.error('激励视频加载失败:', err)
      wx.showToast({ title: '广告暂不可用，请稍后再试', icon: 'none' })
    }
    this.rewardedVideoAd.onClose(this.handleAdClose)
    this.rewardedVideoAd.onError(this.handleAdError)
  },

  async onWatchCheckInAd() {
    if (!requireLogin('登录后才能领取签到翻倍奖励')) return
    if (!this.data.todayChecked) {
      wx.showToast({ title: '请先完成今日签到', icon: 'none' })
      return
    }
    if (this.data.todayBonusClaimed) {
      wx.showToast({ title: '今日翻倍奖励已领取', icon: 'none' })
      return
    }
    if (!this.rewardedVideoAd) {
      wx.showModal({
        title: '广告位尚未配置',
        content: '签到抽奖算法已经接入。配置微信激励视频广告位ID后即可完整观看并领取奖励。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    try {
      await this.rewardedVideoAd.show()
    } catch (err) {
      try {
        await this.rewardedVideoAd.load()
        await this.rewardedVideoAd.show()
      } catch (loadErr) {
        console.error('激励视频展示失败:', loadErr)
        wx.showToast({ title: '广告暂不可用，请稍后再试', icon: 'none' })
      }
    }
  },

  async claimCheckInBonus() {
    try {
      wx.showLoading({ title: '领取奖励' })
      const res = await wx.cloud.callFunction({
        name: 'checkIn',
        data: { action: 'claimAdBonus' }
      })
      const result = res.result || {}
      if (!result.success) {
        if (result.alreadyClaimed) {
          this.setData({ todayBonusClaimed: true })
        }
        wx.showToast({ title: result.msg || '奖励领取失败', icon: 'none' })
        return
      }

      this.setData({
        points: result.points,
        todayBonusClaimed: true
      })
      app.globalData.points = result.points
      wx.showModal({
        title: `抽中${result.multiplier}倍积分`,
        content: `额外获得${result.bonusPoints}积分，今日签到共获得${result.totalAwardPoints}积分。`,
        showCancel: false,
        confirmText: '收下积分'
      })
    } catch (err) {
      console.error('领取签到翻倍奖励失败:', err)
      wx.showToast({ title: '奖励领取失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onGoDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onRetry() {
    this.loadUserData()
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除云端收藏和积分记录。',
      success: ({ confirm }) => {
        if (!confirm) return
        wx.removeStorageSync('userInfo')
        app.globalData.userInfo = null
        app.globalData.isLogin = false
        app.globalData.openid = ''
        app.globalData.points = 0
        this.onShow()
      }
    })
  }
})
