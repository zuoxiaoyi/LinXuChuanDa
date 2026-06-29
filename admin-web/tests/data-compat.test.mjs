import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const outfitsPage = read('../src/pages/OutfitsPage.vue')
const accessoriesPage = read('../src/pages/AccessoriesPage.vue')
const mediaField = read('../src/components/MediaField.vue')
const mediaService = read('../src/services/media.ts')

test('穿搭和配饰列表会把旧标签字段规范成数组', () => {
  assert.match(outfitsPage, /function normalizeOutfit/)
  assert.match(accessoriesPage, /function normalizeAccessory/)
  assert.doesNotMatch(outfitsPage, /\[\.\.\.row\.elementTags/)
})

test('Web 图片预览会把 cloud 文件 ID 转换为临时 HTTPS 地址', () => {
  assert.match(mediaService, /getTempFileURL/)
  assert.match(mediaService, /resolveCloudFileUrls/)
  assert.match(outfitsPage, /coverPreviewUrl/)
  assert.match(accessoriesPage, /imagePreviewUrl/)
  assert.match(mediaField, /previewUrl/)
})
