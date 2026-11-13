const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const { setupAppUpdate } = require(join(root, 'utils', 'app-update.js'))

/** 构造可注入的 wx mock，收集回调与弹窗参数 */
function createMock() {
  const handlers = {}
  const modals = []
  let applied = 0
  const manager = {
    onCheckForUpdate: fn => { handlers.check = fn },
    onUpdateReady: fn => { handlers.ready = fn },
    onUpdateFailed: fn => { handlers.failed = fn },
    applyUpdate: () => { applied += 1 }
  }
  const api = {
    getUpdateManager: () => manager,
    showModal: opts => { modals.push(opts) }
  }
  return {
    api, handlers, modals,
    get applied() { return applied },
    confirm() {
      const modal = modals[modals.length - 1]
      if (modal && modal.success) modal.success({ confirm: true })
    },
    cancel() {
      const modal = modals[modals.length - 1]
      if (modal && modal.success) modal.success({ confirm: false })
    }
  }
}

test('低版本基础库没有 getUpdateManager 时静默跳过', () => {
  assert.equal(setupAppUpdate({ showModal() {} }), false)
  assert.equal(setupAppUpdate(null), false)
})

test('getUpdateManager 返回异常对象时也不抛错', () => {
  assert.equal(setupAppUpdate({ getUpdateManager: () => null }), false)
  assert.equal(setupAppUpdate({ getUpdateManager: () => ({}) }), false)
})

test('新版本下载完成后弹窗，文案与按钮符合非强制更新', () => {
  const m = createMock()
  assert.equal(setupAppUpdate(m.api), true)
  assert.equal(typeof m.handlers.ready, 'function')
  assert.equal(typeof m.handlers.failed, 'function')

  m.handlers.ready()
  assert.equal(m.modals.length, 1)
  assert.match(m.modals[0].title, /新版本/)
  assert.match(m.modals[0].content, /下次打开时自动更新/)
  assert.equal(m.modals[0].confirmText, '立即重启')
  assert.equal(m.modals[0].cancelText, '稍后再说')
})

test('用户确认才 applyUpdate，选「稍后再说」不强制重启', () => {
  const confirmed = createMock()
  setupAppUpdate(confirmed.api)
  confirmed.handlers.ready()
  confirmed.confirm()
  assert.equal(confirmed.applied, 1)

  const cancelled = createMock()
  setupAppUpdate(cancelled.api)
  cancelled.handlers.ready()
  cancelled.cancel()
  assert.equal(cancelled.applied, 0)
})

test('仅检测到更新（下载未完成）时不打扰用户', () => {
  const m = createMock()
  setupAppUpdate(m.api)
  m.handlers.check({ hasUpdate: true })
  m.handlers.check({ hasUpdate: false })
  assert.equal(m.modals.length, 0)
})

test('下载失败给出可执行的兜底提示，且不可取消', () => {
  const m = createMock()
  setupAppUpdate(m.api)
  m.handlers.failed()
  assert.equal(m.modals.length, 1)
  assert.equal(m.modals[0].showCancel, false)
  assert.match(m.modals[0].content, /删除|重启/)
  assert.equal(m.applied, 0)
})

test('app.js 在 onLaunch 最前面启用更新检查（早退分支之前）', () => {
  const appSource = readFileSync(join(root, 'app.js'), 'utf8')
  assert.match(appSource, /require\('\.\/utils\/app-update'\)/)
  const launchAt = appSource.indexOf('onLaunch()')
  const setupAt = appSource.indexOf('setupAppUpdate()', launchAt)
  const cloudGuardAt = appSource.indexOf('if (!wx.cloud)', launchAt)
  assert.ok(launchAt >= 0 && setupAt > launchAt, 'onLaunch 内需调用 setupAppUpdate')
  assert.ok(cloudGuardAt < 0 || setupAt < cloudGuardAt, '更新检查不能被云能力早退分支跳过')
})

test('版本更新不清空业务缓存（登录态 / 天气快照保留）', () => {
  const appSource = readFileSync(join(root, 'app.js'), 'utf8')
  const updateSource = readFileSync(join(root, 'utils', 'app-update.js'), 'utf8')
  assert.doesNotMatch(appSource, /clearStorage/)
  assert.doesNotMatch(updateSource, /clearStorage|removeStorageSync/)
})
