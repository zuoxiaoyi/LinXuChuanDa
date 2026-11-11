const app = getApp()
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toDisplayUrl, safePlaceholder, isDefaultWxAvatar } = require('../../utils/cloudfile')
const { withShare, isSinglePageMode } = require('../../utils/share')

Page(withShare({
  data: {
    userInfo: null,
    points: 0,
    todayChecked: false,
    todayBonusClaimed: false,
    streakCount: 0,
    canMakeUp: false,
    collectedList: [],
    loading: false,
    error: '',
    isLogin: false,
    dockVisible: false,
    dockThreshold: 0,
    dockTop: 0,
    // scroll-top 只用于「返回时被意外归零」的兜底恢复，平时不随滚动 setData
    scrollTop: 0,
    introText: '灵序穿搭，融合东方天时五行智慧与现代穿搭美学，以风水能量调和个人磁场，用专业色彩美学塑造独特气质。团队汇聚二十年资深服装设计师、深耕传统文化的985硕士、专业技术工程师与新锐运营人才，致力于让每一套穿搭，都成为你提升运势、绽放气场的能量载体。'
  },

  onLoad() {
    this.profileLoaded = false
    this.lastScrollTop = 0
    this.savedScrollTop = 0
    this.initRewardedVideoAd()
  },

  onReady() {
    this.measureDock()
  },

  /**
   * 进入详情页时锁住当前滚动位置。
   * 返回后 onShow 会刷新数据，若刷新触发了 scroll 事件，lastScrollTop 可能被写成 0，
   * 所以恢复必须用 onHide 时冻结下来的 savedScrollTop，而不是实时的 lastScrollTop。
   */
  onHide() {
    if (typeof this.lastScrollTop === 'number') this.savedScrollTop = this.lastScrollTop
  },

  // 量「积分卡底边」在 scroll-view 内容坐标系里的绝对位置。
  // boundingClientRect 相对视口，需加上当前 scrollTop、减去滚动容器视口 top，
  // 这样得到的阈值与机型、rpx 换算无关。
  measureDock() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#dockAnchor').boundingClientRect()
    query.select('.page-scroll').boundingClientRect()
    query.select('.page-scroll').scrollOffset()
    query.exec((res) => {
      const [anchor, scroller, offset] = res || []
      if (!anchor || !scroller || !offset) return
      const threshold = Math.max(0, offset.scrollTop + anchor.top - scroller.top)
      this.setData({
        dockThreshold: threshold,
        dockTop: scroller.top
      })
    })
  },

  // 滚过阈值 → 刘海浮出；反向滚回阈值下方（留 16px 滞回防抖）→ 刘海消失。
  // 头部固定后收藏内容仍由同一个 scroll-view 滚动，即「局部滚动」的效果，
  // 不引入嵌套 scroll-view，避免小程序滚动手势互相抢锁。
  onScroll(e) {
    const scrollTop = e.detail.scrollTop || 0
    this.lastScrollTop = scrollTop
    const threshold = this.data.dockThreshold
    if (!threshold) return
    const visible = this.data.dockVisible
      ? scrollTop >= threshold - 16
      : scrollTop >= threshold
    if (visible !== this.data.dockVisible) this.setData({ dockVisible: visible })
  },

  noop() {},

  onUnload() {
    if (!this.rewardedVideoAd) return
    if (this.handleAdClose) this.rewardedVideoAd.offClose(this.handleAdClose)
    if (this.handleAdError) this.rewardedVideoAd.offError(this.handleAdError)
  },

  onShow() {
    const loggedIn = isLoggedIn()
    // 本地缓存里的 avatarUrl 可能是 cloud://（Skyline 下 <image> 无法显示），
    // 首屏先回退到内置占位头像，等 loadUserData 换到 https 临时链接后再刷新
    const cached = loggedIn ? app.globalData.userInfo : null
    this.setData({
      isLogin: loggedIn,
      userInfo: cached
        ? {
            ...cached,
            avatarUrl: safePlaceholder(cached.avatarUrl, '/images/icons/user.png')
          }
        : null
    })
    if (loggedIn) {
      // 已渲染过一次就静默刷新：不切 loading 态、不卸载收藏列表 DOM，
      // 从详情页返回时 scroll-view 的滚动位置会自然保留，也不会有「重新加载」的转圈。
      this.loadUserData({ silent: !!this.profileLoaded })
    } else {
      this.profileLoaded = false
      this.lastScrollTop = 0
      this.savedScrollTop = 0
      this.setData({
        userInfo: null,
        points: 0,
        todayChecked: false,
        todayBonusClaimed: false,
        collectedList: [],
        loading: false,
        error: '',
        dockVisible: false,
        scrollTop: 0
      }, () => this.measureDock())
    }
  },

  async loadUserData({ silent = false } = {}) {
    if (!silent) this.setData({ loading: true, error: '' })
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserProfile' })
      const result = res.result || {}
      const user = result.user

      if (!user) {
        throw new Error('用户资料不存在')
      }

      // Skyline 下 <image> 不支持 cloud://，统一换成 https 临时链接；
      // 微信默认头像（qlogo.cn）视为无自定义头像，直接回退本地占位图，避免依赖外部域名白名单
      const avatarUrl = isDefaultWxAvatar(user.avatarUrl)
        ? ''
        : await toDisplayUrl(user.avatarUrl)
      const displayUser = {
        ...user,
        avatarUrl: avatarUrl || '/images/icons/user.png'
      }

      this.setData({
        userInfo: displayUser,
        points: user.points || 0,
        todayChecked: !!result.todayChecked,
        todayBonusClaimed: !!result.todayBonusClaimed,
        streakCount: result.streakCount || 0,
        canMakeUp: !!result.canMakeUp,
        collectedList: result.collections || []
      }, () => this.measureDock())
      this.profileLoaded = true

      app.globalData.points = user.points || 0
      app.globalData.userInfo = {
        nickName: user.nickName,
        avatarUrl: user.avatarUrl // 存原始值（cloud:// 或 http），展示时再转换
      }
      wx.setStorageSync('userInfo', app.globalData.userInfo)
    } catch (err) {
      console.error('加载用户数据失败:', err)
      if (silent) {
        // 静默刷新失败就沿用上一屏内容，绝不切到错误卡片把收藏列表卸载掉
        console.warn('[mine] 静默刷新失败，保留上次资料与滚动位置')
      } else {
        this.setData({ error: '个人资料加载失败，请稍后重试' })
      }
    } finally {
      if (!silent) this.setData({ loading: false }, () => this.measureDock())
      // 兜底：万一内容重排把滚动位置顶回 0，用离开前冻结的位置恢复
      wx.nextTick(() => this.restoreScrollPosition())
    }
  },

  restoreScrollPosition() {
    const target = this.savedScrollTop || 0
    if (target <= 0) return
    const query = wx.createSelectorQuery().in(this)
    query.select('.page-scroll').scrollOffset()
    query.exec(res => {
      const current = (res && res[0] && res[0].scrollTop) || 0
      if (target - current <= 8) return
      // scroll-top 只在值变化时生效；连续两次返回且目标相同，用 0.5px 抖动触发
      const next = Number(this.data.scrollTop) === target ? target - 0.5 : target
      this.setData({ scrollTop: next })
    })
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
          points: result.points,
          streakCount: result.streakCount || this.data.streakCount + 1
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
    // 朋友圈单页模式禁用 wx.createRewardedVideoAd
    if (isSinglePageMode()) return
    const adUnitId = app.globalData.rewardedVideoAdUnitId
    if (!adUnitId || !wx.createRewardedVideoAd) return

    this.rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId })
    this.handleAdClose = (res) => {
      if (res === undefined || res.isEnded) {
        if (this.pendingAdAction === 'makeup') {
          this.claimMakeUp()
        } else {
          this.claimCheckInBonus()
        }
      } else {
        wx.showToast({ title: '完整观看广告后才能领取', icon: 'none' })
      }
      this.pendingAdAction = ''
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
    this.pendingAdAction = 'bonus'
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

  // 头像 https 链接加载失败时回退本地占位图，避免裂图
  onAvatarError() {
    if (this.data.userInfo && this.data.userInfo.avatarUrl) {
      this.setData({ 'userInfo.avatarUrl': '/images/icons/user.png' })
    }
  },

  async onMakeUpCheckIn() {
    if (!requireLogin('登录后才能补签')) return
    if (!this.data.canMakeUp) {
      wx.showToast({ title: '暂无可补签日期', icon: 'none' })
      return
    }
    if (!this.rewardedVideoAd) {
      wx.showModal({
        title: '广告位尚未配置',
        content: '补签功能已接入，配置微信激励视频广告位 ID 后即可观看并补签昨日。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    this.pendingAdAction = 'makeup'
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

  async claimMakeUp() {
    try {
      wx.showLoading({ title: '补签中' })
      const res = await wx.cloud.callFunction({
        name: 'checkIn',
        data: { action: 'makeUpCheckIn' }
      })
      const result = res.result || {}
      if (!result.success) {
        wx.showToast({ title: result.msg || '补签失败', icon: 'none' })
        return
      }
      this.setData({
        points: result.points,
        streakCount: result.streakCount,
        canMakeUp: false
      })
      app.globalData.points = result.points
      wx.showModal({
        title: '补签成功',
        content: `已补签 ${result.madeUpDate}，连续签到 ${result.streakCount} 天，获得 ${result.addPoints} 积分。`,
        showCancel: false,
        confirmText: '好的'
      })
    } catch (err) {
      console.error('补签失败:', err)
      wx.showToast({ title: '补签失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
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
        this.profileLoaded = false
        this.lastScrollTop = 0
        this.savedScrollTop = 0
        this.onShow()
      }
    })
  }
}))
