import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/DictionariesPage.vue')
const router = read('../src/router/index.ts')
const layout = read('../src/layout/AdminLayout.vue')
const types = read('../src/types/domain.ts')

test('后台提供标签字典页面和类型', () => {
  assert.match(types, /interface TagDictionary/)
  assert.match(page, /dictionaries\.list/)
  assert.match(page, /dictionaries\.seedDefaults/)
  assert.match(page, /五行|颜色|场景|季节|天气|配饰类型/)
  assert.match(router, /dictionaries/)
  assert.match(layout, /标签字典/)
})
