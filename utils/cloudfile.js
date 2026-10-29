/**
 * 云存储文件 ID（cloud://）→ 可显示地址工具
 *
 * 背景：项目使用 Skyline 渲染（app.json renderer: "skyline"）。
 * Skyline 下 <image src="cloud://xxx"> 不会走云存储解析，而是被当成相对路径，
 * 拼成 http://127.0.0.1:xxxx/__pageframe__/pages/xxx/cloud://xxx 后加载失败。
 * 因此凡是要在 <image> 里展示的云存储文件，都必须先换成 https 临时链接。
 */

const CACHE_TTL = 25 * 60 * 1000 // 临时链接通常有效 1 小时，这里 25 分钟提前失效
const urlCache = new Map()

/** 判断是否为云存储文件 ID */
function isCloudFileId(url) {
  return typeof url === 'string' && url.indexOf('cloud://') === 0
}

/**
 * 判断是否为微信默认头像（thirdwx.qlogo.cn 等）。
 * 这类默认头像依赖外部域名，小程序 downloadFile 白名单未配置时会被静默拦截成白图。
 * 直接视为「无自定义头像」，回退到本地占位图更稳，也避免依赖 qlogo.cn 白名单。
 */
function isDefaultWxAvatar(url) {
  return typeof url === 'string' && /qlogo\.cn/i.test(url)
}

/**
 * 把 cloud:// 文件 ID 转成可直接用于 <image src> 的 https 临时链接
 * - 非 cloud://（http/https/本地路径/空值）原样返回
 * - 换取失败返回 ''，调用方应回退到占位图
 * @param {string} url
 * @returns {Promise<string>}
 */
async function toDisplayUrl(url) {
  if (!isCloudFileId(url)) return url || ''

  const cached = urlCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const res = await wx.cloud.getTempFileURL({ fileList: [url] })
    const list = (res && res.fileList) || []
    const item = list.find((f) => f.fileID === url)
    const value = item && item.status === 0 && item.tempFileURL ? item.tempFileURL : ''
    if (value) urlCache.set(url, { value, expiresAt: Date.now() + CACHE_TTL })
    return value
  } catch (err) {
    console.error('cloudfile: getTempFileURL 失败', err)
    return ''
  }
}

/** 同步版本：用于首屏先显示占位图（cloud:// 或微信默认头像都视为需回退） */
function safePlaceholder(url, fallback) {
  if (!url) return fallback || ''
  if (isCloudFileId(url) || isDefaultWxAvatar(url)) return fallback || ''
  return url
}

module.exports = { isCloudFileId, isDefaultWxAvatar, toDisplayUrl, safePlaceholder }
