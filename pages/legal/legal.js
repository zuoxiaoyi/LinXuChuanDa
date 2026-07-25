const CONTENT_MAP = {
  user_agreement: {
    title: '用户协议',
    content: [
      '欢迎使用灵序穿搭。本协议用于说明你在使用小程序服务时的基本权利与义务。',
      '你可以浏览每日穿搭建议、收藏穿搭方案、签到并使用积分解锁相关内容。请勿利用本服务从事违法违规或侵害他人权益的行为。',
      '灵序穿搭提供的天时五行、颜色与穿搭建议属于生活方式与娱乐参考，不构成医疗、投资、法律等专业建议。',
      '如后台已发布正式协议内容，小程序将优先展示后台配置版本。'
    ].join('\n')
  },
  privacy: {
    title: '隐私政策',
    content: [
      '灵序穿搭会在你授权后获取微信头像、昵称等基础资料，用于账号展示、收藏、签到与积分记录。',
      '为了提供天气与穿衣建议，我们可能在你授权后获取位置信息，或使用你手动选择的城市信息。',
      '我们会尽量减少数据收集范围，并仅在实现产品功能、内容安全和必要运营统计时使用相关数据。',
      '如后台已发布正式隐私政策内容，小程序将优先展示后台配置版本。'
    ].join('\n')
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toHtml(content) {
  return escapeHtml(content)
    .split(/\n{1,}/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `<p>${item}</p>`)
    .join('')
}

Page({
  data: {
    type: 'user_agreement',
    title: CONTENT_MAP.user_agreement.title,
    htmlContent: toHtml(CONTENT_MAP.user_agreement.content)
  },

  onLoad(options = {}) {
    const type = CONTENT_MAP[options.type] ? options.type : 'user_agreement'
    const fallback = CONTENT_MAP[type]
    this.setData({
      type,
      title: fallback.title,
      htmlContent: toHtml(fallback.content)
    })
    this.loadContent(type)
  },

  async loadContent(type) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: {
          action: 'content.publicGet',
          payload: { key: type, locale: 'zh-CN' }
        }
      })
      const data = res.result?.data
      if (!res.result?.success || !data?.content) return
      this.setData({
        title: data.title || CONTENT_MAP[type].title,
        htmlContent: toHtml(data.content)
      })
    } catch (error) {
      console.warn('加载协议内容失败，使用本地兜底文案', error)
    }
  }
})
