export type PublishStatus = 'draft' | 'published' | 'disabled'

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
  sceneTags: string[]
  colorTags: string[]
  elementTags: string[]
  seasonTags: string[]
  weatherTags: string[]
  styleTags: string[]
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
  colorTags: string[]
  elementTags: string[]
  sceneTags: string[]
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
