/**
 * 云函数 - getShareQrCode
 * 生成「今日穿搭日签」海报用的小程序码（wxacode.getUnlimited，scene 模式）。
 *
 * 设计要点：
 * - scene 走 `d=YYYYMMDD`（9 字符，远小于 32 字符上限），落地页 pages/detail/detail
 *   已在 onLoad 里解析 scene / date 深链，扫码直达当天穿搭。
 * - checkPath: false —— 页面未发布 / 审核中也能生成，避免发版前后码失效。
 *   注意：envVersion 默认 release，扫码真正可打开仍需小程序新版本上线后。
 * - 结果上传云存储固定路径 qrcodes/<scene>.png 并换取 https 临时链接，
 *   前端 Canvas drawImage 只接受 https，不接受 cloud://。
 * - 无登录态依赖：日签页可能由未登录好友从分享卡片打开，码必须随时可取。
 *
 * 已知限制（2026-11-12 实测）：本环境（腾讯云付费版）下，CLI invoke / 定时触发器 /
 * HTTP 触发三种服务端通道调用 cloud.openapi 均报 -501001 invalid wx access_token
 * （环境未持有微信 openapi 凭证）。小程序端 wx.cloud.callFunction 触发时上下文带
 * appid，预期可成功 —— 以真机/开发者工具实测为准；失败时前端已降级为无码海报。
 * 若小程序端也失败，需在腾讯云 CloudBase 控制台把环境与小程序 AppID 重新授权关联。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LANDING_PAGE = 'pages/detail/detail'
const QR_WIDTH = 280

/** 入参 date 只接受 YYYY-MM-DD；非法值回退到通用 scene，扫码后落地今天 */
function buildScene(event) {
  const date = String((event && event.date) || '')
  if (!DATE_RE.test(date)) return { scene: 'd=today', dateKey: '' }
  return { scene: `d=${date.replace(/-/g, '')}`, dateKey: date }
}

exports.main = async (event = {}) => {
  const { scene, dateKey } = buildScene(event)
  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: LANDING_PAGE,
      checkPath: false,
      width: QR_WIDTH
    })
    if (!res || !res.buffer) {
      throw new Error('wxacode.getUnlimited 未返回图片数据')
    }
    const upload = await cloud.uploadFile({
      cloudPath: `qrcodes/${scene}.png`,
      fileContent: res.buffer
    })
    const urlRes = await cloud.getTempFileURL({ fileList: [upload.fileID] })
    const qrUrl = (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || ''
    return { success: true, fileID: upload.fileID, qrUrl, scene, dateKey }
  } catch (err) {
    console.error('[getShareQrCode] 生成失败', err)
    return {
      success: false,
      scene,
      dateKey,
      errCode: err && err.errCode,
      errMsg: (err && err.errMsg) || String(err)
    }
  }
}
