# 小程序登录与穿搭详情闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 复用现有 `pages/login/login`，实现符合编号 3 原型的登录页，以及“未登录查看穿搭详情 → 登录 → 回到原日期详情页”的完整闭环。

**Architecture:** 将站内回跳地址的编码和校验提取到纯函数 `utils/login-route.js`，由 `utils/auth.js` 统一负责进入登录页。首页和详情页只决定目标地址；登录页负责授权、调用云函数、提交登录状态和安全回跳。

**Tech Stack:** 微信小程序原生框架、Skyline、CloudBase 云函数、Node.js 内置测试运行器

## Global Constraints

- 复用 `pages/login/login`，不新增第二个登录页面。
- 登录背景复用 `/images/splash/bg.png`，不新增大尺寸图片资源。
- 未登录点击首页“穿搭详情”时直接进入登录页，不显示确认弹窗。
- 保留“暂不登录，返回首页”入口。
- 只接受以 `/pages/` 开头的站内回跳地址。
- 登录失败或云函数失败时不能写入本地登录状态。
- 本计划不接入天气 API、万年历算法，不修改详情页主体视觉。

---

### Task 1: 建立小程序测试入口和安全回跳工具

**Files:**
- Create: `tests/miniprogram/login-route.test.js`
- Create: `utils/login-route.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeRedirect(encodedRedirect): string`
- Produces: `buildLoginUrl(redirectUrl): string`
- Consumes: URL 编码后的站内小程序页面路径。

- [ ] **Step 1: 写安全回跳的失败测试**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeRedirect,
  buildLoginUrl
} = require('../../utils/login-route')

test('只接受 pages 下的站内回跳地址', () => {
  assert.equal(
    normalizeRedirect(encodeURIComponent('/pages/detail/detail?dateIndex=2')),
    '/pages/detail/detail?dateIndex=2'
  )
  assert.equal(normalizeRedirect(encodeURIComponent('https://example.com')), '')
  assert.equal(normalizeRedirect('%E0%A4%A'), '')
})

test('构造带编码回跳地址的登录页 URL', () => {
  assert.equal(
    buildLoginUrl('/pages/detail/detail?dateIndex=1'),
    '/pages/login/login?redirect=%2Fpages%2Fdetail%2Fdetail%3FdateIndex%3D1'
  )
  assert.equal(buildLoginUrl(''), '/pages/login/login')
})
```

- [ ] **Step 2: 配置并运行测试，确认因模块不存在而失败**

将根目录 `package.json` 的脚本改为：

```json
{
  "scripts": {
    "test": "node --test tests/miniprogram/*.test.js"
  }
}
```

Run: `npm test`

Expected: FAIL，错误包含 `Cannot find module '../../utils/login-route'`。

- [ ] **Step 3: 实现最小安全回跳工具**

```js
function normalizeRedirect(encodedRedirect = '') {
  if (!encodedRedirect) return ''
  try {
    const decoded = decodeURIComponent(encodedRedirect)
    return decoded.startsWith('/pages/') ? decoded : ''
  } catch {
    return ''
  }
}

function buildLoginUrl(redirectUrl = '') {
  if (!redirectUrl || !redirectUrl.startsWith('/pages/')) {
    return '/pages/login/login'
  }
  return `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`
}

module.exports = {
  normalizeRedirect,
  buildLoginUrl
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`

Expected: 2 tests PASS。

- [ ] **Step 5: 提交回跳工具**

```bash
git add package.json tests/miniprogram/login-route.test.js utils/login-route.js
git commit -m "test: 建立小程序登录回跳测试"
```

---

### Task 2: 将穿搭详情未登录分支改为直接进入登录页

**Files:**
- Create: `tests/miniprogram/auth-navigation.test.js`
- Modify: `utils/auth.js`
- Modify: `pages/index/index.js`
- Modify: `pages/detail/detail.js`

**Interfaces:**
- Consumes: `buildLoginUrl(redirectUrl)`。
- Produces: `goToLogin(redirectUrl): false`。
- 保留: `requireLogin(message, redirectUrl)`，供签到、收藏等仍需确认的功能使用。

- [ ] **Step 1: 写直接跳转的失败测试**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('goToLogin 直接打开带回跳地址的登录页', () => {
  const navigations = []
  global.getApp = () => ({ globalData: { isLogin: false, userInfo: null } })
  global.wx = {
    navigateTo(options) {
      navigations.push(options.url)
    }
  }

  const modulePath = require.resolve('../../utils/auth')
  delete require.cache[modulePath]
  const { goToLogin } = require('../../utils/auth')

  const result = goToLogin('/pages/detail/detail?dateIndex=2')
  assert.equal(result, false)
  assert.deepEqual(navigations, [
    '/pages/login/login?redirect=%2Fpages%2Fdetail%2Fdetail%3FdateIndex%3D2'
  ])
})

test('首页和详情页不再用 requireLogin 保护详情跳转', () => {
  const root = path.resolve(__dirname, '../..')
  const indexSource = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
  const detailSource = fs.readFileSync(path.join(root, 'pages/detail/detail.js'), 'utf8')

  assert.match(indexSource, /goToLogin\(url\)/)
  assert.match(detailSource, /goToLogin\(redirectUrl\)/)
  assert.doesNotMatch(indexSource, /requireLogin\('登录后才能查看完整穿搭详情'/)
  assert.doesNotMatch(detailSource, /requireLogin\('登录后才能查看完整穿搭详情'/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，提示 `goToLogin is not a function`。

- [ ] **Step 3: 在 auth 工具中增加直接登录导航**

在 `utils/auth.js` 顶部引入：

```js
const { buildLoginUrl } = require('./login-route')
```

增加并导出：

```js
function goToLogin(redirectUrl = '') {
  wx.navigateTo({ url: buildLoginUrl(redirectUrl) })
  return false
}
```

将 `requireLogin` 的确认分支改为调用：

```js
if (res.confirm) goToLogin(redirectUrl)
```

- [ ] **Step 4: 首页使用直接登录导航**

将 `pages/index/index.js` 的依赖改为：

```js
const { isLoggedIn, goToLogin } = require('../../utils/auth')
```

将 `onGoDetail` 改为：

```js
onGoDetail() {
  const url = `/pages/detail/detail?dateIndex=${this.data.selectedDateIndex}`
  if (!isLoggedIn()) {
    goToLogin(url)
    return
  }
  wx.navigateTo({ url })
}
```

- [ ] **Step 5: 详情页二次校验也直接进入登录页**

将 `pages/detail/detail.js` 的依赖改为：

```js
const { isLoggedIn, goToLogin, requireLogin } = require('../../utils/auth')
```

将 `onLoad` 未登录分支改为：

```js
if (!isLoggedIn()) {
  this.setData({ loading: false })
  goToLogin(redirectUrl)
  return
}
```

收藏功能继续使用 `requireLogin`。

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`

Expected: 4 tests PASS。

- [ ] **Step 7: 提交直接跳转闭环**

```bash
git add tests/miniprogram/auth-navigation.test.js utils/auth.js pages/index/index.js pages/detail/detail.js
git commit -m "feat: 未登录查看详情时直接进入登录页"
```

---

### Task 3: 按编号 3 原型重做登录页面

**Files:**
- Create: `tests/miniprogram/login-page-source.test.js`
- Modify: `pages/login/login.wxml`
- Modify: `pages/login/login.wxss`
- Modify: `pages/login/login.json`

**Interfaces:**
- Consumes: `/images/splash/bg.png`。
- Emits handlers: `onLogin`、`onSkip`。
- Consumes state: `loading`、`canLogin`、`error`。

- [ ] **Step 1: 写页面结构失败测试**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const wxml = fs.readFileSync(path.join(root, 'pages/login/login.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(root, 'pages/login/login.wxss'), 'utf8')

test('登录页复用开屏背景并提供登录和跳过入口', () => {
  assert.match(wxml, /navigation-bar/)
  assert.match(wxml, /\/images\/splash\/bg\.png/)
  assert.match(wxml, /bindtap="onLogin"/)
  assert.match(wxml, /bindtap="onSkip"/)
  assert.match(wxml, /微信授权一键登录/)
  assert.match(wxml, /暂不登录，返回首页/)
  assert.match(wxss, /\.login-action-panel/)
  assert.match(wxss, /safe-area-inset-bottom/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，提示 WXML 中没有 `/images/splash/bg.png`。

- [ ] **Step 3: 替换登录页模板**

`pages/login/login.wxml` 使用以下结构：

```xml
<navigation-bar
  title="灵序穿搭"
  back="{{true}}"
  color="#3d3529"
  background="#fffdf7"
></navigation-bar>

<view class="login-page">
  <image class="login-bg" src="/images/splash/bg.png" mode="aspectFill" />

  <view class="brand-copy">
    <text class="brand-title">灵序穿搭</text>
    <text class="brand-subtitle">穿出你的好运势</text>
  </view>

  <view class="login-action-panel">
    <button
      class="wechat-login-button"
      loading="{{loading}}"
      disabled="{{!canLogin || loading}}"
      bindtap="onLogin"
    >
      微信授权一键登录
    </button>
    <text class="login-error" wx:if="{{error}}">{{error}}</text>
    <view class="skip-login" bindtap="onSkip">暂不登录，返回首页</view>
    <text class="agreement-text">登录即表示同意《用户协议》和《隐私政策》</text>
  </view>
</view>
```

- [ ] **Step 4: 实现原型风格样式**

`pages/login/login.wxss` 至少包含：

```css
.login-page {
  position: relative;
  width: 100vw;
  height: calc(100vh - var(--height));
  overflow: hidden;
  background: #f5efe0;
}

.login-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.brand-copy {
  position: absolute;
  right: 32rpx;
  bottom: 330rpx;
  left: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff8e8;
  text-shadow: 0 0 18rpx rgba(255, 226, 168, .9);
}

.login-action-panel {
  position: absolute;
  right: 48rpx;
  bottom: calc(56rpx + env(safe-area-inset-bottom));
  left: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wechat-login-button {
  width: 100%;
  height: 88rpx;
  border: 1rpx solid rgba(168, 121, 54, .55);
  border-radius: 44rpx;
  color: #6f4d1f;
  background: rgba(255, 250, 237, .92);
  box-shadow: 0 8rpx 24rpx rgba(104, 72, 30, .16);
  font-size: 28rpx;
}

.skip-login {
  padding: 24rpx;
  color: rgba(255, 250, 238, .88);
  font-size: 24rpx;
  text-shadow: 0 2rpx 8rpx rgba(55, 39, 22, .6);
}
```

同时补全 `.brand-title`、`.brand-subtitle`、`.login-error`、`.agreement-text` 和按钮禁用态。

- [ ] **Step 5: 精简页面组件声明**

`pages/login/login.json` 改为：

```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  },
  "navigationStyle": "custom"
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`

Expected: 5 tests PASS。

- [ ] **Step 7: 提交登录页视觉**

```bash
git add tests/miniprogram/login-page-source.test.js pages/login/login.wxml pages/login/login.wxss pages/login/login.json
git commit -m "feat: 按原型重做小程序登录页"
```

---

### Task 4: 收紧登录成功条件和安全回跳

**Files:**
- Create: `tests/miniprogram/login-contract.test.js`
- Modify: `pages/login/login.js`
- Modify: `cloudfunctions/login/index.js`

**Interfaces:**
- Consumes: `normalizeRedirect(options.redirect)`。
- 云函数成功返回: `{ success: true, openid, points, userInfo }`。
- 云函数失败返回: `{ success: false, message }`。

- [ ] **Step 1: 写登录契约失败测试**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const pageSource = fs.readFileSync(path.join(root, 'pages/login/login.js'), 'utf8')
const functionSource = fs.readFileSync(path.join(root, 'cloudfunctions/login/index.js'), 'utf8')

test('登录页仅在云函数明确成功后提交登录状态', () => {
  assert.match(pageSource, /loginRes\.result\?\.success/)
  assert.match(pageSource, /normalizeRedirect\(options\.redirect/)
  assert.doesNotMatch(pageSource, /setTimeout\(/)
})

test('登录云函数返回明确的成功与失败契约', () => {
  assert.match(functionSource, /success:\s*true/)
  assert.match(functionSource, /success:\s*false/)
  assert.match(functionSource, /userInfo:/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，提示登录页没有检查 `result.success`。

- [ ] **Step 3: 调整云函数返回契约**

成功分支返回：

```js
return {
  success: true,
  openid: OPENID,
  points: latestUser.data[0].points || 0,
  userInfo: latestUser.data[0]
}
```

失败分支返回：

```js
return {
  success: false,
  message: '登录服务暂时不可用'
}
```

失败响应不返回可被前端误判为成功的 OpenID。

- [ ] **Step 4: 登录页使用统一回跳解析**

`pages/login/login.js` 引入：

```js
const { normalizeRedirect } = require('../../utils/login-route')
```

`onLoad` 中设置：

```js
this.setData({
  redirectUrl: normalizeRedirect(options.redirect || '')
})
```

- [ ] **Step 5: 只在云函数明确成功时写入会话**

将登录结果判断改为：

```js
const result = loginRes.result
if (!result?.success || !result.userInfo) {
  throw new Error(result?.message || '登录服务返回异常')
}

const userInfo = {
  nickName: result.userInfo.nickName || profileRes.userInfo.nickName || '微信用户',
  avatarUrl: result.userInfo.avatarUrl || profileRes.userInfo.avatarUrl || ''
}

app.globalData.userInfo = userInfo
app.globalData.isLogin = true
app.globalData.openid = result.openid
app.globalData.points = result.points || 0
wx.setStorageSync('userInfo', userInfo)
wx.showToast({ title: '登录成功', icon: 'success' })
this.completeLoginNavigation()
```

删除原有 `setTimeout` 延迟跳转。

- [ ] **Step 6: 防止页面卸载后继续更新状态**

在页面数据外维护：

```js
let pageActive = false
```

在 `onLoad` 设置 `pageActive = true`，在 `onUnload` 设置 `pageActive = false`。异步登录完成后，在调用 `setData` 或跳转前检查 `pageActive`。

- [ ] **Step 7: 暂不登录稳定返回首页**

`onSkip` 使用：

```js
onSkip() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
  } else {
    wx.reLaunch({ url: '/pages/index/index' })
  }
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npm test`

Expected: 7 tests PASS。

- [ ] **Step 9: 部署登录云函数**

在微信开发者工具中右键 `cloudfunctions/login`，选择“上传并部署：云端安装依赖”。

Expected: 云函数部署成功，无依赖安装错误。

- [ ] **Step 10: 提交登录契约**

```bash
git add tests/miniprogram/login-contract.test.js pages/login/login.js cloudfunctions/login/index.js
git commit -m "fix: 收紧小程序登录成功与回跳契约"
```

---

### Task 5: 微信开发者工具端到端验收

**Files:**
- Verify: `pages/index/index`
- Verify: `pages/login/login`
- Verify: `pages/detail/detail`
- Verify: `cloudfunctions/login`

**Interfaces:**
- 验证从首页到登录页、登录云函数和详情页的完整链路。

- [ ] **Step 1: 执行完整自动化验证**

Run: `npm test`

Expected: 所有小程序测试 PASS。

Run: `git diff --check`

Expected: 无空白错误。

- [ ] **Step 2: 验证未登录直接跳转**

在微信开发者工具清除 Storage 并重新编译：

1. 首页选择“后天”。
2. 点击“穿搭详情”。

Expected:

- 不出现“需要登录”确认弹窗。
- 直接进入编号 3 登录页。
- 页面背景为开屏美女图。

- [ ] **Step 3: 验证跳过登录**

点击“暂不登录，返回首页”。

Expected:

- 返回首页。
- 不进入详情页。
- Storage 中没有新增 `userInfo`。

- [ ] **Step 4: 验证取消授权与重复点击**

重新进入登录页：

1. 点击登录后取消授权。
2. 再次点击登录。
3. 请求进行期间快速重复点击按钮。

Expected:

- 取消授权不显示网络错误，不写入登录态。
- 按钮恢复可点击。
- 同一时刻只发起一次登录调用。

- [ ] **Step 5: 验证成功回跳**

同意登录授权。

Expected:

- `login` 云函数返回 `success: true`。
- 登录成功后进入 `pages/detail/detail?dateIndex=2`。
- 详情页显示后天日期。
- 返回首页后再次点击详情不经过登录页。

- [ ] **Step 6: 验证直接访问详情页保护**

再次清除 Storage，通过编译模式直接打开：

```text
pages/detail/detail?dateIndex=1
```

Expected:

- 自动进入登录页。
- 登录成功后回到 `dateIndex=1` 的详情页。

- [ ] **Step 7: 最终提交**

若验收过程中没有新增修改，无需额外提交；若仅修复验收发现的问题：

```bash
git add pages/login pages/index/index.js pages/detail/detail.js utils cloudfunctions/login tests/miniprogram package.json
git commit -m "fix: 完成小程序登录详情闭环验收"
```
