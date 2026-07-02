const { isLoggedIn, goToLogin } = require('../../utils/auth')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const COLOR_RULES = [
  { primary: ['米白', '浅蓝'], secondary: ['卡其', '灰色'], avoid: ['亮红'] },
  { primary: ['绿色', '青色'], secondary: ['米色', '棕色'], avoid: ['纯黑'] },
  { primary: ['杏色', '金色'], secondary: ['白色', '浅黄'], avoid: ['深蓝'] },
  { primary: ['粉色', '紫色'], secondary: ['灰白', '浅咖'], avoid: ['荧光色'] },
  { primary: ['蓝色', '黑色'], secondary: ['银灰', '白色'], avoid: ['橙色'] }
]

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
    isLogin: false
  },

  onLoad() {
    this.setData({
      dateList: this.buildDateList(),
      selectedDay: this.buildDayDetail(0)
    })
    this.initializeWeather()
  },

  onShow() {
    this.setData({ isLogin: isLoggedIn() })
  },

  buildDateList() {
    const list = []
    const today = new Date()
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      list.push({
        index,
        day: date.getDate(),
        month: date.getMonth() + 1,
        week: `周${WEEKDAYS[date.getDay()]}`,
        label: index === 0 ? '今天' : index === 1 ? '明天' : '',
        isLocked: index >= 3
      })
    }
    return list
  },

  buildDayDetail(index) {
    const date = new Date()
    date.setDate(date.getDate() + index)
    const colorRule = COLOR_RULES[
      (date.getFullYear() + date.getMonth() + date.getDate()) % COLOR_RULES.length
    ]
    return {
      dateText: `${date.getMonth() + 1}月${date.getDate()}日`,
      weekText: `星期${WEEKDAYS[date.getDay()]}`,
      primaryColors: colorRule.primary,
      secondaryColors: colorRule.secondary,
      avoidColors: colorRule.avoid
    }
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
      wx.showModal({
        title: '日期尚未解锁',
        content: '前三天可免费查看。观看一次激励视频后，可解锁本周后四天。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    this.applyDateSelection(index)
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
