export type PublishStatus = 'draft' | 'published' | 'disabled'
export type DictionaryType =
  | 'element'
  | 'color'
  | 'scene'
  | 'season'
  | 'weather'
  | 'accessoryType'

export interface TagDictionary {
  _id?: string
  type: DictionaryType
  code: string
  name: string
  colorHex?: string
  elementCode?: string
  order: number
  enabled: boolean
  systemLocked: boolean
  version?: number
}

export interface AdminUser {
  uid: string
  displayName: string
  role: 'super_admin' | 'editor' | 'operator' | 'viewer'
  permissions: string[]
}

export interface Outfit {
  _id?: string
  title: string
  description: string
  coverUrl: string
  primaryColorCodes: string[]
  accentColorCodes: string[]
  elementCodes: string[]
  sceneCodes: string[]
  seasonCodes: string[]
  weatherCodes: string[]
  waterproof: boolean
  windproof: boolean
  breathable: boolean
  inventoryStatus: 'available' | 'unavailable'
  sceneTags?: string[]
  colorTags?: string[]
  elementTags?: string[]
  seasonTags?: string[]
  weatherTags?: string[]
  styleTags?: string[]
  temperatureMin?: number
  temperatureMax?: number
  priority: number
  status: PublishStatus
  version?: number
  updatedAt?: string
}

export interface Accessory {
  _id?: string
  name: string
  description: string
  imageUrl: string
  primaryColorCodes: string[]
  elementCodes: string[]
  sceneCodes: string[]
  accessoryTypeCode: string
  colorTags?: string[]
  elementTags?: string[]
  sceneTags?: string[]
  priority: number
  status: PublishStatus
  version?: number
  updatedAt?: string
}

export interface DailyRecommendation {
  _id?: string
  date: string
  ruleVersion: string
  generationMode: 'algorithm' | 'manual' | 'mixed'
  manualOverride: boolean
  bestOutfits: Array<{ outfitId: string; scene: string; score: number }>
  secondaryOutfits: Array<{ outfitId: string; scene: string; score: number }>
  accessoryIds: string[]
  status: PublishStatus
  version?: number
  updatedAt?: string
}

export type ElementCode = '木' | '火' | '土' | '金' | '水'

export interface ColorAdviceLevel {
  element: ElementCode
  colors: string[]
}

export interface CalendarInfo {
  gregorianDate: string
  weekText: string
  lunarYear: number
  lunarText: string
  yearGanZhi: string
  monthGanZhi: string
  dayGanZhi: string
  dayBranch: string
  dayElement: ElementCode
}

export interface CalendarRecommendation {
  _id?: string
  date: string
  calendar: CalendarInfo
  colorAdvice: {
    primary: ColorAdviceLevel
    secondary: ColorAdviceLevel
    avoid: ColorAdviceLevel
  }
  ruleVersion: string
  generationMode: 'algorithm'
  manualOverride: boolean
  status: PublishStatus
  version?: number
  updatedAt?: string
}

export interface ContentConfig {
  _id?: string
  key: 'about' | 'user_agreement' | 'privacy' | 'share_copy'
  title: string
  content: string
  locale: string
  status: PublishStatus
  version?: number
  updatedAt?: string
}

export interface UserRecord {
  _id: string
  nickName: string
  avatarUrl: string
  points: number
  totalPoints: number
  status?: 'active' | 'disabled'
  createTime?: string
  lastActiveAt?: string
}

export interface DashboardSummary {
  userCount: number
  checkinCount: number
  collectionCount: number
  publishedRecommendationCount: number
  draftRecommendationCount: number
  pointIssued: number
}
