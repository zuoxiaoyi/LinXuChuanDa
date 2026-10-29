const { isLoggedIn, goToLogin, requireLogin } = require('../../utils/auth')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const DEFAULT_SCENES = ['通勤', '休闲', '度假']

const COLOR_BADGE_MAP = {
  green: { name: '绿', bgColor: '#4f9660' },
  cyan: { name: '青', bgColor: '#459b94' },
  red: { name: '红', bgColor: '#d34e44' },
  purple: { name: '紫', bgColor: '#8a68a0' },
  orange: { name: '橙', bgColor: '#e58c35' },
  yellow: { name: '黄', bgColor: '#e1bc4a' },
  brown: { name: '棕', bgColor: '#9d704b' },
  coffee: { name: '咖', bgColor: '#7a5335' },
  white: { name: '白', bgColor: '#fffaf1', borderColor: '#d8c8aa' },
  silver: { name: '银', bgColor: '#c8c8c8' },
  gray: { name: '灰', bgColor: '#9a9a9a' },
  black: { name: '黑', bgColor: '#24231f', textColor: '#fff' },
  blue: { name: '蓝', bgColor: '#4879a9', textColor: '#fff' }
}

const COLOR_ALIASES = {
  lv: 'green',
  绿: 'green',
  qing: 'cyan',
  青: 'cyan',
  hong: 'red',
  红: 'red',
  zi: 'purple',
  紫: 'purple',
  cheng: 'orange',
  橙: 'orange',
  huang: 'yellow',
  黄: 'yellow',
  zong: 'brown',
  棕: 'brown',
  ka: 'coffee',
  咖: 'coffee',
  bai: 'white',
  白: 'white',
  yin: 'silver',
  银: 'silver',
  hui: 'gray',
  灰: 'gray',
  hei: 'black',
  黑: 'black',
  lan: 'blue',
  蓝: 'blue'
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  return []
}

function toColorBadges(colors = []) {
  return toArray(colors).map(color => {
    const matched = COLOR_BADGE_MAP[COLOR_ALIASES[color] || color]
    return {
      name: matched?.name || color,
      bgColor: matched?.bgColor || '#eadfc9',
      borderColor: matched?.borderColor || 'rgba(104, 75, 32, .22)',
      textColor: matched?.textColor || '#5d4728'
    }
  })
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function sceneNamesFor(...lists) {
  const names = new Set(DEFAULT_SCENES)
  lists.flat().forEach(item => {
    if (item?.sceneName) names.add(item.sceneName)
  })
  return [...names]
}

function toSceneColumns(list, sceneNames, showSceneName) {
  return sceneNames.map(sceneName => ({
    sceneName,
    showSceneName,
    item: list.find(outfit => outfit.sceneName === sceneName) || null
  }))
}

Page({
  data: {
    singleMode: false,
    outfitId: '',
    singleOutfit: {},
    singleCollected: false,
    dateIndex: 0,
    dateKey: '',
    dateText: '',
    bestList: [],
    secondList: [],
    bestColumns: [],
    secondColumns: [],
    bestColorBadges: [],
    secondColorBadges: [],
    accessories: [],
    collectingId: '',
    loading: true,
    error: ''
  },

  onLoad(options) {
    const id = (options.id || '').trim()
    if (id) {
      const redirectUrl = `/pages/detail/detail?id=${encodeURIComponent(id)}`
      if (!isLoggedIn()) {
        this.setData({ loading: false, singleMode: true, outfitId: id })
        goToLogin(redirectUrl)
        return
      }
      this.setData({ singleMode: true, outfitId: id })
      this.loadSingleOutfit(id)
      return
    }

    const dateIndex = Math.max(0, Math.min(6, Number(options.dateIndex) || 0))
    const redirectUrl = `/pages/detail/detail?dateIndex=${dateIndex}`
    if (!isLoggedIn()) {
      this.setData({ loading: false })
      goToLogin(redirectUrl)
      return
    }

    const date = new Date()
    date.setDate(date.getDate() + dateIndex)
    this.setData({
      dateIndex,
      dateKey: formatDate(date),
      dateText: `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`
    })
    this.loadDailyOutfits()
  },

  async loadSingleOutfit(id) {
    this.setData({ loading: true, error: '' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOutfitDetail',
        data: { outfitId: id }
      })
      const result = res.result || {}
      if (!result.outfit) {
        this.setData({ error: '未找到该穿搭，可能已被下架或删除' })
        return
      }
      this.setData({
        singleOutfit: result.outfit,
        singleCollected: !!result.isCollected
      })
    } catch (err) {
      console.error('加载穿搭详情失败:', err)
      this.setData({ error: '穿搭详情加载失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onToggleCollectSingle() {
    if (!requireLogin('登录后才能收藏单套穿搭')) return
    const outfitId = this.data.outfitId
    const isCollected = this.data.singleCollected
    if (!outfitId || this.data.collectingId) return

    this.setData({ collectingId: outfitId })
    try {
      const res = await wx.cloud.callFunction({
        name: 'collectOutfit',
        data: {
          outfitId,
          action: isCollected ? 'cancel' : 'collect'
        }
      })

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.msg) || '收藏失败')
      }

      this.setData({ singleCollected: !isCollected })
      wx.showToast({
        title: isCollected ? '已取消收藏' : '收藏成功',
        icon: 'success'
      })
    } catch (err) {
      console.error('收藏操作失败:', err)
      wx.showToast({ title: err.message || '收藏失败', icon: 'none' })
    } finally {
      this.setData({ collectingId: '' })
    }
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

  weatherForSelectedDate() {
    const weatherSnapshot = wx.getStorageSync('lastWeatherSnapshot')
    const day = weatherSnapshot?.days?.[this.data.dateIndex] || weatherSnapshot?.days?.[0] || null
    return {
      weatherSnapshot,
      temperature: Number(
        this.data.dateIndex === 0
          ? weatherSnapshot?.now?.temperature
          : String(day?.temperature || '').split('~').pop()
      ),
      condition: day?.condition || ''
    }
  },

  async loadDailyOutfits() {
    this.setData({ loading: true, error: '' })
    try {
      const [calendarDay, profileRes] = await Promise.all([
        this.callCalendar(),
        wx.cloud.callFunction({ name: 'getUserProfile' })
      ])
      const { weatherSnapshot, temperature, condition } = this.weatherForSelectedDate()
      const colorAdvice = calendarDay?.colorAdvice || {}
      const outfitRes = await wx.cloud.callFunction({
        name: 'getOutfits',
        data: {
          mode: 'dailyRecommendation',
          date: this.data.dateKey,
          primaryColors: colorAdvice.primary?.colors || [],
          secondaryColors: colorAdvice.secondary?.colors || [],
          temperature,
          condition,
          weatherSnapshot
        }
      })

      const collections = profileRes.result && Array.isArray(profileRes.result.collections)
        ? profileRes.result.collections
        : []
      const collectedIds = new Set(collections.map(item => item._id))
      const markCollected = list => (Array.isArray(list) ? list : []).map(item => ({
        ...item,
        isCollected: collectedIds.has(item._id)
      }))

      const bestList = markCollected(outfitRes.result?.bestList)
      const secondList = markCollected(outfitRes.result?.secondList)
      const sceneNames = sceneNamesFor(bestList, secondList)

      this.setData({
        dateText: calendarDay?.calendar
          ? `${this.data.dateText} · ${calendarDay.calendar.dayGanZhi}日`
          : this.data.dateText,
        bestColorBadges: toColorBadges(colorAdvice.primary?.colors),
        secondColorBadges: toColorBadges(colorAdvice.secondary?.colors),
        bestList,
        secondList,
        bestColumns: toSceneColumns(bestList, sceneNames, true),
        secondColumns: toSceneColumns(secondList, sceneNames, false),
        accessories: Array.isArray(outfitRes.result?.accessories) ? outfitRes.result.accessories : []
      })
    } catch (err) {
      console.error('加载每日穿搭详情失败:', err)
      this.setData({ error: '穿搭详情加载失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onToggleCollect(e) {
    if (!requireLogin('登录后才能收藏单套穿搭')) return
    const outfitId = e.currentTarget.dataset.id
    const target = [...this.data.bestList, ...this.data.secondList]
      .find(item => item._id === outfitId)
    if (!target || this.data.collectingId) return

    this.setData({ collectingId: outfitId })
    try {
      const res = await wx.cloud.callFunction({
        name: 'collectOutfit',
        data: {
          outfitId,
          action: target.isCollected ? 'cancel' : 'collect'
        }
      })

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.msg) || '收藏失败')
      }

      const updateList = list => list.map(item => (
        item._id === outfitId
          ? { ...item, isCollected: !item.isCollected }
          : item
      ))
      const bestList = updateList(this.data.bestList)
      const secondList = updateList(this.data.secondList)
      const sceneNames = sceneNamesFor(bestList, secondList)
      this.setData({
        bestList,
        secondList,
        bestColumns: toSceneColumns(bestList, sceneNames, true),
        secondColumns: toSceneColumns(secondList, sceneNames, false)
      })
      wx.showToast({
        title: target.isCollected ? '已取消收藏' : '收藏成功',
        icon: 'success'
      })
    } catch (err) {
      console.error('收藏操作失败:', err)
      wx.showToast({ title: err.message || '收藏失败', icon: 'none' })
    } finally {
      this.setData({ collectingId: '' })
    }
  },

  onRetry() {
    if (this.data.singleMode) {
      this.loadSingleOutfit(this.data.outfitId)
      return
    }
    this.loadDailyOutfits()
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ current: url, urls: [url] })
  }
})
