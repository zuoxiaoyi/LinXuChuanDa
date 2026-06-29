import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const authStore = readFileSync(
  new URL('../src/stores/auth.ts', import.meta.url),
  'utf8'
)
const adminApi = readFileSync(
  new URL('../../cloudfunctions/adminApi/index.js', import.meta.url),
  'utf8'
)

test('auth.me 不会把无权限用户包装成 guest 成功响应', () => {
  const authMeBranch = adminApi.match(
    /if \(action === 'auth\.me'\) \{([\s\S]*?)\n    \}/
  )?.[1] || ''

  assert.doesNotMatch(authMeBranch, /guest:\s*true/)
  assert.match(authMeBranch, /await getAdmin\(uid\)/)
})

test('恢复会话遇到管理员权限失败时返回未登录', () => {
  assert.match(authStore, /catch \(error\)/)
  assert.match(authStore, /this\.admin = null/)
  assert.match(authStore, /return false/)
})

test('adminApi 从 Node SDK 的 data 数组中读取单条文档', () => {
  assert.match(adminApi, /function firstDocument\(result\)/)
  assert.match(adminApi, /admin = firstDocument\(result\)/)
  assert.match(adminApi, /const document = firstDocument\(result\)/)
})
