const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = file => readFileSync(join(root, file), 'utf8')

test('发版合规：小程序内隐私政策兜底文案声明相册（仅写入）', () => {
  const legalJs = read('pages/legal/legal.js')
  assert.match(legalJs, /相册（仅写入）/, '兜底隐私政策需声明相册写入权限')
  assert.match(legalJs, /不会读取相册中的其他内容/, '需明确仅写入、不读取')
  assert.match(legalJs, /保存到你的手机相册/, '用途需对应保存图片这一接口能力')
})

test('发版合规：保存日签海报前先完成隐私协议授权', () => {
  const posterJs = read('pages/poster/poster.js')
  const privacyJs = read('utils/privacy.js')
  assert.match(posterJs, /wx\.saveImageToPhotosAlbum/, '日签页确实调用相册写入接口')
  assert.match(posterJs, /await ensurePrivacyAuthorize\(\)/, 'saveImageToPhotosAlbum 前需先授权')
  const authAt = posterJs.indexOf('await ensurePrivacyAuthorize()')
  const saveAt = posterJs.indexOf('wx.saveImageToPhotosAlbum')
  assert.ok(authAt >= 0 && saveAt > authAt, '授权调用必须在保存接口之前')
  assert.match(privacyJs, /wx\.getPrivacySetting/)
  assert.match(privacyJs, /wx\.requirePrivacyAuthorize/)
})

test('发版合规：上传包排除运维脚本与后台目录', () => {
  const config = JSON.parse(read('project.config.json'))
  const ignored = (config.packOptions.ignore || []).map(item => item.value)
  for (const dir of ['scripts', 'cloudfunctions', 'admin-web', 'tests', 'node_modules', '.git']) {
    assert.ok(ignored.includes(dir), `packOptions.ignore 需排除 ${dir}`)
  }
})

test('发版合规：地理位置接口声明与现有隐私条目对齐', () => {
  const appConfig = JSON.parse(read('app.json'))
  assert.ok(appConfig.requiredPrivateInfos.includes('getLocation'))
  assert.match(read('pages/index/index.js'), /wx\.getLocation/)
})
