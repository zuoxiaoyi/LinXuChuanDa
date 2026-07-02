const { createPrivateKey, sign } = require('node:crypto')
const { gunzipSync } = require('node:zlib')

function encode(value) {
  return Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value)
  ).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function decodeJsonBody(body, contentEncoding = '') {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const decoded = String(contentEncoding).toLowerCase().includes('gzip')
    ? gunzipSync(buffer)
    : buffer
  return JSON.parse(decoded.toString('utf8'))
}

function createJwt(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = encode({ alg: 'EdDSA', kid: config.credentialId })
  const iat = nowSeconds - 30
  const payload = encode({ sub: config.projectId, iat, exp: iat + 900 })
  const content = `${header}.${payload}`
  const key = createPrivateKey(
    String(config.privateKey).replace(/\\n/g, '\n').trim()
  )
  return `${content}.${sign(null, Buffer.from(content), key).toString('base64url')}`
}

function temperatureAdvice(min, max) {
  const average = (Number(min) + Number(max)) / 2
  if (average <= 5) return { text: '建议穿羽绒服或厚棉服，注意重点保暖。', tags: ['羽绒服', '保暖'] }
  if (average <= 12) return { text: '建议穿厚外套搭配针织内层。', tags: ['厚外套', '保暖'] }
  if (average <= 20) return { text: '建议穿夹克、针织衫或长袖上衣。', tags: ['外套', '长袖'] }
  if (average <= 27) return { text: '建议穿长袖衬衫或轻薄上衣。', tags: ['长袖', '轻薄'] }
  return { text: '建议穿透气短袖或轻薄裙装，及时补水。', tags: ['短袖', '透气'] }
}

function buildDailyAdvice(day, dressingIndex) {
  const fallback = temperatureAdvice(day.tempMin, day.tempMax)
  const tags = [...fallback.tags]
  let dressingAdvice = dressingIndex?.text || fallback.text
  const weatherText = `${day.textDay || ''}${day.textNight || ''}`
  const wind = Number.parseInt(day.windScaleDay, 10) || 0

  if (/[雨雪]/.test(weatherText)) {
    dressingAdvice += ' 外出请携带雨具并选择防滑鞋。'
    tags.push('雨具')
  }
  if (wind >= 4) {
    dressingAdvice += ' 风力较大，外层建议选择防风款。'
    tags.push('防风')
  }

  const care = []
  if (Number(day.uvIndex) >= 5) care.push('紫外线较强，注意防晒')
  if (/[雨雪]/.test(weatherText)) care.push('携带雨具并注意路面湿滑')
  if (wind >= 4) care.push('风力较大，注意防风和眼部防护')
  if (!care.length) care.push('按需补水，结合实际体感调整出行安排')

  return {
    dressingAdvice,
    dressingTags: [...new Set(tags)],
    careAdvice: `${care.join('；')}。`
  }
}

function normalizeWeather(location, current, forecast, indices) {
  const indexMap = new Map(
    (indices.daily || [])
      .filter(item => item.type === '3')
      .map(item => [item.date, item])
  )
  const days = (forecast.daily || []).slice(0, 7).map(day => ({
    date: day.fxDate,
    temperature: `${day.tempMin}°~${day.tempMax}°`,
    condition: day.textDay,
    wind: `${day.windDirDay || ''}${day.windScaleDay || '--'}级`,
    ultraviolet: day.uvIndex || '--',
    ...buildDailyAdvice(day, indexMap.get(day.fxDate))
  }))

  return {
    location: {
      id: location.id,
      name: location.name,
      adm1: location.adm1 || '',
      adm2: location.adm2 || ''
    },
    updatedAt: current.updateTime,
    now: {
      temperature: `${current.now.temp}°`,
      feelsLike: `${current.now.feelsLike}°`,
      condition: current.now.text,
      wind: `${current.now.windDir}${current.now.windScale}级`
    },
    days
  }
}

module.exports = {
  base64UrlDecode,
  buildDailyAdvice,
  createJwt,
  decodeJsonBody,
  normalizeWeather
}
