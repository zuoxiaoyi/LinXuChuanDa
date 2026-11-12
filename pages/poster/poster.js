/**
 * 今日穿搭日签（P1 增长功能）
 *
 * 目标：把「当日宜穿色 + 干支 + 最佳穿搭封面 + 小程序码」画成一张 3:4 海报，
 * 用户保存到相册后发朋友圈 / 视频号 / 公众号做日更素材，
 * 好友扫海报上的小程序码直达穿搭详情页 → 把累计 UV 从 69 推向 500。
 *
 * 链路：
 * - 数据：adminApi calendarRecommendations.publicRange（宜穿色 / 干支）
 *        + getOutfits dailyRecommendation（最佳穿搭封面，快照优先算法兜底）
 *        + getShareQrCode（wxacode.getUnlimited，scene=d=YYYYMMDD，落地详情页）
 * - 绘制：canvas type="2d"（app.json renderer 为 webview，支持完整 2d API）
 * - 分享：withShare 包装，好友卡片直达本页（未登录可看，保存 / 进详情再引导登录）
 */
const { toDisplayUrl } = require('../../utils/cloudfile')
const { withShare } = require('../../utils/share')
const { ensurePrivacyAuthorize } = require('../../utils/privacy')
const { toColorBadges } = require('../../utils/color-badges')
const { normalizeDateKey, todayDateKey } = require('../../utils/date-key')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const BRAND = '灵序穿搭'

// 与小程序页面同族配色：深咖头部 + 暖米主体 + 金色点缀
const THEME = {
  headBg: '#3d3529',
  headText: '#f6ecd8',
  headSub: '#c9b28a',
  bodyBg: '#f6ecd8',
  title: '#5d4728',
  text: '#8b806f',
  accent: '#b08a4d',
  cardBg: '#fffdf7'
}

function dateLabelOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    monthDay: `${m}月${d}日`,
    weekday: `星期${WEEKDAYS[date.getDay()]}`
  }
}

/** 扫码 scene（d=YYYYMMDD）或深链 date（YYYY-MM-DD）→ 当天 dateKey */
function resolveDateKey(options) {
  const sceneQuery = decodeURIComponent(String((options && options.scene) || ''))
  const sceneDate = (sceneQuery.match(/(?:^|[&;])d=(\d{8})/) || [])[1]
  return normalizeDateKey(options && options.date) || normalizeDateKey(sceneDate) || todayDateKey()
}

Page(withShare({
  data: {
    dateKey: '',
    loading: true,
    error: '',
    poster: null,
    saving: false,
    canvasW: 319,
    canvasH: 425
  },

  onLoad(options) {
    const dateKey = resolveDateKey(options)
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || {}
    const canvasW = Math.min((info.windowWidth || 375) - 48, 340)
    this.setData({
      dateKey,
      canvasW,
      canvasH: Math.round(canvasW * 4 / 3)
    })
    this.loadPoster()
  },

  onRetry() {
    this.loadPoster()
  },

  callCalendar() {
    return wx.cloud.callFunction({
      name: 'adminApi',
      data: {
        action: 'calendarRecommendations.publicRange',
        payload: { startDate: this.data.dateKey, days: 1 }
      }
    }).then(res => {
      const response = res.result
      if (!response?.success) throw new Error(response?.message || '日历颜色加载失败')
      return response.data.days?.[0] || null
    })
  },

  fetchQrCode() {
    // 失败不阻塞日签生成，只是海报上没有码（好友仍可通过分享卡片进入）
    return wx.cloud.callFunction({
      name: 'getShareQrCode',
      data: { date: this.data.dateKey }
    }).then(res => (res.result && res.result.success ? res.result : null))
      .catch(err => {
        console.warn('[poster] 小程序码获取失败', err)
        return null
      })
  },

  async loadPoster() {
    this.setData({ loading: true, error: '' })
    try {
      const [calendarDay, qrRes] = await Promise.all([
        this.callCalendar(),
        this.fetchQrCode()
      ])
      const colorAdvice = calendarDay?.colorAdvice || {}
      const outfitRes = await wx.cloud.callFunction({
        name: 'getOutfits',
        data: {
          mode: 'dailyRecommendation',
          date: this.data.dateKey,
          primaryColors: colorAdvice.primary?.colors || [],
          secondaryColors: colorAdvice.secondary?.colors || []
        }
      }).catch(err => {
        console.warn('[poster] 穿搭数据获取失败，日签不含穿搭图', err)
        return null
      })
      const best = (outfitRes?.result?.bestList || [])[0] || {}
      const coverUrl = await toDisplayUrl(best.coverUrl || '')
      const { monthDay, weekday } = dateLabelOf(this.data.dateKey)

      this.setData({
        loading: false,
        poster: {
          monthDay,
          weekday,
          ganZhi: calendarDay?.calendar?.dayGanZhi || '',
          badges: toColorBadges(colorAdvice.primary?.colors).slice(0, 4),
          avoidBadges: toColorBadges(colorAdvice.avoid?.colors || colorAdvice.avoid).slice(0, 4),
          coverUrl,
          qrUrl: (qrRes && qrRes.qrUrl) || ''
        }
      }, () => this.initCanvasAndDraw())
    } catch (err) {
      console.error('加载今日日签失败:', err)
      this.setData({ loading: false, error: '日签数据加载失败，请稍后重试' })
    }
  },

  initCanvasAndDraw() {
    const query = this.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true })
    query.exec(res => {
      const info = res && res[0]
      if (!info || !info.node) {
        console.error('[poster] canvas 节点未就绪')
        return
      }
      const canvas = info.node
      const dpr = ((wx.getWindowInfo && wx.getWindowInfo()) || {}).pixelRatio || 2
      canvas.width = Math.round(info.width * dpr)
      canvas.height = Math.round(info.height * dpr)
      this.canvas = canvas
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      this.drawPoster(ctx, info.width, info.height, this.data.poster)
    })
  },

  loadImage(url) {
    return new Promise(resolve => {
      if (!url || !this.canvas) {
        resolve(null)
        return
      }
      const img = this.canvas.createImage()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  },

  async drawPoster(ctx, w, h, poster) {
    if (!poster) return
    const pad = 24

    // 头部：深咖底 + 品牌与日期
    const headH = Math.round(h * 0.25)
    ctx.fillStyle = THEME.headBg
    ctx.fillRect(0, 0, w, headH)
    ctx.textAlign = 'center'
    ctx.fillStyle = THEME.headSub
    ctx.font = '13px sans-serif'
    ctx.fillText(BRAND, w / 2, 30)
    ctx.fillStyle = THEME.headText
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('今日穿搭日签', w / 2, 62)
    ctx.fillStyle = THEME.headSub
    ctx.font = '15px sans-serif'
    ctx.fillText(`${poster.monthDay} · ${poster.weekday}`, w / 2, 94)
    if (poster.ganZhi) {
      ctx.fillStyle = THEME.accent
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(`${poster.ganZhi}日 · 顺时而穿`, w / 2, headH - 18)
    }

    // 主体：暖米底
    ctx.fillStyle = THEME.bodyBg
    ctx.fillRect(0, headH, w, h - headH)

    // 宜穿色区
    const labelY = headH + 32
    ctx.textAlign = 'left'
    ctx.fillStyle = THEME.accent
    ctx.fillRect(pad, labelY - 12, 4, 16)
    ctx.fillStyle = THEME.title
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText('今日宜穿', pad + 12, labelY + 1)

    const badges = poster.badges || []
    const swatchY = labelY + 16
    const gap = 10
    const swatchW = badges.length
      ? Math.min(76, (w - pad * 2 - (badges.length - 1) * gap) / badges.length)
      : 0
    const swatchesW = badges.length * swatchW + (badges.length - 1) * gap
    const swatchX0 = (w - swatchesW) / 2
    badges.forEach((badge, i) => {
      const x = swatchX0 + i * (swatchW + gap)
      ctx.fillStyle = badge.bgColor
      roundRectPath(ctx, x, swatchY, swatchW, swatchW, 8)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = badge.borderColor || 'rgba(104, 75, 32, .22)'
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillStyle = THEME.title
      ctx.font = '13px sans-serif'
      ctx.fillText(badge.name, x + swatchW / 2, swatchY + swatchW + 18)
    })
    const badgesBottom = swatchY + swatchW + 30

    // 底部小程序码卡片（先算位置，封面区才知道可用高度）
    const qrSize = Math.min(96, Math.round(w * 0.3))
    const footH = qrSize + 32
    const footY = h - footH
    roundRectPath(ctx, pad, footY, w - pad * 2, footH, 12)
    ctx.fillStyle = THEME.cardBg
    ctx.fill()
    ctx.strokeStyle = 'rgba(104, 75, 32, .18)'
    ctx.lineWidth = 1
    ctx.stroke()

    const [qrImg, coverImg] = await Promise.all([
      this.loadImage(poster.qrUrl),
      this.loadImage(poster.coverUrl)
    ])

    // 穿搭封面：aspectFit 居中
    const coverTop = badgesBottom + 6
    const coverBottom = footY - 12
    if (coverImg && coverBottom - coverTop > 40) {
      const cw = w - pad * 2
      const ch = coverBottom - coverTop
      const scale = Math.min(cw / coverImg.width, ch / coverImg.height)
      const dw = coverImg.width * scale
      const dh = coverImg.height * scale
      roundRectPath(ctx, (w - dw) / 2, coverTop + (ch - dh) / 2, dw, dh, 10)
      ctx.save()
      ctx.clip()
      ctx.drawImage(coverImg, (w - dw) / 2, coverTop + (ch - dh) / 2, dw, dh)
      ctx.restore()
    }

    // 不宜色小字：有封面时贴底卡上方，无封面时画在剩余区中央
    const avoidNames = (poster.avoidBadges || []).map(b => b.name).join('、')
    ctx.textAlign = 'center'
    if (avoidNames) {
      ctx.fillStyle = THEME.text
      ctx.font = '12px sans-serif'
      if (coverImg && coverBottom - coverTop > 40) {
        ctx.fillText(`今日不宜：${avoidNames}`, w / 2, footY - 6)
      } else {
        ctx.fillText(`今日不宜：${avoidNames}`, w / 2, (badgesBottom + footY) / 2)
      }
    }

    // 小程序码 + 引导文案
    if (qrImg) {
      const qrX = pad + 16
      const qrY = footY + (footH - qrSize) / 2
      ctx.fillStyle = '#fff'
      ctx.fillRect(qrX, qrY, qrSize, qrSize)
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
      ctx.textAlign = 'left'
      ctx.fillStyle = THEME.title
      ctx.font = 'bold 15px sans-serif'
      ctx.fillText('扫码看今日完整搭配', qrX + qrSize + 16, qrY + qrSize / 2 - 8)
      ctx.fillStyle = THEME.text
      ctx.font = '12px sans-serif'
      ctx.fillText('6 套穿搭 · 幸运配饰 · 收藏', qrX + qrSize + 16, qrY + qrSize / 2 + 14)
    } else {
      ctx.textAlign = 'center'
      ctx.fillStyle = THEME.title
      ctx.font = 'bold 15px sans-serif'
      ctx.fillText('长按小程序卡片，查看今日完整搭配', w / 2, footY + footH / 2)
    }
  },

  async onSavePoster() {
    if (!this.canvas || this.data.saving) return
    this.setData({ saving: true })
    try {
      // saveImageToPhotosAlbum 属隐私接口：先过隐私授权，再请求相册写入
      await ensurePrivacyAuthorize()
      const temp = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: this.canvas,
          fileType: 'png',
          quality: 1,
          success: resolve,
          fail: reject
        })
      })
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: temp.tempFilePath,
          success: resolve,
          fail: reject
        })
      })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err) {
      console.error('[poster] 保存失败', err)
      const msg = (err && err.errMsg) || ''
      if (/auth|deny/i.test(msg)) {
        // 用户拒绝相册授权：引导去设置里手动打开，而不是判定为失败
        const res = await wx.showModal({
          title: '需要相册权限',
          content: '打开「添加到相册」权限后才能保存日签海报，也可以直接截图保存。',
          confirmText: '去设置',
          cancelText: '截图保存'
        })
        if (res.confirm) wx.openSetting({})
      } else {
        wx.showToast({ title: '保存失败，可截图保存', icon: 'none' })
      }
    } finally {
      this.setData({ saving: false })
    }
  },

  onGoDetail() {
    if (this.data.singlePageMode) return
    wx.navigateTo({ url: `/pages/detail/detail?date=${this.data.dateKey}` })
  },

  onShareAppMessage() {
    const poster = this.data.poster || {}
    const colors = (poster.badges || []).map(b => b.name).join(' · ')
    return {
      title: `${poster.monthDay || '今天'}宜穿${colors || '这些颜色'}｜灵序穿搭日签`,
      path: `/pages/poster/poster?date=${this.data.dateKey}`
    }
  },

  onShareTimeline() {
    const poster = this.data.poster || {}
    const colors = (poster.badges || []).map(b => b.name).join(' · ')
    return {
      title: `${poster.monthDay || '今天'}宜穿${colors || '这些颜色'}｜灵序穿搭日签`,
      query: `date=${this.data.dateKey}`
    }
  }
}))

/** 圆角矩形路径（基础库旧版本没有 ctx.roundRect，手画最稳） */
function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}
