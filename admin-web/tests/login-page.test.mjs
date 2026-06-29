import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loginPage = readFileSync(
  new URL('../src/pages/LoginPage.vue', import.meta.url),
  'utf8'
)
const cloudbaseService = readFileSync(
  new URL('../src/services/cloudbase.ts', import.meta.url),
  'utf8'
)

test('五行轨道包含三条差速轨道和五个保持正向的节点', () => {
  assert.match(loginPage, /class="orbit-track orbit-track--outer"/)
  assert.match(loginPage, /class="orbit-track orbit-track--middle"/)
  assert.match(loginPage, /class="orbit-track orbit-track--inner"/)
  assert.equal((loginPage.match(/class="orbit-body orbit-body--/g) || []).length, 5)
  assert.match(loginPage, /@keyframes orbit-spin/)
  assert.match(loginPage, /@keyframes orbit-counter-spin/)
  assert.match(loginPage, /prefers-reduced-motion:\s*reduce/)
})

test('配置提示会列出缺失的 CloudBase 环境变量', () => {
  assert.match(cloudbaseService, /export const cloudbaseMissingConfig/)
  assert.match(loginPage, /cloudbaseMissingConfig/)
  assert.match(loginPage, /缺少配置：/)
})

test('五行轨道完整位于登录故事面板内', () => {
  const orbitRule = loginPage.match(/\.story-orbit\s*\{([\s\S]*?)\}/)?.[1] || ''
  assert.match(orbitRule, /top:\s*24px/)
  assert.match(orbitRule, /right:\s*28px/)
})
