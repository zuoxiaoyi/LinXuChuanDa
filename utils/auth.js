const app = getApp()
const { buildLoginUrl } = require('./login-route')
const { isSinglePageMode } = require('./share')

function isLoggedIn() {
  return !!(app.globalData.isLogin && app.globalData.userInfo)
}

function goToLogin(redirectUrl = '') {
  // 朋友圈「单页模式」（场景值 1154）下 wx.navigateTo 被微信禁用，且本地存储不共用、
  // 没有登录态。此时直接返回，让页面继续展示公开穿搭内容，避免卡在空白页。
  if (isSinglePageMode()) return false
  wx.navigateTo({ url: buildLoginUrl(redirectUrl) })
  return false
}

function requireLogin(message = '登录后才能使用该功能', redirectUrl = '') {
  if (isLoggedIn()) return true
  // 单页模式没有登录态也无法跳登录页，别弹一个点了没反应的对话框
  if (isSinglePageMode()) {
    wx.showToast({ title: '请在小程序内使用该功能', icon: 'none' })
    return false
  }

  wx.showModal({
    title: '需要登录',
    content: message,
    confirmText: '去登录',
    success(res) {
      if (res.confirm) {
        goToLogin(redirectUrl)
      }
    }
  })
  return false
}

module.exports = {
  isLoggedIn,
  goToLogin,
  requireLogin
}
