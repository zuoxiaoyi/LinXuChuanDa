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
