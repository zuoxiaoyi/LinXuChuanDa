const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const appConfig = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'))
const loginWxml = readFileSync(join(root, 'pages/login/login.wxml'), 'utf8')

test('login agreement text links to legal pages', () => {
  assert.ok(appConfig.pages.includes('pages/legal/legal'))
  assert.match(loginWxml, /《用户协议》/)
  assert.match(loginWxml, /《隐私政策》/)
  assert.match(loginWxml, /data-type="user_agreement"/)
  assert.match(loginWxml, /data-type="privacy"/)
  assert.match(loginWxml, /catchtap="onOpenLegal"/)
})

test('legal page reads content from admin configurable content api', () => {
  const legalJs = readFileSync(join(root, 'pages/legal/legal.js'), 'utf8')
  const legalWxml = readFileSync(join(root, 'pages/legal/legal.wxml'), 'utf8')
  const adminApi = readFileSync(join(root, 'cloudfunctions/adminApi/index.js'), 'utf8')

  assert.match(legalJs, /content\.publicGet/)
  assert.match(legalWxml, /rich-text/)
  assert.match(adminApi, /'content\.publicGet':\s*null/)
})
