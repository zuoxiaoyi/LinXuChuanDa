/**
 * 穿搭素材批量上传的纯文本解析工具（不依赖 Vue / 运行时）。
 * - parseOutfitFilename：把 `名称｜场景｜主色｜季节｜天气` 形式的文件名拆成结构化字段。
 * - parseCsv：健壮的 CSV 解析（支持引号包裹、字段内逗号/换行、BOM、CRLF）。
 * 这些函数刻意保持「只产出文本」，中文标签 → 选项 code 的映射放在组件里用字典完成，
 * 以便复用页面已有的 options(type) 与校验逻辑。
 */

export interface ParsedFilename {
  title: string
  scene: string
  primaryColor: string
  season: string
  weather: string
  warnings: string[]
}

// 分隔符：优先全角「｜」，兼容半角「|」。中文穿搭命名基本不会用到这两个字符。
const FILENAME_SEP = /[｜|]/

function byteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length
  // 退化估算：中文按 3 字节
  return str.replace(/[^\x00-\xff]/g, 'xxx').length
}

function stripExt(name: string): string {
  return (name || '').replace(/\.[^.]+$/, '')
}

/**
 * 解析文件名。格式：穿搭名称｜场景标签｜主色｜季节标签｜天气标签
 * 说明：搭配说明不进文件名（自由长文本、易超 255 字节上限且难解析），批量时自动等于穿搭名称。
 * 缺失的尾部字段会给 warning，但允许留空由用户后续补齐。
 */
export function parseOutfitFilename(fileName: string): ParsedFilename {
  const base = stripExt(fileName)
  const warnings: string[] = []
  const parts = base.split(FILENAME_SEP).map(s => s.trim())

  const title = parts[0] || ''
  const scene = parts[1] || ''
  const primaryColor = parts[2] || ''
  const season = parts[3] || ''
  const weather = parts[4] || ''

  if (!title) warnings.push('缺少穿搭名称')
  if (!scene) warnings.push('缺少场景标签')
  if (!primaryColor) warnings.push('缺少主色')
  if (!season) warnings.push('缺少季节标签')
  if (!weather) warnings.push('缺少天气标签')

  // 单文件名约 255 字节上限（UTF-8 中文 3 字节/字，约 85 字）。逼近时提醒，避免被系统截断。
  if (byteLength(base) > 240) {
    warnings.push('文件名偏长，部分系统可能截断，建议精简')
  }

  return { title, scene, primaryColor, season, weather, warnings }
}

export interface CsvResult {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * 健壮 CSV 解析：状态机逐字符扫描，正确处理
 * - 双引号包裹的字段（含字段内逗号、换行）
 * - 连续两个双引号转义为单个引号
 * - 行首 BOM、\r\n / \n 换行
 */
export function parseCsv(text: string): CsvResult {
  const input = (text || '').replace(/^﻿/, '')
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let i = 0

  while (i < input.length) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      record.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      i += 1
      continue
    }
    if (ch === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  if (field !== '' || record.length) {
    record.push(field)
    records.push(record)
  }

  if (!records.length) return { headers: [], rows: [] }
  const headers = records[0].map(h => h.trim())
  const rows = records
    .slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => {
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => {
        row[h] = (r[idx] ?? '').trim()
      })
      return row
    })
  return { headers, rows }
}

// 把逗号/中文顿号分隔的标签文本拆成数组（用于文件名或 CSV 中的多值字段）
export function splitTags(text: string): string[] {
  return (text || '')
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean)
}
