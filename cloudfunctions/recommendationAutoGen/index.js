// 定时任务：在每月最后一天 23:59:59 触发，自动生成「次月」整月的每日建议草稿。
// 与 calendarAutoGen 完全同构（同一个 cron、同一套月末判断、同一个 __timer__ 安全约定），
// 但写入的是 dailyRecommendations 集合，两者互不干扰。
//
// 设计要点：
// 1. 每天 23:59:59 都会跑（cron 设为每天），只有「计划触发日期是当月最后一天」才真正生成，
//    其余日期直接 return，开销极小。
// 2. 以定时触发器传入的 triggerTime（计划触发时间，东八区）为判断基准，
//    避免云函数排队延迟到次日凌晨导致日期判断错位。
// 3. 生成逻辑复用 adminApi 的 recommendations.autoGenerateMonth，只维护一份写库规则。
// 4. 生成的是草稿，内容与发布校验规则（3 套最佳 / 3 套次佳 / 1 个配饰）对齐，
//    运营可在「每日建议」页复核后批量发布。

const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
})

// 解析定时触发器事件里的计划触发日期（东八区 YYYY-MM-DD）。
// CloudBase 定时触发器触发时 event.triggerTime 形如 "2026-11-30 23:59:59"。
function parsePlanDate(event) {
  if (event && typeof event.triggerTime === 'string') {
    const m = event.triggerTime.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    }
  }
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

exports.main = async (event = {}) => {
  const planDate = parsePlanDate(event)

  // 判断 planDate 是否为当月最后一天：它的「下一天」是否跨入新月份
  const next = new Date(Date.UTC(
    planDate.getUTCFullYear(),
    planDate.getUTCMonth(),
    planDate.getUTCDate() + 1
  ))
  const isMonthEnd =
    next.getUTCMonth() !== planDate.getUTCMonth() ||
    next.getUTCFullYear() !== planDate.getUTCFullYear()

  if (!isMonthEnd) {
    return {
      triggered: false,
      reason: 'not-month-end',
      planDate: planDate.toISOString().slice(0, 10)
    }
  }

  // 次月 = next 所在月份（下一天已跨月，其月份即目标月）
  const targetYear = next.getUTCFullYear()
  const targetMonth = next.getUTCMonth() + 1
  const mm = String(targetMonth).padStart(2, '0')
  const startDate = `${targetYear}-${mm}-01`
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const endDate = `${targetYear}-${mm}-${String(lastDay).padStart(2, '0')}`

  const res = await app.callFunction({
    name: 'adminApi',
    data: {
      action: 'recommendations.autoGenerateMonth',
      __timer__: true,
      payload: {
        startDate,
        endDate,
        ruleVersion: (event && event.ruleVersion) || '2026.1'
      }
    }
  })

  return {
    triggered: true,
    generatedMonth: startDate.slice(0, 7),
    result: res.result
  }
}
