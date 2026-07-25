const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const loginDir = path.resolve(__dirname, '../../pages/login')

test('登录页使用原型背景、微信登录按钮和保留的返回入口', () => {
  const wxml = fs.readFileSync(path.join(loginDir, 'login.wxml'), 'utf8')

  assert.match(wxml, /navigation-bar/)
  assert.match(wxml, /\/images\/common\/bg\.png/)
  assert.match(wxml, /\/images\/common\/title\.png/)
  assert.match(wxml, /bindtap="onLogin"/)
  assert.match(wxml, /微信授权一键登录/)
  assert.match(wxml, /bindtap="onSkip"/)
  assert.match(wxml, /暂不登录，返回首页/)
})

test('登录操作区适配底部安全区', () => {
  const wxss = fs.readFileSync(path.join(loginDir, 'login.wxss'), 'utf8')

  assert.match(wxss, /\.login-action-panel/)
  assert.match(wxss, /safe-area-inset-bottom/)
})
