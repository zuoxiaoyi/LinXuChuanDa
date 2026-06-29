import type {
  Accessory,
  ContentConfig,
  DailyRecommendation,
  DashboardSummary,
  Outfit,
  UserRecord
} from '@/types/domain'

const outfits: Outfit[] = [
  {
    _id: 'demo-outfit-1',
    title: '极简通勤米白套装',
    description: '轻盈米白与淡金细节，适合日常通勤。',
    coverUrl: '',
    sceneTags: ['通勤'],
    colorTags: ['米白', '金色'],
    elementTags: ['金'],
    seasonTags: ['春', '秋'],
    weatherTags: ['晴'],
    styleTags: ['极简'],
    priority: 10,
    status: 'published',
    version: 1
  }
]

const accessories: Accessory[] = [
  {
    _id: 'demo-accessory-1',
    name: '黄水晶',
    description: '温暖明亮',
    imageUrl: '',
    colorTags: ['黄色'],
    elementTags: ['土'],
    sceneTags: ['通勤', '日常'],
    priority: 10,
    status: 'published',
    version: 1
  }
]

const contents: ContentConfig[] = [
  {
    _id: 'demo-content-about',
    key: 'about',
    title: '灵序穿搭简介',
    content: '灵序穿搭，融合东方天时五行智慧与现代穿搭美学。',
    locale: 'zh-CN',
    status: 'published',
    version: 1
  }
]

const users: UserRecord[] = [
  {
    _id: 'demo-user-1',
    nickName: '体验用户',
    avatarUrl: '',
    points: 12,
    totalPoints: 28,
    status: 'active'
  }
]

const recommendations: DailyRecommendation[] = []

function paginate<T>(list: T[], payload: Record<string, any>) {
  const page = Number(payload.page || 1)
  const pageSize = Number(payload.pageSize || 20)
  return {
    list: list.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: list.length
  }
}

export async function callDemoAction(action: string, payload: Record<string, any>) {
  if (action === 'auth.me') {
    return {
      uid: 'demo-admin',
      displayName: 'Demo管理员',
      role: 'super_admin',
      permissions: ['*']
    }
  }
  if (action === 'dashboard.summary') {
    const summary: DashboardSummary = {
      userCount: users.length,
      checkinCount: 1,
      collectionCount: 1,
      publishedRecommendationCount: 0,
      draftRecommendationCount: 0,
      pointIssued: 28
    }
    return summary
  }
  if (action === 'outfits.list') return paginate(outfits, payload)
  if (action === 'accessories.list') return paginate(accessories, payload)
  if (action === 'recommendations.list') return paginate(recommendations, payload)
  if (action === 'content.list') return paginate(contents, payload)
  if (action === 'users.list') return paginate(users, payload)
  if (action.endsWith('.save')) return { _id: payload._id || `demo-${Date.now()}`, ...payload }
  if (action.endsWith('.setStatus')) return { updated: 1 }
  if (action === 'recommendations.generate') return { generated: 0, skipped: 0 }
  if (action === 'points.adjust') return { userId: payload.userId, amount: payload.amount }
  if (action === 'configs.get') {
    return {
      checkin: {
        basePoints: 1,
        multipliers: [
          { multiplier: 2, weight: 50 },
          { multiplier: 3, weight: 30 },
          { multiplier: 4, weight: 15 },
          { multiplier: 5, weight: 5 }
        ]
      },
      unlock: { freeDays: 3, adUnlockDays: 4, costPoints: 5 }
    }
  }
  if (action === 'configs.save') return payload
  return { ok: true }
}
