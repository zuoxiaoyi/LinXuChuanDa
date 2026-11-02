/**
 * 头像规范化与上传工具（小程序端）
 *
 * 背景 & 踩坑：chooseAvatar 在真机返回的是「临时文件」路径：
 *   - 旧版基础库：wxfile://tmp_xxxx
 *   - 新版基础库：http://tmp/xxxx
 * 这两种都【不是】持久地址。http://tmp/ 在会话结束 / 切页后即失效，
 * 若直接把该路径写库，<image> 之后加载会得到失效链接 → 裂图 / 回退占位图
 * （这正是「昵称正常、头像不显示」的根因：旧逻辑把 http://tmp/ 当成远程地址原样存库）。
 *
 * 处理规则：
 *   - cloud://            → 已持久化，原样返回（不要二次上传，否则 uploadFile 会把 cloud:// 当本地文件 → ERR_PATH）
 *   - 含 qlogo.cn         → 微信默认灰头像，不存（返回 ''，展示时回退占位图）
 *   - https:// 真实远程   → 持久可显示，原样返回
 *   - 其余（http://tmp/、wxfile:// 等临时路径）→ 上传到云存储，返回持久 fileID
 *
 * 重要：iOS 上 wx.cloud.uploadFile 直接读取 http://tmp/ 临时路径经常失败（ERR_PATH / 超时），
 * 因此【一律先复制到 wx.env.USER_DATA_PATH 再用本地稳定路径上传】，成功率最高。
 *
 * @param {string} rawUrl  chooseAvatar 回传的头像地址（或已存库的 cloud://、https 等）
 * @param {string} openid  用于生成云存储路径，缺省时回退唯一随机串
 * @returns {Promise<string>} 可持久化、可展示的地址（cloud:// fileID 或 https）；失败抛错
 */
async function ensureCloudReady() {
  try {
    if (wx.cloud && !wx.cloud.customEnv && !(wx.cloud && wx.cloud.ENV)) {
      wx.cloud.init({ env: 'cloudbase-d7gr1giub2c847b49', traceUser: true })
    }
  } catch (e) {
    // 已初始化时 init 会抛错，忽略即可
  }
}

async function uploadOnce(cloudPath, filePath) {
  const res = await wx.cloud.uploadFile({ cloudPath, filePath })
  if (res && res.statusCode === 200 && res.fileID) return res.fileID
  throw new Error('uploadFile 返回异常: ' + JSON.stringify(res))
}

async function normalizeAvatar(rawUrl, openid = '') {
  console.log('[avatar] normalizeAvatar 入参 rawUrl =', rawUrl)

  if (!rawUrl) {
    console.log('[avatar] rawUrl 为空，返回空')
    return ''
  }

  // 已持久化：直接返回，禁止二次上传（核心防 ERR_PATH）
  if (rawUrl.indexOf('cloud://') === 0) {
    console.log('[avatar] 已是 cloud:// fileID，直接返回:', rawUrl)
    return rawUrl
  }
  // 微信默认灰色头像：不存（展示时回退占位图，避免依赖 qlogo.cn 白名单）
  if (/qlogo\.cn/i.test(rawUrl)) {
    console.log('[avatar] 微信默认头像，返回空')
    return ''
  }
  // 真实远程 https 地址：持久可显示，原样返回
  if (/^https:\/\//i.test(rawUrl)) {
    console.log('[avatar] 已是 https 远程地址，直接返回:', rawUrl)
    return rawUrl
  }

  // 走到这里：http://tmp/、wxfile:// 等本地临时路径 → 复制到 USER_DATA_PATH 后上传
  await ensureCloudReady()

  const fs = wx.getFileSystemManager()
  const ext = (rawUrl.match(/\.(\w+)(?:\?.*)?$/) || [])[1] || 'png'
  const cloudPath = `avatars/${openid || Date.now()}_${Date.now()}.${ext}`
  console.log('[avatar] 目标 cloudPath =', cloudPath, '，临时路径 =', rawUrl)

  // 1) 先尝试直传临时路径
  try {
    const fileID = await uploadOnce(cloudPath, rawUrl)
    console.log('[avatar] 直传成功 fileID =', fileID)
    return fileID
  } catch (directErr) {
    console.warn('[avatar] 直传失败，尝试复制后上传:', directErr)
  }

  // 2) 兜底：用 saveFileSync 把临时文件转成永久本地路径再上传（iOS http://tmp/ 直传不稳的官方推荐做法）
  try {
    const savedPath = fs.saveFileSync(rawUrl)
    console.log('[avatar] saveFileSync 得到永久本地路径:', savedPath)
    const fileID = await uploadOnce(cloudPath, savedPath)
    console.log('[avatar] 转存后上传成功 fileID =', fileID)
    return fileID
  } catch (copyErr) {
    console.error('[avatar] 转存后上传仍失败:', copyErr)
  }

  // 3) 再失败：重试一次直传（应对偶发网络抖动 / 云函数冷启动超时）
  try {
    const fileID = await uploadOnce(cloudPath, rawUrl)
    console.log('[avatar] 重试直传成功 fileID =', fileID)
    return fileID
  } catch (retryErr) {
    console.error('[avatar] 重试仍失败，头像上传彻底失败:', retryErr)
    throw new Error('头像上传失败（ERR_PATH 或云存储超时），请重试')
  }
}

module.exports = { normalizeAvatar }
