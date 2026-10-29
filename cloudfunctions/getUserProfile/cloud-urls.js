/**
 * cloud:// 文件 ID → https 临时链接（批量）
 *
 * 原因：本项目 app.json 为 renderer: "skyline"，Skyline 下 <image src="cloud://xxx">
 * 不会走云存储解析，而是被当成相对路径拼到 __pageframe__ 后面，导致图片加载失败。
 * 因此云函数返回给小程序前，必须把所有图片字段换成 https 临时链接。
 */

const cloud = require('wx-server-sdk')

const IMAGE_KEY_RE = /(coverUrl|imageUrl|image|icon|avatarUrl|cover|img|pic|photo)$/i

function isCloudId(value) {
  return typeof value === 'string' && value.indexOf('cloud://') === 0
}

function walk(node, hits) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, hits))
    return
  }
  Object.keys(node).forEach((key) => {
    const value = node[key]
    if (isCloudId(value) && IMAGE_KEY_RE.test(key)) {
      hits.push({ obj: node, key, id: value })
    } else if (value && typeof value === 'object') {
      walk(value, hits)
    }
  })
}

/**
 * 就地替换对象/数组里所有图片字段的 cloud:// 为 https 临时链接
 * 换取失败时保留原值，不影响主流程
 */
async function resolveImages(data) {
  if (!data) return data

  const hits = []
  walk(data, hits)
  if (!hits.length) return data

  const ids = Array.from(new Set(hits.map((hit) => hit.id)))
  const urlMap = new Map()

  for (let i = 0; i < ids.length; i += 50) {
    try {
      const res = await cloud.getTempFileURL({ fileList: ids.slice(i, i + 50) })
      ;(res.fileList || []).forEach((file) => {
        if (file && file.tempFileURL) urlMap.set(file.fileID, file.tempFileURL)
      })
    } catch (err) {
      console.error('resolveImages getTempFileURL failed:', err)
    }
  }

  hits.forEach((hit) => {
    const tempUrl = urlMap.get(hit.id)
    if (tempUrl) hit.obj[hit.key] = tempUrl
  })

  return data
}

module.exports = { resolveImages, isCloudId }
