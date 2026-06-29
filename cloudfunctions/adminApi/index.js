const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
})

const db = app.database()
const command = db.command

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  editor: [
    'dashboard.read',
    'outfits.read',
    'outfits.write',
    'outfits.publish',
    'accessories.read',
    'accessories.write',
    'accessories.publish',
    'recommendations.read',
    'recommendations.write',
    'recommendations.publish',
    'content.read',
    'content.write',
    'content.publish',
    'configs.read'
  ],
  operator: [
    'dashboard.read',
    'outfits.read',
    'accessories.read',
    'recommendations.read',
    'content.read',
    'users.read',
    'points.adjust',
    'configs.read',
    'configs.write'
  ],
  viewer: [
    'dashboard.read',
    'outfits.read',
    'accessories.read',
    'recommendations.read',
    'content.read',
    'users.read',
    'configs.read'
  ]
}

const ACTION_PERMISSIONS = {
  'auth.me': null,
  'dashboard.summary': 'dashboard.read',
  'outfits.list': 'outfits.read',
  'outfits.get': 'outfits.read',
  'outfits.save': 'outfits.write',
  'outfits.setStatus': 'outfits.publish',
  'outfits.remove': 'outfits.write',
  'accessories.list': 'accessories.read',
  'accessories.get': 'accessories.read',
  'accessories.save': 'accessories.write',
  'accessories.setStatus': 'accessories.publish',
  'accessories.remove': 'accessories.write',
  'recommendations.list': 'recommendations.read',
  'recommendations.get': 'recommendations.read',
  'recommendations.generate': 'recommendations.write',
  'recommendations.save': 'recommendations.write',
  'recommendations.publish': 'recommendations.publish',
  'recommendations.unpublish': 'recommendations.publish',
  'content.list': 'content.read',
  'content.get': 'content.read',
  'content.save': 'content.write',
  'content.publish': 'content.publish',
  'users.list': 'users.read',
  'users.get': 'users.read',
  'users.pointLedger': 'users.read',
  'points.adjust': 'points.adjust',
  'configs.get': 'configs.read',
  'configs.save': 'configs.write',
  'audit.list': 'audit.read'
}

const COLLECTION_MAP = {
  outfits: 'outfits',
  accessories: 'accessories',
  recommendations: 'dailyRecommendations',
  content: 'contentConfigs'
}

class ApiError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

function success(data, requestId) {
  return { success: true, data, requestId }
}

function failure(error, requestId) {
  if (error instanceof ApiError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      details: error.details,
      requestId
    }
  }
  console.error('adminApi error:', error)
  return {
    success: false,
    code: 'INTERNAL_ERROR',
    message: '服务端处理失败',
    requestId
  }
}

function requiredString(value, field, maxLength = 200) {
  const text = String(value || '').trim()
  if (!text) throw new ApiError('VALIDATION_ERROR', `${field}不能为空`)
  if (text.length > maxLength) {
    throw new ApiError('VALIDATION_ERROR', `${field}不能超过${maxLength}个字符`)
  }
  return text
}

function safeString(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function safeArray(value, maxLength = 30) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => safeString(item, 40)).filter(Boolean))]
    .slice(0, maxLength)
}

function safeNumber(value, fallback = 0, min = -100000, max = 100000) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function firstDocument(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data || null
}

function resolveUid(event, context) {
  // 方式1：CloudBase Web SDK 调用时平台自动注入 userInfo
  if (event?.userInfo?.uid) {
    console.log('resolveUid: from event.userInfo.uid =', event.userInfo.uid)
    return event.userInfo.uid
  }

  // 方式2：@cloudbase/node-sdk 的 auth API
  try {
    const userInfo = app.auth().getUserInfo()
    console.log('resolveUid: auth.getUserInfo =', JSON.stringify(userInfo))
    if (userInfo?.uid) return userInfo.uid
  } catch (e) {
    console.log('resolveUid: auth.getUserInfo failed:', e.message)
  }

  // 方式3：SCF 上下文中的环境变量
  try {
    if (process.env?.TCB_UUID) {
      console.log('resolveUid: from TCB_UUID =', process.env.TCB_UUID)
      return process.env.TCB_UUID
    }
  } catch {}

  // 方式4：event 直接传 uid
  if (event?.uid) {
    console.log('resolveUid: from event.uid =', event.uid)
    return event.uid
  }

  console.log('resolveUid: ALL METHODS FAILED, returning empty string')
  console.log('event keys:', Object.keys(event || {}))
  return ''
}

async function getAdmin(uid) {
  if (!uid) throw new ApiError('UNAUTHENTICATED', '管理员未登录')
  let admin
  try {
    // Node SDK 的单文档查询仍以 data 数组返回。
    const result = await db.collection('adminUsers').doc(uid).get()
    admin = firstDocument(result)
    if (!admin) {
      const list = await db.collection('adminUsers').where({ uid }).limit(1).get()
      admin = firstDocument(list)
    }
  } catch (error) {
    console.log('getAdmin: uid not found in adminUsers. uid:', uid)
    throw new ApiError('FORBIDDEN', '当前账号未加入管理员名单')
  }
  if (!admin || admin.status !== 'active') {
    throw new ApiError('FORBIDDEN', '管理员账号不存在或已停用')
  }
  const rolePermissions = ROLE_PERMISSIONS[admin.role] || []
  return {
    uid,
    displayName: admin.displayName || '管理员',
    role: admin.role,
    permissions: [...new Set([...rolePermissions, ...(admin.permissions || [])])]
  }
}

function assertPermission(admin, permission) {
  if (!permission) return
  if (!admin.permissions.includes('*') && !admin.permissions.includes(permission)) {
    throw new ApiError('FORBIDDEN', '当前账号没有执行此操作的权限')
  }
}

async function writeAudit(admin, action, targetType, targetId, summary, requestId) {
  try {
    await db.collection('auditLogs').add({
      data: {
        operatorUid: admin.uid,
        operatorName: admin.displayName,
        action,
        targetType,
        targetId: targetId || '',
        summary: safeString(summary, 500),
        requestId,
        createdAt: db.serverDate()
      }
    })
  } catch (error) {
    console.error('audit log write failed:', error)
  }
}

function pageArgs(payload) {
  return {
    page: Math.max(1, safeNumber(payload.page, 1, 1, 100000)),
    pageSize: Math.max(1, safeNumber(payload.pageSize, 20, 1, 100))
  }
}

async function listCollection(
  collectionName,
  payload,
  searchField,
  orderField = 'updatedAt'
) {
  const { page, pageSize } = pageArgs(payload)
  const where = { isDeleted: command.neq(true) }
  if (payload.status) where.status = payload.status
  if (payload.userId) where.userId = payload.userId
  if (payload.keyword && searchField) {
    where[searchField] = db.RegExp({
      regexp: safeString(payload.keyword, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    })
  }

  const collection = db.collection(collectionName).where(where)
  const [dataResult, countResult] = await Promise.all([
    collection
      .orderBy(orderField, 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    collection.count()
  ])

  return {
    list: dataResult.data,
    page,
    pageSize,
    total: countResult.total
  }
}

async function getDocument(collectionName, id) {
  if (!id) throw new ApiError('VALIDATION_ERROR', '缺少数据ID')
  try {
    const result = await db.collection(collectionName).doc(id).get()
    const document = firstDocument(result)
    if (!document || document.deletedAt) throw new Error('not found')
    return document
  } catch (error) {
    throw new ApiError('NOT_FOUND', '数据不存在或已删除')
  }
}

async function saveDocument(collectionName, input, admin, requestId, sanitizer) {
  const id = input._id || input.id
  const data = sanitizer(input)
  const nowData = {
    ...data,
    updatedAt: db.serverDate(),
    updatedBy: admin.uid,
    isDeleted: false,
    deletedAt: null
  }

  if (!id) {
    const result = await db.collection(collectionName).add({
      data: {
        ...nowData,
        version: 1,
        createdAt: db.serverDate(),
        createdBy: admin.uid
      }
    })
    await writeAudit(admin, 'create', collectionName, result._id, data.title || data.name, requestId)
    return { _id: result._id, ...data, version: 1 }
  }

  const current = await getDocument(collectionName, id)
  const expectedVersion = safeNumber(input.version, 0, 0)
  if (expectedVersion !== current.version) {
    throw new ApiError('VERSION_CONFLICT', '数据已被其他管理员修改，请刷新后重试')
  }
  await db.collection(collectionName).doc(id).update({
    data: {
      ...nowData,
      version: current.version + 1
    }
  })
  await writeAudit(admin, 'update', collectionName, id, data.title || data.name, requestId)
  return { _id: id, ...data, version: current.version + 1 }
}

function sanitizeOutfit(input) {
  return {
    title: requiredString(input.title, '穿搭名称', 50),
    description: requiredString(input.description, '搭配说明', 500),
    coverUrl: safeString(input.coverUrl, 500),
    images: safeArray(input.images, 12),
    items: Array.isArray(input.items) ? input.items.slice(0, 30) : [],
    sceneTags: safeArray(input.sceneTags),
    colorTags: safeArray(input.colorTags),
    elementTags: safeArray(input.elementTags, 5),
    seasonTags: safeArray(input.seasonTags, 4),
    weatherTags: safeArray(input.weatherTags),
    styleTags: safeArray(input.styleTags),
    temperatureMin: safeNumber(input.temperatureMin, 0, -50, 60),
    temperatureMax: safeNumber(input.temperatureMax, 35, -50, 60),
    gender: safeString(input.gender || 'female', 20),
    priority: safeNumber(input.priority, 0, -100, 100),
    inventoryStatus: safeString(input.inventoryStatus || 'available', 20),
    status: ['draft', 'published', 'disabled'].includes(input.status)
      ? input.status
      : 'draft'
  }
}

function sanitizeAccessory(input) {
  return {
    name: requiredString(input.name, '配饰名称', 40),
    description: requiredString(input.description, '配饰说明', 160),
    imageUrl: safeString(input.imageUrl, 500),
    colorTags: safeArray(input.colorTags),
    elementTags: safeArray(input.elementTags, 5),
    sceneTags: safeArray(input.sceneTags),
    priority: safeNumber(input.priority, 0, -100, 100),
    status: ['draft', 'published', 'disabled'].includes(input.status)
      ? input.status
      : 'draft'
  }
}

function sanitizeContent(input) {
  const allowedKeys = ['about', 'user_agreement', 'privacy', 'share_copy']
  if (!allowedKeys.includes(input.key)) {
    throw new ApiError('VALIDATION_ERROR', '不支持的内容类型')
  }
  return {
    key: input.key,
    title: requiredString(input.title, '标题', 80),
    content: requiredString(input.content, '正文', 10000),
    locale: safeString(input.locale || 'zh-CN', 20),
    status: ['draft', 'published', 'disabled'].includes(input.status)
      ? input.status
      : 'draft'
  }
}

function sanitizeRecommendation(input) {
  return {
    date: requiredString(input.date, '日期', 10),
    calendar: input.calendar || {},
    colorAdvice: input.colorAdvice || { primary: [], secondary: [], avoid: [] },
    weatherSnapshot: input.weatherSnapshot || null,
    dressingAdvice: input.dressingAdvice || { text: '', tags: [] },
    skincareAdvice: input.skincareAdvice || { text: '' },
    bestOutfits: Array.isArray(input.bestOutfits) ? input.bestOutfits.slice(0, 12) : [],
    secondaryOutfits: Array.isArray(input.secondaryOutfits)
      ? input.secondaryOutfits.slice(0, 12)
      : [],
    accessoryIds: safeArray(input.accessoryIds, 12),
    ruleVersion: requiredString(input.ruleVersion, '规则版本', 30),
    generationMode: ['algorithm', 'manual', 'mixed'].includes(input.generationMode)
      ? input.generationMode
      : 'manual',
    manualOverride: Boolean(input.manualOverride),
    status: ['draft', 'published', 'disabled'].includes(input.status)
      ? input.status
      : 'draft'
  }
}

async function setStatus(collectionName, payload, admin, requestId) {
  const current = await getDocument(collectionName, payload.id)
  if (safeNumber(payload.version, 0, 0) !== current.version) {
    throw new ApiError('VERSION_CONFLICT', '数据版本已变化，请刷新后重试')
  }
  const status = safeString(payload.status, 20)
  if (!['draft', 'published', 'disabled'].includes(status)) {
    throw new ApiError('VALIDATION_ERROR', '非法状态')
  }
  await db.collection(collectionName).doc(payload.id).update({
    data: {
      status,
      version: current.version + 1,
      updatedAt: db.serverDate(),
      updatedBy: admin.uid
    }
  })
  await writeAudit(admin, 'setStatus', collectionName, payload.id, status, requestId)
  return { updated: 1, version: current.version + 1 }
}

async function removeDocument(collectionName, payload, admin, requestId) {
  const current = await getDocument(collectionName, payload.id)
  if (safeNumber(payload.version, 0, 0) !== current.version) {
    throw new ApiError('VERSION_CONFLICT', '数据版本已变化，请刷新后重试')
  }
  await db.collection(collectionName).doc(payload.id).update({
    data: {
      status: 'disabled',
      isDeleted: true,
      deletedAt: db.serverDate(),
      updatedAt: db.serverDate(),
      updatedBy: admin.uid,
      version: current.version + 1
    }
  })
  await writeAudit(admin, 'remove', collectionName, payload.id, '', requestId)
  return { removed: 1 }
}

function dateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00+08:00`)
  const end = new Date(`${endDate}T00:00:00+08:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new ApiError('VALIDATION_ERROR', '日期范围不正确')
  }
  const list = []
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
    if (list.length >= 31) throw new ApiError('VALIDATION_ERROR', '单次最多生成31天')
    list.push(cursor.toISOString().slice(0, 10))
  }
  return list
}

async function generateRecommendations(payload, admin, requestId) {
  const dates = dateRange(payload.startDate, payload.endDate)
  const ruleVersion = requiredString(payload.ruleVersion, '规则版本', 30)
  let generated = 0
  let skipped = 0

  for (const date of dates) {
    const existing = await db.collection('dailyRecommendations').where({
      date,
      isDeleted: command.neq(true)
    }).limit(1).get()
    if (existing.data.length) {
      skipped += 1
      continue
    }
    await db.collection('dailyRecommendations').add({
      data: {
        date,
        calendar: {},
        colorAdvice: { primary: [], secondary: [], avoid: [] },
        weatherSnapshot: null,
        dressingAdvice: { text: '', tags: [] },
        skincareAdvice: { text: '' },
        bestOutfits: [],
        secondaryOutfits: [],
        accessoryIds: [],
        ruleVersion,
        generationMode: 'algorithm',
        manualOverride: false,
        status: 'draft',
        version: 1,
        createdAt: db.serverDate(),
        createdBy: admin.uid,
        updatedAt: db.serverDate(),
        updatedBy: admin.uid,
        isDeleted: false,
        deletedAt: null
      }
    })
    generated += 1
  }
  await writeAudit(
    admin,
    'generate',
    'dailyRecommendations',
    '',
    `${payload.startDate}~${payload.endDate}, generated=${generated}`,
    requestId
  )
  return { generated, skipped }
}

async function publishRecommendation(payload, admin, requestId) {
  const current = await getDocument('dailyRecommendations', payload.id)
  if (safeNumber(payload.version, 0, 0) !== current.version) {
    throw new ApiError('VERSION_CONFLICT', '建议版本已变化，请刷新后重试')
  }
  if (
    (current.bestOutfits || []).length < 3
    || (current.secondaryOutfits || []).length < 3
    || (current.accessoryIds || []).length < 1
  ) {
    throw new ApiError(
      'VALIDATION_ERROR',
      '发布前至少配置3套最佳、3套次佳和1个幸运配饰'
    )
  }
  await db.collection('dailyRecommendations').doc(payload.id).update({
    data: {
      status: 'published',
      publishAt: db.serverDate(),
      version: current.version + 1,
      updatedAt: db.serverDate(),
      updatedBy: admin.uid
    }
  })
  await writeAudit(admin, 'publish', 'dailyRecommendations', payload.id, current.date, requestId)
  return { published: 1, version: current.version + 1 }
}

async function dashboardSummary() {
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [
    users,
    checkins,
    collections,
    published,
    drafts
  ] = await Promise.all([
    db.collection('users').count(),
    db.collection('checkins').where({ date: today }).count(),
    db.collection('collections').count(),
    db.collection('dailyRecommendations').where({ status: 'published' }).count(),
    db.collection('dailyRecommendations').where({ status: 'draft' }).count()
  ])
  const pointResult = await db.collection('users').field({ totalPoints: true }).limit(1000).get()
  const pointIssued = pointResult.data.reduce(
    (sum, user) => sum + safeNumber(user.totalPoints, 0, 0),
    0
  )
  return {
    userCount: users.total,
    checkinCount: checkins.total,
    collectionCount: collections.total,
    publishedRecommendationCount: published.total,
    draftRecommendationCount: drafts.total,
    pointIssued
  }
}

async function listUsers(payload) {
  const { page, pageSize } = pageArgs(payload)
  const where = {}
  if (payload.status) where.status = payload.status
  if (payload.keyword) {
    where.nickName = db.RegExp({
      regexp: safeString(payload.keyword, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    })
  }
  const collection = db.collection('users').where(where)
  const [dataResult, countResult] = await Promise.all([
    collection.skip((page - 1) * pageSize).limit(pageSize).get(),
    collection.count()
  ])
  return { list: dataResult.data, page, pageSize, total: countResult.total }
}

async function adjustPoints(payload, admin, requestId) {
  const userId = requiredString(payload.userId, '用户ID', 100)
  const amount = safeNumber(payload.amount, 0, -10000, 10000)
  const reason = requiredString(payload.reason, '调整原因', 200)
  const idempotencyKey = requiredString(payload.idempotencyKey, '幂等键', 100)
  if (!amount) throw new ApiError('VALIDATION_ERROR', '积分变化量不能为0')

  const duplicated = await db.collection('pointLedger').where({ idempotencyKey }).limit(1).get()
  if (duplicated.data.length) throw new ApiError('DUPLICATE', '该积分调整已处理')
  const user = await getDocument('users', userId)
  if ((user.points || 0) + amount < 0) {
    throw new ApiError('VALIDATION_ERROR', '扣减后积分不能小于0')
  }

  const result = await db.runTransaction(async transaction => {
    const latestResult = await transaction.collection('users').doc(userId).get()
    const latest = firstDocument(latestResult)
    if (!latest) throw new ApiError('NOT_FOUND', '用户不存在')
    if ((latest.points || 0) + amount < 0) {
      throw new ApiError('VALIDATION_ERROR', '扣减后积分不能小于0')
    }
    await transaction.collection('users').doc(userId).update({
      data: {
        points: command.inc(amount),
        totalPoints: amount > 0 ? command.inc(amount) : command.inc(0)
      }
    })
    const ledgerResult = await transaction.collection('pointLedger').add({
      data: {
        _openid: user._openid || '',
        userId,
        amount,
        balanceAfter: (latest.points || 0) + amount,
        type: 'admin_adjustment',
        reason,
        idempotencyKey,
        operatorUid: admin.uid,
        createdAt: db.serverDate()
      }
    })
    return { userId, amount, ledgerId: ledgerResult._id }
  })
  await writeAudit(admin, 'points.adjust', 'users', userId, `${amount}: ${reason}`, requestId)
  return result
}

async function getConfigs() {
  const result = await db.collection('appConfigs').where({
    key: command.in(['checkin', 'unlock'])
  }).get()
  const map = Object.fromEntries(result.data.map(item => [item.key, item.value]))
  return {
    checkin: map.checkin || {
      basePoints: 1,
      multipliers: [
        { multiplier: 2, weight: 50 },
        { multiplier: 3, weight: 30 },
        { multiplier: 4, weight: 15 },
        { multiplier: 5, weight: 5 }
      ]
    },
    unlock: map.unlock || { freeDays: 3, adUnlockDays: 4, costPoints: 5 }
  }
}

async function saveConfigs(payload, admin, requestId) {
  const multipliers = Array.isArray(payload.checkin?.multipliers)
    ? payload.checkin.multipliers.map(item => ({
        multiplier: safeNumber(item.multiplier, 2, 2, 5),
        weight: safeNumber(item.weight, 0, 0, 100)
      }))
    : []
  const totalWeight = multipliers.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight !== 100) {
    throw new ApiError('VALIDATION_ERROR', '签到倍率概率之和必须等于100')
  }
  const values = {
    checkin: {
      basePoints: safeNumber(payload.checkin?.basePoints, 1, 1, 100),
      multipliers
    },
    unlock: {
      freeDays: safeNumber(payload.unlock?.freeDays, 3, 1, 7),
      adUnlockDays: safeNumber(payload.unlock?.adUnlockDays, 4, 1, 14),
      costPoints: safeNumber(payload.unlock?.costPoints, 5, 1, 999)
    }
  }
  for (const [key, value] of Object.entries(values)) {
    const existing = await db.collection('appConfigs').where({ key }).limit(1).get()
    if (existing.data.length) {
      await db.collection('appConfigs').doc(existing.data[0]._id).update({
        data: { value, updatedAt: db.serverDate(), updatedBy: admin.uid }
      })
    } else {
      await db.collection('appConfigs').add({
        data: { key, value, createdAt: db.serverDate(), updatedAt: db.serverDate(), updatedBy: admin.uid }
      })
    }
  }
  await writeAudit(admin, 'configs.save', 'appConfigs', '', 'checkin,unlock', requestId)
  return values
}

async function route(action, payload, admin, requestId) {
  if (action === 'dashboard.summary') return dashboardSummary()

  const [domain, operation] = action.split('.')
  const collectionName = COLLECTION_MAP[domain]
  if (collectionName) {
    if (operation === 'list') {
      const searchField = domain === 'outfits'
        ? 'title'
        : domain === 'accessories'
          ? 'name'
          : domain === 'content'
            ? 'title'
            : null
      return listCollection(collectionName, payload, searchField)
    }
    if (operation === 'get') return getDocument(collectionName, payload.id)
    if (operation === 'remove') {
      return removeDocument(collectionName, payload, admin, requestId)
    }
    if (operation === 'setStatus') {
      return setStatus(collectionName, payload, admin, requestId)
    }
  }

  if (action === 'outfits.save') {
    return saveDocument('outfits', payload, admin, requestId, sanitizeOutfit)
  }
  if (action === 'accessories.save') {
    return saveDocument('accessories', payload, admin, requestId, sanitizeAccessory)
  }
  if (action === 'recommendations.save') {
    return saveDocument(
      'dailyRecommendations',
      payload,
      admin,
      requestId,
      sanitizeRecommendation
    )
  }
  if (action === 'recommendations.generate') {
    return generateRecommendations(payload, admin, requestId)
  }
  if (action === 'recommendations.publish') {
    return publishRecommendation(payload, admin, requestId)
  }
  if (action === 'recommendations.unpublish') {
    return setStatus(
      'dailyRecommendations',
      { ...payload, status: 'draft' },
      admin,
      requestId
    )
  }
  if (action === 'content.save') {
    const duplicate = await db.collection('contentConfigs').where({
      key: payload.key,
      locale: payload.locale || 'zh-CN',
      isDeleted: command.neq(true)
    }).limit(1).get()
    if (!payload._id && duplicate.data.length) {
      payload._id = duplicate.data[0]._id
      payload.version = duplicate.data[0].version
    }
    return saveDocument('contentConfigs', payload, admin, requestId, sanitizeContent)
  }
  if (action === 'content.publish') {
    return setStatus(
      'contentConfigs',
      { ...payload, status: 'published' },
      admin,
      requestId
    )
  }
  if (action === 'users.list') return listUsers(payload)
  if (action === 'users.get') return getDocument('users', payload.id)
  if (action === 'users.pointLedger') {
    return listCollection(
      'pointLedger',
      { ...payload, userId: payload.id },
      null,
      'createdAt'
    )
  }
  if (action === 'points.adjust') return adjustPoints(payload, admin, requestId)
  if (action === 'configs.get') return getConfigs()
  if (action === 'configs.save') return saveConfigs(payload, admin, requestId)
  if (action === 'audit.list') {
    return listCollection('auditLogs', payload, null, 'createdAt')
  }

  throw new ApiError('NOT_FOUND', '不支持的后台操作')
}

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    const action = requiredString(event.action, 'action', 80)
    if (!(action in ACTION_PERMISSIONS)) {
      throw new ApiError('NOT_FOUND', '不支持的后台操作')
    }

    const uid = resolveUid(event, context)

    // auth.me 必须返回经过管理员名单校验的管理员身份。
    // 普通 CloudBase 用户不是后台管理员，不能包装成成功响应。
    if (action === 'auth.me') {
      const admin = await getAdmin(uid)
      return success(admin, requestId)
    }

    // 其他操作必须登录
    const admin = await getAdmin(uid)
    assertPermission(admin, ACTION_PERMISSIONS[action])
    const data = await route(action, event.payload || {}, admin, requestId)
    return success(data, requestId)
  } catch (error) {
    return failure(error, requestId)
  }
}
