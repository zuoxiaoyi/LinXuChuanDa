const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '../..')

test('goToLogin 直接打开带安全回跳地址的登录页', () => {
  const calls = []
  global.getApp = () => ({
    globalData: {
      isLogin: false,
      userInfo: null
    }
  })
  global.wx = {
    navigateTo(options) {
      calls.push(options)
    }
  }

  const authPath = require.resolve('../../utils/auth')
  delete require.cache[authPath]
  const { goToLogin } = require('../../utils/auth')

  assert.equal(goToLogin('/pages/detail/detail?dateIndex=2'), false)
  assert.deepEqual(calls, [{
    url: '/pages/login/login?redirect=%2Fpages%2Fdetail%2Fdetail%3FdateIndex%3D2'
  }])
})

test('首页和详情页查看穿搭时不再弹登录确认框', () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, 'pages/index/index.js'),
    'utf8'
  )
  const detailSource = fs.readFileSync(
    path.join(projectRoot, 'pages/detail/detail.js'),
    'utf8'
  )

  assert.match(indexSource, /goToLogin\(url\)/)
  assert.doesNotMatch(
    indexSource,
    /requireLogin\('登录后才能查看完整穿搭详情'/
  )
  assert.match(detailSource, /goToLogin\(redirectUrl\)/)
  assert.doesNotMatch(
    detailSource,
    /requireLogin\('登录后才能查看完整穿搭详情'/
  )
})
