import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/DictionariesPage.vue')
const router = read('../src/router/index.ts')
const layout = read('../src/layout/AdminLayout.vue')
const types = read('../src/types/domain.ts')
const outfits = read('../src/pages/OutfitsPage.vue')
const accessories = read('../src/pages/AccessoriesPage.vue')
const dictionaryHook = read('../src/composables/useDictionaries.ts')

test('后台提供标签字典页面和类型', () => {
  assert.match(types, /interface TagDictionary/)
  assert.match(page, /dictionaries\.list/)
  assert.match(page, /dictionaries\.seedDefaults/)
  assert.match(page, /五行|颜色|场景|季节|天气|配饰类型/)
  assert.match(router, /dictionaries/)
  assert.match(layout, /标签字典/)
})

test('素材表单只使用字典选项并自动展示五行', () => {
  assert.match(dictionaryHook, /dictionaries\.list/)
  assert.match(outfits, /primaryColorCodes/)
  assert.match(outfits, /elementsForColors/)
  assert.match(outfits, /waterproof/)
  assert.match(outfits, /windproof/)
  assert.match(outfits, /breathable/)
  assert.match(accessories, /accessoryTypeCode/)
  assert.doesNotMatch(outfits, /allow-create/)
  assert.doesNotMatch(accessories, /allow-create/)
})

test('穿搭发布前会在表单层校验温度等必填项', () => {
  assert.match(outfits, /outfitFormRef/)
  assert.match(outfits, /outfitRules/)
  assert.match(outfits, /temperatureMin/)
  assert.match(outfits, /temperatureMax/)
  assert.match(outfits, /formRef\.validate/)
})
