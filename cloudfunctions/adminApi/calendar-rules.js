const { Solar } = require('lunar-javascript')

const BRANCH_ELEMENT = Object.freeze({
  子: '水',
  亥: '水',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土',
  寅: '木',
  卯: '木',
  巳: '火',
  午: '火',
  申: '金',
  酉: '金'
})

const ELEMENT_COLORS = Object.freeze({
  木: ['绿', '青'],
  火: ['红', '粉', '紫', '橙'],
  土: ['黄', '棕', '咖', '驼', '杏', '褐'],
  金: ['白', '银', '浅灰', '金属色'],
  水: ['黑', '蓝', '深灰']
})

const GENERATES = Object.freeze({
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木'
})

const CONTROLS = Object.freeze({
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木'
})

function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error('日期格式或日期值不正确')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error('日期格式或日期值不正确')
  }
  return { year, month, day }
}

function buildCalendar(date) {
  const { year, month, day } = parseDate(date)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const dayBranch = lunar.getDayZhi()
  const dayElement = BRANCH_ELEMENT[dayBranch]

  if (!dayElement) throw new Error(`不支持的日支：${dayBranch}`)

  return {
    gregorianDate: date,
    weekText: `星期${solar.getWeekInChinese()}`,
    lunarYear: lunar.getYear(),
    lunarText: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    dayBranch,
    dayElement
  }
}

function buildColorAdvice(dayElement) {
  if (!ELEMENT_COLORS[dayElement]) throw new Error(`不支持的五行：${dayElement}`)

  const primaryElement = GENERATES[dayElement]
  const avoidElement = CONTROLS[dayElement]
  return {
    primary: {
      element: primaryElement,
      colors: [...ELEMENT_COLORS[primaryElement]]
    },
    secondary: {
      element: dayElement,
      colors: [...ELEMENT_COLORS[dayElement]]
    },
    avoid: {
      element: avoidElement,
      colors: [...ELEMENT_COLORS[avoidElement]]
    }
  }
}

function buildCalendarRecommendation(date, ruleVersion) {
  if (!String(ruleVersion || '').trim()) throw new Error('规则版本不能为空')
  const calendar = buildCalendar(date)
  return {
    date,
    calendar,
    colorAdvice: buildColorAdvice(calendar.dayElement),
    ruleVersion: String(ruleVersion).trim(),
    generationMode: 'algorithm',
    manualOverride: false,
    status: 'draft'
  }
}

function formatUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function buildDateRange(startDate, endDate) {
  const startParts = parseDate(startDate)
  const endParts = parseDate(endDate)
  const start = Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  const end = Date.UTC(endParts.year, endParts.month - 1, endParts.day)

  if (start > end) throw new Error('日期范围不正确')

  const dates = []
  for (let time = start; time <= end; time += 86400000) {
    if (dates.length >= 31) throw new Error('单次最多生成31天')
    dates.push(formatUtcDate(new Date(time)))
  }
  return dates
}

module.exports = {
  BRANCH_ELEMENT,
  ELEMENT_COLORS,
  buildCalendar,
  buildColorAdvice,
  buildCalendarRecommendation,
  buildDateRange
}
