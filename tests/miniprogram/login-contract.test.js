const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '../..')

test('登录页只接受云函数明确成功的响应并安全解析回跳地址', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'pages/login/login.js'),
    'utf8'
  )

  assert.match(source, /loginRes\.result\?\.success/)
  assert.match(source, /normalizeRedirect\(options\.redirect/)
  assert.doesNotMatch(source, /setTimeout\(/)

  const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8')
  assert.match(appSource, /res\.result\?\.success/)
})

test('登录云函数返回明确的成功或失败契约', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'cloudfunctions/login/index.js'),
    'utf8'
  )

  assert.match(source, /success:\s*true/)
  assert.match(source, /success:\s*false/)
  assert.match(source, /userInfo/)
})
