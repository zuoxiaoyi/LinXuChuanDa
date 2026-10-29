const { isLoggedIn, goToLogin } = require('../../utils/auth')
const { ensurePrivacyAuthorize } = require('../../utils/privacy')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const COLOR_ICON_MAP = {
  绿: '/images/common/color_palette_lv.png',
  青: '/images/common/color_palette_qing.png',
  红: '/images/common/color_palette_hong.png',
  紫: '/images/common/color_palette_zi.png',
  橙: '/images/common/color_palette_cheng.png',
  黄: '/images/common/color_palette_huang.png',
  棕: '/images/common/color_palette_zong.png',
  咖: '/images/common/color_palette_ka.png',
  白: '/images/common/color_palette_bai.png',
  银: '/images/common/color_palette_yin.png',
  灰: '/images/common/color_palette_hui.png',
  黑: '/images/common/color_palette_hei.png',
  蓝: '/images/common/color_palette_lan.png'
}

function toColorItems(colors = []) {
  return colors.map(name => ({
    name,
    icon: COLOR_ICON_MAP[name] || ''
  }))
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function emptyWeather(status = '正在获取天气') {
  return {
    status,
    updatedText: '',
    temperature: '--',
    condition: '--',
    wind: '--',
    ultraviolet: '--',
    dressingAdvice: '天气加载后，将根据温度、风力和降水生成穿衣建议。',
    dressingTags: [],
    careAdvice: '天气加载后，将提供防晒、防风和雨具等出行提醒。'
  }
}

Page({
  data: {
    dateList: [],
    selectedDateIndex: 0,
    selectedDay: null,
    cityName: '武汉',
    regionValue: ['湖北省', '武汉市', '江岸区'],
    weather: emptyWeather(),
    weatherSnapshot: null,
    selectedWeatherLocation: null,
    isLogin: false,
    unlocking: false
  },

  onLoad() {
    const dateList = this.buildDateList()
    this.setData({
      dateList,
      selectedDay: this.buildDayDetail(0, dateList)
    })
    this.loadCalendarColors()
    this.initRewardedVideoAd()
    // 隐私协议授权（首页会调用 wx.getLocation），通过后再获取位置
    ensurePrivacyAuthorize()
      .then(() => this.initializeWeather())
      .catch(() => this.initializeWeather())
  },

  onShow() {
    this.setData({ isLogin: isLoggedIn() })
    this.refreshUnlockStatus()
  },

  onUnload() {
    if (!this.rewardedVideoAd) return
    if (this.handleAdClose) this.rewardedVideoAd.offClose(this.handleAdClose)
    if (this.handleAdError) this.rewardedVideoAd.offError(this.handleAdError)
  },

  buildDateList() {
    const list = []
    const today = new Date()
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      list.push({
        index,
        date: formatDate(date),
        day: date.getDate(),
        month: date.getMonth() + 1,
        week: `周${WEEKDAYS[date.getDay()]}`,
        label: index === 0 ? '今天' : index === 1 ? '明天' : '',
        isLocked: index >= 3
      })
    }
    return list
  },

  buildDayDetail(index, dateList = this.data.dateList) {
    const item = dateList[index]
    if (!item) return null
    const primaryColors = item.colorAdvice?.primary?.colors || []
    const secondaryColors = item.colorAdvice?.secondary?.colors || []
    const avoidColors = item.colorAdvice?.avoid?.colors || []
    return {
      dateText: `${item.month}月${item.day}日`,
      weekText: item.calendar?.weekText || item.week.replace('周', '星期'),
      lunarText: item.calendar
        ? `${item.calendar.lunarYear}年 农历${item.calendar.lunarText}`
        : '农历加载中',
      ganZhiText: item.calendar
        ? `${item.calendar.yearGanZhi}年 ${item.calendar.monthGanZhi}月 ${item.calendar.dayGanZhi}日`
        : '',
      primaryColors,
      secondaryColors,
      avoidColors,
      primaryColorItems: toColorItems(primaryColors),
      secondaryColorItems: toColorItems(secondaryColors),
      avoidColorItems: toColorItems(avoidColors)
    }
  },

  loadCalendarColors() {
    const startDate = this.data.dateList[0]?.date
    if (!startDate) return
    wx.cloud.callFunction({
      name: 'adminApi',
      data: {
        action: 'calendarRecommendations.publicRange',
        payload: { startDate, days: 7 }
      }
    }).then(result => {
      const response = result.result
      if (!response?.success) {
        throw new Error(response?.message || '农历加载失败')
      }
      const calendarMap = new Map(
        (response.data.days || []).map(item => [item.date, item])
      )
      const dateList = this.data.dateList.map(item => ({
        ...item,
        calendar: calendarMap.get(item.date)?.calendar,
        colorAdvice: calendarMap.get(item.date)?.colorAdvice
      }))
      this.setData({
        dateList,
        selectedDay: this.buildDayDetail(this.data.selectedDateIndex, dateList)
      })
    }).catch(() => {
      this.setData({
        'selectedDay.lunarText': '农历加载失败',
        'selectedDay.ganZhiText': '',
        'selectedDay.primaryColors': [],
        'selectedDay.secondaryColors': [],
        'selectedDay.avoidColors': [],
        'selectedDay.primaryColorItems': [],
        'selectedDay.secondaryColorItems': [],
        'selectedDay.avoidColorItems': []
      })
    })
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
    if (!isLoggedIn() || !this.data.dateList.length) return
    const windowStart = this.data.dateList[0].date
    wx.cloud.callFunction({
      name: 'unlockOutfit',
      data: { action: 'getWeekStatus', windowStart }
    }).then(res => {
      if (!res.result?.success) return
      const unlocked = new Set(res.result.unlockedDates || [])
      const dateList = this.data.dateList.map(item => ({
        ...item,
        isLocked: item.index >= 3 && !unlocked.has(item.date)
      }))
      this.setData({
        dateList,
        selectedDay: this.buildDayDetail(this.data.selectedDateIndex, dateList)
      })
    }).catch(() => {})
  },

  callWeather(action, payload) {
    return wx.cloud.callFunction({
      name: 'weatherApi',
      data: { action, payload }
    }).then(result => {
      const response = result.result
      if (!response?.success) {
        throw new Error(response?.message || '天气服务暂时不可用')
      }
      return response.data
    })
  },

  initializeWeather() {
    const savedLocation = wx.getStorageSync('selectedWeatherLocation')
    if (savedLocation?.id) {
      this.loadWeather({ locationId: savedLocation.id }, savedLocation)
      return
    }
    wx.getLocation({
      type: 'gcj02',
      success: location => {
        this.loadWeather({
          longitude: location.longitude,
          latitude: location.latitude
        })
      },
      fail: () => this.loadCityByKeyword('武汉市', true)
    })
  },

  loadCityByKeyword(keyword, locationFailed = false) {
    this.setData({ weather: emptyWeather('正在查询城市') })
    this.callWeather('searchCity', { keyword })
      .then(data => {
        const location = data.locations?.[0]
        if (!location) throw new Error('未找到城市')
        return this.loadWeather({ locationId: location.id }, location, locationFailed)
      })
      .catch(error => this.useWeatherFallback(error.message))
  },

  loadWeather(payload, knownLocation, locationFailed = false) {
    this.setData({ weather: emptyWeather('正在更新天气') })
    return this.callWeather('getWeather', payload)
      .then(snapshot => {
        const location = knownLocation || snapshot.location
        wx.setStorageSync('selectedWeatherLocation', location)
        wx.setStorageSync('lastWeatherSnapshot', snapshot)
        this.setData({
          cityName: snapshot.location.name,
          selectedWeatherLocation: location,
          weatherSnapshot: snapshot
        })
        this.applyWeatherDay(this.data.selectedDateIndex)
        if (locationFailed) {
          wx.showToast({ title: '定位失败，已使用武汉', icon: 'none' })
        }
      })
      .catch(error => this.useWeatherFallback(error.message))
  },

  useWeatherFallback(message) {
    const snapshot = wx.getStorageSync('lastWeatherSnapshot')
    if (snapshot?.days?.length) {
      this.setData({
        cityName: snapshot.location.name,
        selectedWeatherLocation: snapshot.location,
        weatherSnapshot: snapshot
      })
      this.applyWeatherDay(this.data.selectedDateIndex, '缓存天气')
      return
    }
    this.setData({
      weather: {
        ...emptyWeather('天气暂不可用'),
        dressingAdvice: '请按当前季节准备可增减的衣物，并结合出门前的实际体感调整。',
        careAdvice: '建议随身补水；天气变化时注意防晒、防风或携带雨具。'
      }
    })
    if (message) wx.showToast({ title: message, icon: 'none' })
  },

  applyWeatherDay(index, status = '和风天气') {
    const snapshot = this.data.weatherSnapshot
    const day = snapshot?.days?.[index] || snapshot?.days?.[0]
    if (!day) return
    const time = String(snapshot.updatedAt || '').match(/T(\d{2}:\d{2})/)
    this.setData({
      weather: {
        status,
        updatedText: time ? `更新于 ${time[1]}` : '',
        temperature: index === 0 ? snapshot.now.temperature : day.temperature,
        condition: day.condition,
        wind: day.wind,
        ultraviolet: day.ultraviolet,
        dressingAdvice: day.dressingAdvice,
        dressingTags: day.dressingTags || [],
        careAdvice: day.careAdvice
      }
    })
  },

  applyDateSelection(index) {
    this.setData({
      selectedDateIndex: index,
      selectedDay: this.buildDayDetail(index)
    })
    this.applyWeatherDay(index)
  },

  onSelectDate(e) {
    const index = Number(e.currentTarget.dataset.index)
    const dateItem = this.data.dateList[index]
    if (!dateItem) return
    if (dateItem.isLocked) {
      this.onUnlockWeekByAd(index)
      return
    }
    this.applyDateSelection(index)
  },

  onUnlockWeekByAd(index) {
    if (!isLoggedIn()) {
      goToLogin('/pages/index/index')
      return
    }
    wx.showModal({
      title: '解锁未来四天',
      content: this.rewardedVideoAd
        ? '完整观看一次激励视频后，可永久解锁本周后四天穿搭。'
        : '当前版本限时开放，点击后可永久解锁本周后四天穿搭。',
      confirmText: this.rewardedVideoAd ? '看广告解锁' : '立即解锁',
      success: res => {
        if (!res.confirm) return
        this.showUnlockAd(index)
      }
    })
  },

  showUnlockAd(index) {
    if (!this.rewardedVideoAd) {
      this.freeUnlockWeek(index)
      return
    }
    this.pendingUnlockIndex = index
    this.rewardedVideoAd.show().catch(() => {
      this.rewardedVideoAd.load()
        .then(() => this.rewardedVideoAd.show())
        .catch(() => wx.showToast({ title: '广告加载失败', icon: 'none' }))
    })
  },

  freeUnlockWeek(index) {
    this.pendingUnlockIndex = index
    this.completeAdUnlock(`dev-free-unlock-${Date.now()}`)
  },

  completeAdUnlock(adEventId) {
    if (this.data.unlocking) return
    const windowStart = this.data.dateList[0]?.date
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
      this.refreshUnlockStatus()
      if (Number.isInteger(this.pendingUnlockIndex)) {
        this.applyDateSelection(this.pendingUnlockIndex)
      }
    }).catch(error => {
      wx.showToast({ title: error.message || '解锁失败', icon: 'none' })
    }).finally(() => {
      this.pendingUnlockIndex = null
      this.setData({ unlocking: false })
    })
  },

  onRegionChange(e) {
    const regionValue = e.detail.value
    wx.setStorageSync('selectedRegion', regionValue)
    this.setData({ regionValue })
    this.loadCityByKeyword(regionValue[2] || regionValue[1])
  },

  onGoDetail() {
    const url = `/pages/detail/detail?dateIndex=${this.data.selectedDateIndex}`
    if (!isLoggedIn()) {
      goToLogin(url)
      return
    }
    wx.navigateTo({ url })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.selectedDay.dateText}灵序穿搭建议`,
      path: '/pages/index/index'
    }
  }
})
