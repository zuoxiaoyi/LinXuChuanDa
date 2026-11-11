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

// 与首页 buildDateList 保持一致：前 3 天免费，后 4 天需解锁
const FREE_DAYS = 3
const MAX_DATE_INDEX = 6

const SEASON_NAMES = {
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
  chun: '春', xia: '夏', qiu: '秋', dong: '冬',
  春: '春', 夏: '夏', 秋: '秋', 冬: '冬'
}

const WEATHER_NAMES = {
  sunny: '晴', cloudy: '多云', overcast: '阴', rainy: '雨', rain: '雨',
  snowy: '雪', snow: '雪', windy: '风', foggy: '雾', haze: '霾',
  晴: '晴', 多云: '多云', 阴: '阴', 雨: '雨', 雪: '雪', 风: '风',
  qing: '晴', duoyun: '多云', yin: '阴', yu: '雨', xue: '雪', feng: '风'
}

function codeNames(value, dict) {
  return toArray(value)
    .map(code => dict[String(code).trim()] || '')
    .filter(Boolean)
}

// 相册属性标签：只展示能稳妥转成中文的字段，取不到就跳过，不把原始 code 暴露给用户
function buildBadges(outfit) {
  const badges = []
  const push = (label, value) => {
    if (value) badges.push(`${label} · ${value}`)
  }
  if (outfit.sceneName) push('场景', outfit.sceneName)
  const primary = toColorBadges(outfit.primaryColorCodes || outfit.primaryColors).map(item => item.name)
  const secondary = toColorBadges(outfit.secondaryColorCodes || outfit.secondaryColors).map(item => item.name)
  if (primary.length) push('主色', primary.join('、'))
  if (secondary.length) push('辅助色', secondary.join('、'))
  const seasons = codeNames(outfit.seasonCodes || outfit.seasons, SEASON_NAMES)
  if (seasons.length) push('季节', seasons.join('、'))
  const weathers = codeNames(outfit.weatherCodes || outfit.weathers, WEATHER_NAMES)
  if (weathers.length) push('天气', weathers.join('、'))
  const tempMin = outfit.temperatureMin
  const tempMax = outfit.temperatureMax
  if (tempMin != null && tempMin !== '' && tempMax != null && tempMax !== ''
    && Number.isFinite(Number(tempMin)) && Number.isFinite(Number(tempMax))) {
    push('适温', `${Number(tempMin)}~${Number(tempMax)}℃`)
  }
  toArray(outfit.tags).forEach(tag => badges.push(String(tag)))
  return [...new Set(badges)].slice(0, 8)
}

function toPreviewItem(outfit, rank) {
  return {
    _id: outfit._id || outfit.coverUrl,
    coverUrl: outfit.coverUrl,
    rank,
    displayTitle: outfit.title || `${outfit.sceneName || ''}穿搭`,
    badges: buildBadges(outfit),
    description: outfit.description || ''
  }
}

function buildPreviewList(bestList, secondList) {
  return [
    ...bestList.filter(item => item && item.coverUrl).map(item => toPreviewItem(item, '最佳')),
    ...secondList.filter(item => item && item.coverUrl).map(item => toPreviewItem(item, '次佳'))
  ]
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
    error: '',
    previewVisible: false,
    previewIndex: 0,
    previewList: [],
    windowStartDate: '',
    unlockedDates: [],
    switching: false,
    unlocking: false
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

    this.setData({
      dateIndex,
      windowStartDate: formatDate(new Date())
    })
    this.initRewardedVideoAd()
    this.switchToDate(dateIndex)
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
        singleCollected: !!result.isCollected,
        previewList: result.outfit?.coverUrl
          ? [toPreviewItem({ ...result.outfit, _id: result.outfit._id || id }, '已收藏')]
          : [],
        previewIndex: 0
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
        accessories: Array.isArray(outfitRes.result?.accessories) ? outfitRes.result.accessories : [],
        previewList: buildPreviewList(bestList, secondList),
        previewIndex: 0
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

  onOpenPreview(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.previewList
    if (!list.length) return
    const found = list.findIndex(item => item._id === id)
    this.setData({
      previewVisible: true,
      previewIndex: found >= 0 ? found : 0
    })
  },

  onPreviewChange(e) {
    this.setData({ previewIndex: e.detail.current })
  },

  onPreviewPrev() {
    if (this.data.previewIndex <= 0) return
    this.setData({ previewIndex: this.data.previewIndex - 1 })
  },

  onPreviewNext() {
    if (this.data.previewIndex >= this.data.previewList.length - 1) return
    this.setData({ previewIndex: this.data.previewIndex + 1 })
  },

  onClosePreview() {
    this.setData({ previewVisible: false })
  },

  // 阻止预览层内部点击冒泡到遮罩（否则点属性面板会误关）
  noop() {},

  onUnload() {
    if (!this.rewardedVideoAd) return
    if (this.handleAdClose) this.rewardedVideoAd.offClose(this.handleAdClose)
    if (this.handleAdError) this.rewardedVideoAd.offError(this.handleAdError)
  },

  initRewardedVideoAd() {
    const adUnitId = getApp().globalData.rewardedVideoAdUnitId
    if (!adUnitId || !wx.createRewardedVideoAd) return
    this.rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId })
    this.handleAdClose = res => {
      if (res?.isEnded) {
        this.completeAdUnlock()
        return
      }
      wx.showToast({ title: '完整观看后才能解锁', icon: 'none' })
    }
    this.handleAdError = () => {
      wx.showToast({ title: '广告暂不可用', icon: 'none' })
    }
    this.rewardedVideoAd.onClose(this.handleAdClose)
    this.rewardedVideoAd.onError(this.handleAdError)
  },

  refreshUnlockStatus() {
    const windowStart = this.data.windowStartDate
    if (!windowStart || !isLoggedIn()) return Promise.resolve([])
    return wx.cloud.callFunction({
      name: 'unlockOutfit',
      data: { action: 'getWeekStatus', windowStart }
    }).then(res => {
      if (!res.result?.success) return this.data.unlockedDates || []
      const unlockedDates = res.result.unlockedDates || []
      this.setData({ unlockedDates })
      return unlockedDates
    }).catch(() => this.data.unlockedDates || [])
  },

  dateForIndex(index) {
    const [year, month, day] = this.data.windowStartDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + index)
    return date
  },

  isDateLocked(index, dateKey) {
    return index >= FREE_DAYS && !(this.data.unlockedDates || []).includes(dateKey)
  },

  async switchToDate(index) {
    if (this.data.switching) return
    if (index < 0 || index > MAX_DATE_INDEX) return
    this.setData({ switching: true })
    try {
      await this.refreshUnlockStatus()
      const date = this.dateForIndex(index)
      const dateKey = formatDate(date)
      if (this.isDateLocked(index, dateKey)) {
        this.promptUnlock(index)
        return
      }
      this.applyDateAndLoad(index, date, dateKey)
    } finally {
      this.setData({ switching: false })
    }
  },

  applyDateAndLoad(index, date, dateKey) {
    this.setData({
      dateIndex: index,
      dateKey,
      dateText: `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`,
      previewVisible: false,
      previewIndex: 0,
      previewList: [],
      error: ''
    })
    this.loadDailyOutfits()
  },

  onPrevDay() {
    if (this.data.dateIndex <= 0) {
      wx.showToast({ title: '已经是窗口第一天', icon: 'none' })
      return
    }
    this.switchToDate(this.data.dateIndex - 1)
  },

  onNextDay() {
    if (this.data.dateIndex >= MAX_DATE_INDEX) {
      wx.showToast({ title: '已是本周最后一天', icon: 'none' })
      return
    }
    this.switchToDate(this.data.dateIndex + 1)
  },

  promptUnlock(index) {
    if (!isLoggedIn()) {
      goToLogin(`/pages/detail/detail?dateIndex=${index}`)
      return
    }
    wx.showModal({
      title: '解锁未来四天',
      content: this.rewardedVideoAd
        ? '完整观看一次激励视频后，可永久解锁本周后四天穿搭。'
        : '当前版本限时开放，点击后可永久解锁本周后四天穿搭。',
      confirmText: this.rewardedVideoAd ? '看广告解锁' : '立即解锁',
      success: res => {
        if (res.confirm) this.showUnlockAd(index)
      }
    })
  },

  showUnlockAd(index) {
    this.pendingUnlockIndex = index
    if (!this.rewardedVideoAd) {
      this.freeUnlockWeek()
      return
    }
    this.rewardedVideoAd.show().catch(() => {
      this.rewardedVideoAd.load()
        .then(() => this.rewardedVideoAd.show())
        .catch(() => wx.showToast({ title: '广告加载失败', icon: 'none' }))
    })
  },

  freeUnlockWeek() {
    this.completeAdUnlock(`dev-free-unlock-${Date.now()}`)
  },

  completeAdUnlock(adEventId) {
    if (this.data.unlocking) return
    const windowStart = this.data.windowStartDate
    if (!windowStart) return
    this.setData({ unlocking: true })
    wx.cloud.callFunction({
      name: 'unlockOutfit',
      data: {
        action: 'adUnlockWeek',
        windowStart,
        adEventId: adEventId || `${windowStart}-${Date.now()}`
      }
    }).then(res => {
      if (!res.result?.success) throw new Error(res.result?.msg || '解锁失败')
      wx.showToast({ title: '已解锁本周后四天', icon: 'success' })
      const target = Number.isInteger(this.pendingUnlockIndex)
        ? this.pendingUnlockIndex
        : this.data.dateIndex
      this.pendingUnlockIndex = null
      return this.switchToDate(target)
    }).catch(error => {
      wx.showToast({ title: error.message || '解锁失败', icon: 'none' })
    }).finally(() => {
      this.pendingUnlockIndex = null
      this.setData({ unlocking: false })
    })
  }
})
