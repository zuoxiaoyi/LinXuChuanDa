/**
 * 小程序版本更新提示
 *
 * 微信在冷启动时会异步检查并下载新版本，但当前这次启动仍跑旧代码，
 * 老用户可能连续几次打开都还是旧版。这里在新版本下载完成后弹窗引导重启，
 * 让用户立刻切到新版；用户选「稍后再说」也没关系，下次冷启动微信会自动用新版。
 *
 * 依赖 wx.getUpdateManager（基础库 ≥ 1.9.90），低版本静默跳过不影响启动。
 * 开发版 / 体验版平台不会推送更新，因此不会误弹；开发者工具可用
 * 「编译模式 → 模拟更新」调试本流程。
 *
 * 参数 wxApi 便于注入 mock 做单测；不传时取全局 wx。
 */
function setupAppUpdate(wxApi) {
  const api = wxApi || (typeof wx !== 'undefined' ? wx : null)
  if (!api || typeof api.getUpdateManager !== 'function') return false

  const manager = api.getUpdateManager()
  if (!manager || typeof manager.onUpdateReady !== 'function') return false

  // 有新版时打一条日志，便于真机排查「为什么没弹窗」
  if (typeof manager.onCheckForUpdate === 'function') {
    manager.onCheckForUpdate(res => {
      if (res && res.hasUpdate) console.info('[app-update] 检测到新版本，正在下载')
    })
  }

  // 下载完成：由用户决定是否立刻重启，不做强制更新
  manager.onUpdateReady(() => {
    api.showModal({
      title: '发现新版本',
      content: '新版本已就绪，重启即可体验最新内容；也可以下次打开时自动更新。',
      confirmText: '立即重启',
      cancelText: '稍后再说',
      success: res => {
        if (res && res.confirm && typeof manager.applyUpdate === 'function') {
          manager.applyUpdate()
        }
      }
    })
  })

  // 下载失败：给可执行的兜底路径，而不是静默失败
  if (typeof manager.onUpdateFailed === 'function') {
    manager.onUpdateFailed(() => {
      api.showModal({
        title: '更新提示',
        content: '新版本下载失败，请检查网络后重启小程序重试；也可在微信中删除本小程序后重新搜索打开。',
        showCancel: false
      })
    })
  }

  return true
}

module.exports = { setupAppUpdate }
