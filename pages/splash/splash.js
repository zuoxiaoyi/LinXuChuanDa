/**
 * 开屏广告页
 * 功能：全屏背景图 + 5s倒计时自动跳转 + 点击跳过
 * 原型设计：古风人物背景 + 底部标题 + 右上跳过按钮
 * 图片暂用本地路径（云环境timeout问题修复后再切换云存储）
 */
Page({
  data: {
    countdown: 5,        // 倒计时秒数
    canSkip: false,      // 是否可跳过（从第1秒起即可点击）
    timer: null          // 定时器引用
  },

  onLoad() {
    this.startCountdown()
  },

  /** 启动倒计时，每秒递减 */
  startCountdown() {
    this.data.timer = setInterval(() => {
      const countdown = this.data.countdown - 1
      if (countdown <= 0) {
        this.goToIndex()
        return
      }
      this.setData({ countdown, canSkip: true })
    }, 1000)
  },

  /** 跳转首页 */
  goToIndex() {
    this.clearTimer()
    wx.redirectTo({ url: '/pages/index/index' })
  },

  /** 点击跳过按钮 */
  onSkip() {
    if (!this.data.canSkip) return
    this.goToIndex()
  },

  /** 清除定时器，防止内存泄漏 */
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
