const app = getApp()
const { buildLoginUrl } = require('./login-route')

function isLoggedIn() {
  return !!(app.globalData.isLogin && app.globalData.userInfo)
}

function goToLogin(redirectUrl = '') {
  wx.navigateTo({ url: buildLoginUrl(redirectUrl) })
  return false
}

function requireLogin(message = '登录后才能使用该功能', redirectUrl = '') {
  if (isLoggedIn()) return true

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
