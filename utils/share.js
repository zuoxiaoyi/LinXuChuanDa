/**
 * 全站分享能力（微信原生）与「朋友圈单页模式」适配
 *
 * 微信官方规则（框架 - 开放能力 - 分享到朋友圈 / Page 接口文档）：
 * - 只有定义了 onShareAppMessage，右上角菜单才显示「转发给朋友」；
 * - 只有定义了 onShareTimeline，右上角菜单才显示「分享到朋友圈」；
 * - 页面要能被分享到朋友圈，必须先满足第一条，也就是两个回调必须成对出现；
 * - onShareTimeline 不支持自定义页面路径，只能带 query，落地页就是当前页；
 * - 好友卡片图显示比例 5:4，朋友圈卡片图 1:1，均只支持 PNG / JPG（不能用 webp）；
 * - 朋友圈打开进入「单页模式」（场景值 1154）：无登录态、禁止任何页面跳转、
 *   tabBar 不渲染、本地存储与普通模式不共用、button open-type / 广告 / 登录接口被禁用；
 * - 基础库 2.11.3+、微信客户端 8.0.24+ 才可用，低版本进入升级提示页。
 *
 * 这里统一包装 Page，给所有页面补齐两个分享回调 + data.singlePageMode，
 * 避免漏写某个页面导致「分享到朋友圈」置灰。
 */

const FRIEND_IMAGE = '/images/common/share-card.png'        // 5:4，转发好友
const TIMELINE_IMAGE = '/images/common/share-timeline.png'  // 1:1，分享朋友圈
const DEFAULT_TITLE = '灵序穿搭 · 顺时穿搭，每天穿出好气色'
const SINGLE_PAGE_SCENE = 1154

/** 是否由朋友圈打开（小程序单页模式） */
function isSinglePageMode() {
  try {
    const options = (wx.getEnterOptionsSync && wx.getEnterOptionsSync())
      || (wx.getLaunchOptionsSync && wx.getLaunchOptionsSync())
      || {}
    return Number(options.scene) === SINGLE_PAGE_SCENE
  } catch (err) {
    return false
  }
}

function resolveOverride(override, ctx, res) {
  if (typeof override === 'function') return override.call(ctx, res) || {}
  return override || {}
}

/**
 * 包装 Page 配置。
 * - 页面自带 onShareAppMessage / onShareTimeline 时以页面实现为准；
 * - overrides.appMessage / overrides.timeline 可传对象或 (res) => 对象，用来定制标题、路径、query；
 * - 不传 path / query 时故意不返回该字段，让微信沿用「当前页面路径及其参数」，
 *   否则会把 detail?id=xxx、legal?type=privacy 这类参数抹掉。
 */
function withShare(pageConfig, overrides = {}) {
  return {
    ...pageConfig,
    data: {
      ...(pageConfig.data || {}),
      singlePageMode: isSinglePageMode()
    },

    onShareAppMessage(res) {
      if (typeof pageConfig.onShareAppMessage === 'function') {
        const own = pageConfig.onShareAppMessage.call(this, res) || {}
        return { imageUrl: FRIEND_IMAGE, ...own }
      }
      const custom = resolveOverride(overrides.appMessage, this, res)
      const payload = {
        title: custom.title || DEFAULT_TITLE,
        imageUrl: custom.imageUrl || FRIEND_IMAGE
      }
      if (custom.path) payload.path = custom.path
      return payload
    },

    onShareTimeline(res) {
      if (typeof pageConfig.onShareTimeline === 'function') {
        return pageConfig.onShareTimeline.call(this, res)
      }
      const custom = resolveOverride(overrides.timeline, this, res)
      const payload = {
        title: custom.title || DEFAULT_TITLE,
        imageUrl: custom.imageUrl || TIMELINE_IMAGE
      }
      if (custom.query !== undefined) payload.query = custom.query
      return payload
    }
  }
}

module.exports = {
  withShare,
  isSinglePageMode,
  FRIEND_IMAGE,
  TIMELINE_IMAGE,
  DEFAULT_TITLE
}
