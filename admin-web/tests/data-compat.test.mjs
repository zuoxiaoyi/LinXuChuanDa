import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const outfitsPage = read('../src/pages/OutfitsPage.vue')
const accessoriesPage = read('../src/pages/AccessoriesPage.vue')
const mediaField = read('../src/components/MediaField.vue')
const mediaService = read('../src/services/media.ts')
const contentPage = read('../src/pages/ContentPage.vue')
const recommendationsPage = read('../src/pages/RecommendationsPage.vue')
const usersPage = read('../src/pages/UsersPage.vue')
const main = read('../src/main.ts')

test('穿搭和配饰列表会把旧标签字段规范成数组', () => {
  assert.match(outfitsPage, /function normalizeOutfit/)
  assert.match(accessoriesPage, /function normalizeAccessory/)
  assert.doesNotMatch(outfitsPage, /\[\.\.\.row\.elementTags/)
})

test('穿搭和配饰列表展示上传时间与编辑时间，旧数据缺失时保持空白', () => {
  assert.match(outfitsPage, /label="上传时间"/)
  assert.match(outfitsPage, /row\.createdAt/)
  assert.match(outfitsPage, /row\.updatedAt/)
  assert.match(accessoriesPage, /label="上传时间"/)
  assert.match(accessoriesPage, /row\.createdAt/)
  assert.match(accessoriesPage, /row\.updatedAt/)
  assert.match(outfitsPage, /if \(!value\) return ''/)
  assert.match(accessoriesPage, /if \(!value\) return ''/)
})

test('Web 图片预览会把 cloud 文件 ID 转换为临时 HTTPS 地址', () => {
  assert.match(mediaService, /getTempFileURL/)
  assert.match(mediaService, /resolveCloudFileUrls/)
  assert.match(outfitsPage, /coverPreviewUrl/)
  assert.match(accessoriesPage, /imagePreviewUrl/)
  assert.match(mediaField, /previewUrl/)
})

test('内容配置页面兼容 CloudBase 嵌套 data 字段', () => {
  assert.match(contentPage, /function normalizeContent/)
  assert.match(contentPage, /row\?\.data/)
})

test('后台确认框居中显示', () => {
  assert.match(outfitsPage, /center:\s*true/)
  assert.match(recommendationsPage, /center:\s*true/)
  assert.match(usersPage, /center:\s*true/)
  assert.match(main, /el-message-box\.css/)
})

test('上传图片时展示内置进度条', () => {
  assert.match(mediaField, /uploadPercent/)
  assert.match(mediaField, /el-progress/)
  assert.match(mediaService, /onUploadProgress/)
})
