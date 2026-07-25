const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')

test('adminApi 注册字典读写和初始化动作', () => {
  for (const action of [
    'dictionaries.list',
    'dictionaries.save',
    'dictionaries.setStatus',
    'dictionaries.seedDefaults'
  ]) assert.match(source, new RegExp(action.replace('.', '\\.')))
  assert.match(source, /tagDictionaries/)
  assert.match(source, /DEFAULT_DICTIONARIES/)
})

test('素材保存通过服务端规则推导五行', () => {
  assert.match(source, /normalizeOutfit/)
  assert.match(source, /normalizeAccessory/)
  assert.match(source, /validatePublishMaterial/)
})

test('内容编辑角色可以维护标签字典', () => {
  const editorPermissions = source.match(/editor:\s*\[([\s\S]*?)\]/)?.[1] || ''
  assert.match(editorPermissions, /'configs\.write'/)
})

test('初始化默认字典会停用旧版颜色编码', () => {
  assert.match(source, /activeDefaultColorCodes/)
  assert.match(source, /command\.nin\(\[\.\.\.activeDefaultColorCodes\]\)/)
  assert.match(source, /enabled:\s*false/)
})

test('Node SDK 通用新增和更新直接写入文档根字段', () => {
  assert.match(
    source,
    /collection\(collectionName\)\.add\(\{\s*\.\.\.nowData,/
  )
  assert.match(
    source,
    /collection\(collectionName\)\.doc\(id\)\.update\(\{\s*\.\.\.nowData,/
  )
  assert.doesNotMatch(
    source,
    /collection\(collectionName\)\.add\(\{\s*data:/
  )
})
