const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = file => readFileSync(join(root, file), 'utf8')
const pageFile = name => read(`pages/${name}/${name}.js`)
const pageWxml = name => read(`pages/${name}/${name}.wxml`)

const PAGE_NAMES = ['splash', 'index', 'login', 'legal', 'detail', 'mine']

function pngSize(file) {
  const buf = readFileSync(join(root, file))
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

test('全站每个页面都成对声明转发好友与分享朋友圈回调', () => {
  const share = read('utils/share.js')
  assert.match(share, /onShareAppMessage\(res\)/)
  assert.match(share, /onShareTimeline\(res\)/)
  assert.match(share, /function withShare\(/)
  // 微信要求：只有定义了 onShareTimeline 才显示朋友圈入口，且该页必须同时可转发好友
  assert.match(share, /只有定义了 onShareAppMessage/)
  assert.match(share, /只有定义了 onShareTimeline/)
  assert.match(share, /module\.exports\s*=\s*\{[\s\S]*withShare/)

  PAGE_NAMES.forEach(name => {
    const js = pageFile(name)
    assert.match(js, /withShare/, `${name} 页未包装 withShare`)
    assert.match(js, /Page\(withShare\(\{/, `${name} 页未用 withShare 包装 Page`)
  })
})

test('分享卡片图按官方比例生成：好友 5:4、朋友圈 1:1，且均为 PNG', () => {
  const friend = 'images/common/share-card.png'
  const timeline = 'images/common/share-timeline.png'
  assert.ok(existsSync(join(root, friend)))
  assert.ok(existsSync(join(root, timeline)))

  const a = pngSize(friend)
  const b = pngSize(timeline)
  assert.equal(a.width / a.height, 5 / 4)
  assert.equal(b.width / b.height, 1)

  const share = read('utils/share.js')
  assert.match(share, /share-card\.png/)
  assert.match(share, /share-timeline\.png/)
  assert.match(share, /FRIEND_IMAGE/)
  assert.match(share, /TIMELINE_IMAGE/)
})

test('朋友圈单页模式（场景值 1154）下不做被微信禁用的跳转与交互', () => {
  const share = read('utils/share.js')
  assert.match(share, /SINGLE_PAGE_SCENE\s*=\s*1154/)
  assert.match(share, /getEnterOptionsSync/)
  assert.match(share, /singlePageMode:\s*isSinglePageMode\(\)/)

  const auth = read('utils/auth.js')
  assert.match(auth, /isSinglePageMode\(\)/)
  assert.match(auth, /if \(isSinglePageMode\(\)\) return false/)

  const detail = pageFile('detail')
  const mine = pageFile('mine')
  const index = pageFile('index')
  ;[detail, mine, index].forEach(js => {
    assert.match(js, /朋友圈单页模式禁用 wx\.createRewardedVideoAd/)
  })
  assert.match(detail, /if \(!isLoggedIn\(\) && !timelineMode\)/)

  // 自定义导航条与底部导航在单页模式隐藏，避免与微信固定导航栏/操作栏重叠
  PAGE_NAMES.forEach(name => {
    assert.match(pageWxml(name), /wx:if="\{\{!singlePageMode\}\}"/, `${name} 页未适配单页模式`)
  })
  assert.doesNotMatch(pageWxml('index'), /<button class="outline-button share-button" open-type="share"/)

  assert.match(read('app.json'), /navigationBarTitleText/)
})

test('我的收藏返回时保留滚动位置：静默刷新 + 位置冻结 + 兜底恢复', () => {
  const wxml = pageWxml('mine')
  const js = pageFile('mine')

  assert.match(wxml, /scroll-top="\{\{scrollTop\}\}"/)
  assert.match(js, /onHide\(\)/)
  assert.match(js, /this\.savedScrollTop = this\.lastScrollTop/)
  assert.match(js, /this\.lastScrollTop = scrollTop/)
  assert.match(js, /async loadUserData\(\{ silent = false \} = \{\}\)/)
  assert.match(js, /this\.loadUserData\(\{ silent: !!this\.profileLoaded \}\)/)
  // 静默刷新不切 loading、不把已有收藏列表换成错误卡片
  assert.match(js, /if \(!silent\) this\.setData\(\{ loading: true, error: '' \}\)/)
  assert.match(js, /静默刷新失败，保留上次资料与滚动位置/)
  assert.match(js, /restoreScrollPosition\(\)/)
  assert.match(js, /scrollOffset\(\)/)
  assert.match(js, /wx\.nextTick\(\(\) => this\.restoreScrollPosition\(\)\)/)
  // 退出登录要清掉缓存位置，避免下一个账号落在别人的滚动位置
  assert.match(js, /this\.savedScrollTop = 0/)
})

test('单套详情页去掉「已收藏」占位并修复图片空白', () => {
  const wxml = pageWxml('detail')
  const js = pageFile('detail')
  const wxss = read('pages/detail/detail.wxss')

  assert.doesNotMatch(wxml, /collect-bar/)
  assert.doesNotMatch(wxml, /\{\{singleCollected \? '已收藏' : '收藏'\}\}/)
  assert.doesNotMatch(js, /onToggleCollectSingle|singleCollected/)
  assert.doesNotMatch(wxss, /\.collect-bar\s*\{/)

  // cloud:// 兜底转换 + 图片加载失败回退占位
  assert.match(js, /require\('\.\.\/\.\.\/utils\/cloudfile'\)/)
  assert.match(js, /await toDisplayUrl\(result\.outfit\.coverUrl/)
  assert.match(js, /onSingleCoverError\(e\)/)
  assert.match(wxml, /binderror="onSingleCoverError"/)

  // <image> 不再用 height:0 交给 flex 撑高（真机白屏根因）
  // [^-] 用来排除 min-height: 0 这种合法写法被误判
  assert.doesNotMatch(wxss, /\.single-cover\s*\{[^}]*[^-]height:\s*0\s*;/s)
  assert.match(wxss, /\.single-cover\s*\{[^}]*position:\s*absolute/s)
  assert.match(wxss, /\.single-cover\s*\{[^}]*height:\s*calc\(100%/s)
  assert.doesNotMatch(wxss, /\.preview-photo\s*\{[^}]*[^-]height:\s*0\s*;/s)
})
