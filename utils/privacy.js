/**
 * 隐私合规工具
 * 微信要求：在调用涉及用户隐私的接口（如 wx.getLocation）前，
 * 必须先完成隐私协议授权。本工具在需要时弹出系统隐私授权窗口。
 *
 * 依赖基础库 API（以微信官方最新文档为准）：
 * - wx.getPrivacySetting（基础库 ≥ 2.32.3）查询是否需要授权
 * - wx.requirePrivacyAuthorize（基础库 ≥ 2.32.3）弹出授权窗口
 * 旧版本基础库不支持时直接放行，不影响功能。
 */

function ensurePrivacyAuthorize() {
  return new Promise(resolve => {
    if (typeof wx.getPrivacySetting !== 'function') {
      resolve(false)
      return
    }
    wx.getPrivacySetting({
      success: res => {
        if (res && res.needAuthorization) {
          if (typeof wx.requirePrivacyAuthorize === 'function') {
            wx.requirePrivacyAuthorize({
              success: () => resolve(true),
              fail: () => resolve(false),
              complete: () => resolve(true)
            })
          } else {
            resolve(false)
          }
        } else {
          resolve(true)
        }
      },
      fail: () => resolve(false)
    })
  })
}

module.exports = {
  ensurePrivacyAuthorize
}
