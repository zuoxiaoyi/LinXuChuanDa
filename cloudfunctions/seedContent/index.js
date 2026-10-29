/**
 * 云函数 - seedContent
 * 功能：把小程序《用户协议》《隐私政策》的兜底文案写入后台 contentConfigs 集合并发布，
 *       使小程序端优先展示后台维护的版本。
 * 用法：部署后在云开发控制台「云函数 → seedContent → 测试」触发一次即可，
 *       触发成功后可删除本函数（内容已落库）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 与小程序 pages/legal/legal.js 的兜底文案保持一致（去掉"后台已发布…"那条元说明）
const SEED_CONTENT = [
  {
    key: 'user_agreement',
    title: '用户协议',
    content: [
      '欢迎使用灵序穿搭。本协议用于说明你在使用小程序服务时的基本权利与义务。',
      '你可以浏览每日穿搭建议、收藏穿搭方案、签到并使用积分解锁相关内容。请勿利用本服务从事违法违规或侵害他人权益的行为。',
      '灵序穿搭提供的天时五行、颜色与穿搭建议属于生活方式与娱乐参考，不构成医疗、投资、法律等专业建议。'
    ].join('\n'),
    locale: 'zh-CN',
    status: 'published'
  },
  {
    key: 'privacy',
    title: '隐私政策',
    content: [
      '灵序穿搭会在你授权后获取微信头像、昵称等基础资料，用于账号展示、收藏、签到与积分记录。',
      '为了提供天气与穿衣建议，我们可能在你授权后获取位置信息，或使用你手动选择的城市信息。',
      '我们会尽量减少数据收集范围，并仅在实现产品功能、内容安全和必要运营统计时使用相关数据。'
    ].join('\n'),
    locale: 'zh-CN',
    status: 'published'
  }
]

exports.main = async () => {
  const result = { created: 0, skipped: 0, details: [] }

  for (const item of SEED_CONTENT) {
    const exist = await db
      .collection('contentConfigs')
      .where({ key: item.key, locale: item.locale, isDeleted: _.neq(true) })
      .limit(1)
      .get()

    if (exist.data.length > 0) {
      // 已存在则跳过，避免覆盖运营同学在后台的后续编辑
      result.skipped += 1
      result.details.push({ key: item.key, action: 'skipped' })
      continue
    }

    await db.collection('contentConfigs').add({
      data: {
        ...item,
        version: 1,
        isDeleted: false,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    result.created += 1
    result.details.push({ key: item.key, action: 'created' })
  }

  return { success: true, ...result }
}
