import { cloudApp, cloudbaseConfigured, demoMode } from './cloudbase'

const tempUrlCache = new Map<string, string>()

function safeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
}

export async function uploadAdminImage(file: File, folder: string) {
  if (!file.type.startsWith('image/')) throw new Error('只能上传图片')
  if (file.size > 3 * 1024 * 1024) throw new Error('图片不能超过3MB')

  if (demoMode) return URL.createObjectURL(file)
  if (!cloudbaseConfigured || !cloudApp) throw new Error('CloudBase尚未配置')

  const now = new Date()
  const datePath = now.toISOString().slice(0, 10)
  const cloudPath = `admin/${folder}/${datePath}/${Date.now()}-${safeName(file.name)}`
  const result = await cloudApp.uploadFile({
    cloudPath,
    filePath: file
  })
  return result.fileID as string
}

export async function resolveCloudFileUrls(fileIds: string[]) {
  const resolved: Record<string, string> = {}
  const uniqueIds = [...new Set(fileIds.filter(Boolean))]
  const pendingCloudIds: string[] = []

  uniqueIds.forEach(fileId => {
    if (!fileId.startsWith('cloud://')) {
      resolved[fileId] = fileId
    } else if (tempUrlCache.has(fileId)) {
      resolved[fileId] = tempUrlCache.get(fileId) || ''
    } else {
      pendingCloudIds.push(fileId)
    }
  })

  if (!pendingCloudIds.length || !cloudbaseConfigured || !cloudApp) return resolved

  try {
    const result = await cloudApp.getTempFileURL({
      fileList: pendingCloudIds.map(fileID => ({ fileID, maxAge: 7200 }))
    })
    for (const file of result?.fileList || []) {
      const tempUrl = file.code === 'SUCCESS' ? file.tempFileURL || '' : ''
      tempUrlCache.set(file.fileID, tempUrl)
      resolved[file.fileID] = tempUrl
    }
  } catch {
    pendingCloudIds.forEach(fileId => {
      resolved[fileId] = ''
    })
  }

  return resolved
}

export async function resolveCloudFileUrl(fileId: string) {
  if (!fileId) return ''
  const resolved = await resolveCloudFileUrls([fileId])
  return resolved[fileId] || ''
}
