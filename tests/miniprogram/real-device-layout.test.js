const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')

test('detail and mine lists avoid css grid for real-device skyline consistency', () => {
  const detailWxss = readFileSync(join(root, 'pages/detail/detail.wxss'), 'utf8')
  const mineWxss = readFileSync(join(root, 'pages/mine/mine.wxss'), 'utf8')

  assert.doesNotMatch(detailWxss, /display:\s*grid/)
  assert.doesNotMatch(mineWxss, /display:\s*grid/)
  assert.match(detailWxss, /\.outfit-grid\s*\{[^}]*display:\s*flex/s)
  assert.match(mineWxss, /\.collection-grid\s*\{[^}]*display:\s*flex/s)
})
