const app = getApp()

function isLoggedIn() {
  return !!(app.globalData.isLogin && app.globalData.userInfo)
}

function requireLogin(message = '登录后才能使用该功能', redirectUrl = '') {
  if (isLoggedIn()) return true

  wx.showModal({
    title: '需要登录',
    content: message,
    confirmText: '去登录',
    success(res) {
      if (res.confirm) {
        const redirect = redirectUrl
          ? `?redirect=${encodeURIComponent(redirectUrl)}`
          : ''
        wx.navigateTo({ url: `/pages/login/login${redirect}` })
      }
    }
  })
  return false
}

module.exports = {
  isLoggedIn,
  requireLogin
}
