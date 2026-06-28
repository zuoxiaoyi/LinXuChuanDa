const app = getApp()
const { isLoggedIn, requireLogin } = require('../../utils/auth')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const COLOR_RULES = [
  { primary: ['米白', '浅蓝'], secondary: ['卡其', '灰色'], avoid: ['亮红'] },
  { primary: ['绿色', '青色'], secondary: ['米色', '棕色'], avoid: ['纯黑'] },
  { primary: ['杏色', '金色'], secondary: ['白色', '浅黄'], avoid: ['深蓝'] },
  { primary: ['粉色', '紫色'], secondary: ['灰白', '浅咖'], avoid: ['荧光色'] },
  { primary: ['蓝色', '黑色'], secondary: ['银灰', '白色'], avoid: ['橙色'] }
]

Page({
  data: {
    dateList: [],
    selectedDateIndex: 0,
    selectedDay: null,
    cityName: '武汉市',
    regionValue: ['湖北省', '武汉市', '江岸区'],
    weather: {
      status: '天气数据待接入',
      temperature: '--',
      condition: '--',
      wind: '--',
      ultraviolet: '--',
      dressingAdvice: '接入实时天气后，将根据温度、风力和降水情况生成穿衣搭配建议。',
      dressingTags: [],
      skincareAdvice: '接入紫外线、湿度等数据后，将生成防晒与护肤建议。'
    },
    isLogin: false
  },

  onLoad() {
    const savedRegion = wx.getStorageSync('selectedRegion')
    const regionValue = savedRegion || this.data.regionValue
    this.setData({
      dateList: this.buildDateList(),
      selectedDay: this.buildDayDetail(0),
      regionValue,
      cityName: regionValue[1] || '武汉市'
    })
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

  applyDateSelection(index) {
    this.setData({
      selectedDateIndex: index,
      selectedDay: this.buildDayDetail(index)
    })
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
    this.setData({
      regionValue,
      cityName: regionValue[1]
    })
  },

  onGoDetail() {
    const url = `/pages/detail/detail?dateIndex=${this.data.selectedDateIndex}`
    if (!requireLogin('登录后才能查看完整穿搭详情', url)) return
    wx.navigateTo({ url })
  },

  onGoLogin() {
    if (app.globalData.isLogin) {
      wx.reLaunch({ url: '/pages/mine/mine' })
      return
    }
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.selectedDay.dateText}灵序穿搭建议`,
      path: '/pages/index/index'
    }
  }
})
