const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = file => readFileSync(join(root, file), 'utf8')

const mineWxml = read('pages/mine/mine.wxml')
const mineWxss = read('pages/mine/mine.wxss')
const mineJs = read('pages/mine/mine.js')
const detailWxml = read('pages/detail/detail.wxml')
const detailWxss = read('pages/detail/detail.wxss')
const detailJs = read('pages/detail/detail.js')

test('「我的」页按滚动阈值浮出刘海卡片，头部固定不动', () => {
  assert.match(mineWxml, /bindscroll="onScroll"/)
  assert.match(mineWxml, /id="dockAnchor"/)
  assert.match(mineWxml, /class="sticky-dock \{\{dockVisible \? 'is-visible' : ''\}\}"/)
  assert.match(mineWxml, /style="top:\{\{dockTop\}\}px"/)
  assert.match(mineWxml, /class="notch-card"/)
  assert.match(mineWxml, /class="notch-points-num"/)
  assert.match(mineWxml, /class="dock-heading"/)
  assert.match(mineWxml, /section-heading \{\{dockVisible \? 'is-docked' : ''\}\}/)

  assert.match(mineWxss, /\.sticky-dock\.is-visible\s*\{[^}]*opacity:\s*1/s)
  assert.match(mineWxss, /\.section-heading\.is-docked\s*\{[^}]*visibility:\s*hidden/s)
})

test('刘海满宽、无圆角、整块不透明深色，收藏图不会透眼', () => {
  assert.match(mineWxss, /\.sticky-dock\s*\{[^}]*left:\s*0/s)
  assert.match(mineWxss, /\.sticky-dock\s*\{[^}]*right:\s*0/s)
  assert.match(mineWxss, /\.sticky-dock\s*\{[^}]*border-radius:\s*0/s)
  assert.match(mineWxss, /\.sticky-dock\s*\{[^}]*background:\s*linear-gradient\(180deg, #463522/s)
  assert.match(mineWxss, /\.sticky-dock\s*\{[^}]*box-shadow/s)
  // 两行共用同一块不透明底板：无半透明背景、无 blur、无圆角、无卡片间隙
  assert.match(mineWxss, /\.notch-card\s*\{[^}]*border-radius:\s*0/s)
  assert.match(mineWxss, /\.notch-card\s*\{[^}]*background:\s*transparent/s)
  assert.match(mineWxss, /\.dock-heading\s*\{[^}]*border-radius:\s*0/s)
  assert.doesNotMatch(mineWxss, /\.notch-card\s*\{[^}]*backdrop-filter/s)
  assert.doesNotMatch(mineWxss, /\.notch-card\s*\{[^}]*rgba\(255, 252, 243/s)
  assert.doesNotMatch(mineWxss, /\.dock-heading\s*\{[^}]*border-radius:\s*18rpx/s)
  assert.match(mineWxss, /\.notch-name\s*\{[^}]*color:\s*#f6ecd8/s)
})

test('单套穿搭详情：底部信息卡固定，图片占剩余空间并补阴影', () => {
  assert.match(detailWxml, /class="state-container single-container"/)
  assert.match(detailWxml, /class="single-figure"/)
  assert.match(detailWxml, /class="single-ground"/)
  assert.match(detailWxml, /class="single-info"[^>]*scroll-y/s)
  assert.match(detailWxml, /class="single-cover"[\s\S]*?mode="aspectFit"/)
  assert.doesNotMatch(detailWxml, /mode="widthFix"/)
  // 占位图用显式 wx:if，避免插入脚底阴影打断 wx:if/wx:else 条件链
  assert.match(detailWxml, /class="image-placeholder empty-outfit single-empty" wx:if="\{\{!singleOutfit\.coverUrl\}\}"/)

  assert.match(detailWxss, /\.single-container\s*\{[^}]*flex:\s*1/s)
  assert.match(detailWxss, /\.single-cover\s*\{[^}]*flex:\s*1/s)
  assert.match(detailWxss, /\.single-cover\s*\{[^}]*drop-shadow/s)
  assert.match(detailWxss, /\.single-ground\s*\{[^}]*radial-gradient/s)
  assert.match(detailWxss, /\.single-info\s*\{[^}]*height:\s*42vh/s)
  assert.match(detailWxss, /\.single-info\s*\{[^}]*box-shadow:\s*0 -14rpx/s)
  // 覆盖六图星标的绝对定位，收藏按钮不再飘走
  assert.match(detailWxss, /\.collect-bar \.collect-button\s*\{[^}]*position:\s*static/s)
})

test('刘海阈值用 SelectorQuery 量锚点绝对位置，且带反向滞回', () => {
  assert.match(mineJs, /measureDock\(\)/)
  assert.match(mineJs, /select\('#dockAnchor'\)\.boundingClientRect\(\)/)
  assert.match(mineJs, /select\('\.page-scroll'\)\.boundingClientRect\(\)/)
  assert.match(mineJs, /select\('\.page-scroll'\)\.scrollOffset\(\)/)
  assert.match(mineJs, /offset\.scrollTop \+ anchor\.top - scroller\.top/)
  assert.match(mineJs, /onScroll\(e\)/)
  assert.match(mineJs, /scrollTop >= threshold - 16/)
  assert.match(mineJs, /dockThreshold/)
  // 只用一层 scroll-view，不引入嵌套滚动导致手势抢锁
  assert.doesNotMatch(mineWxml, /<scroll-view[^>]*class="collection-scroll"/)
})

test('相册关闭键按胶囊矩形动态定位，计数与胶囊同高', () => {
  assert.match(detailJs, /initPreviewSafeArea\(\)/)
  assert.match(detailJs, /wx\.getMenuButtonBoundingClientRect/)
  assert.match(detailJs, /rect\.bottom \+ 12/)
  assert.match(detailJs, /width - rect\.right/)
  assert.match(detailJs, /previewTopPadding/)
  assert.match(detailJs, /statusBarHeight/)
  assert.match(detailWxml, /style="padding-top:\{\{previewTopPadding\}\}px"/)
  assert.match(detailWxml, /style="top:\{\{previewCapsuleTop\}\}px;height:\{\{previewCapsuleHeight\}\}px"/)
  assert.match(detailWxml, /style="top:\{\{previewCloseTop\}\}px;right:\{\{previewCloseRight\}\}px"/)
  assert.match(detailWxss, /\.preview-close\s*\{[^}]*position:\s*absolute/s)
})

test('相册箭头移到图片左右两侧，且不拦截图片点击', () => {
  assert.match(detailWxml, /class="preview-arrow preview-arrow--left/)
  assert.match(detailWxml, /class="preview-arrow preview-arrow--right/)
  assert.match(detailWxss, /\.preview-arrow--left\s*\{[^}]*left:/s)
  assert.match(detailWxss, /\.preview-arrow--right\s*\{[^}]*right:/s)
  assert.match(detailWxss, /\.preview-arrow\s*\{[^}]*position:\s*absolute/s)
  assert.doesNotMatch(detailWxml, /class="preview-nav"/)
  assert.doesNotMatch(detailWxss, /\.preview-nav\s*\{/)
  // swiper 不再 catchtap=noop，点击图片才能冒泡到 preview-layer 关闭
  assert.doesNotMatch(detailWxml, /<swiper\b[^>]*catchtap="noop"/)
  assert.match(detailWxml, /<image\b[^>]*class="preview-photo"[^>]*catchtap="onClosePreview"/s)
  assert.match(detailWxml, /catchtap="onClosePreview"/)
  assert.match(detailWxml, /show-menu-by-longpress/)
})

test('相册属性卡改暗色玻璃，与预览底色融合', () => {
  assert.match(detailWxss, /\.preview-meta\s*\{[^}]*rgba\(58, 49, 37/s)
  assert.match(detailWxss, /\.preview-title\s*\{[^}]*color:\s*#f6ecd8/s)
  assert.match(detailWxss, /\.preview-badge\s*\{[^}]*rgba\(246, 236, 216/s)
  assert.doesNotMatch(detailWxss, /\.preview-meta\s*\{[^}]*rgba\(255, 253, 247/s)
})
