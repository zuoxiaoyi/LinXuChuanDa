Page({
  data: {
    countdown: 5,
    canSkip: true,
    skipStyle: 'top: 28rpx;',
    timer: null
  },

  onLoad() {
    this.setSkipPosition()
    this.startCountdown()
  },

  setSkipPosition() {
    try {
      const rect = wx.getMenuButtonBoundingClientRect()
      const windowWidth = wx.getWindowInfo?.().windowWidth || wx.getSystemInfoSync().windowWidth
      const top = Math.ceil((rect.bottom + 8) * 750 / windowWidth)
      this.setData({ skipStyle: `top: ${top}rpx;` })
    } catch (error) {
      this.setData({ skipStyle: 'top: 132rpx;' })
    }
  },

  startCountdown() {
    this.data.timer = setInterval(() => {
      const countdown = this.data.countdown - 1
      if (countdown <= 0) {
        this.goToIndex()
        return
      }
      this.setData({ countdown })
    }, 1000)
  },

  goToIndex() {
    this.clearTimer()
    wx.redirectTo({ url: '/pages/index/index' })
  },

  onSkip() {
    if (!this.data.canSkip) return
    this.goToIndex()
  },

  clearTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.data.timer = null
    }
  },

  onUnload() {
    this.clearTimer()
  }
})
