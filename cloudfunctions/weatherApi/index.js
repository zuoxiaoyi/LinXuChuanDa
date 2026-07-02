const https = require('node:https')
const { createJwt, decodeJsonBody, normalizeWeather } = require('./weather-core')

const cache = new Map()
const CACHE_MS = 10 * 60 * 1000

function success(data) {
  return { success: true, data }
}

function failure(code, message) {
  return { success: false, code, message }
}

function config() {
  const value = {
    apiHost: process.env.QWEATHER_API_HOST,
    projectId: process.env.QWEATHER_PROJECT_ID,
    credentialId: process.env.QWEATHER_CREDENTIAL_ID,
    privateKey: process.env.QWEATHER_PRIVATE_KEY
  }
  if (!value.apiHost || !value.projectId || !value.credentialId || !value.privateKey) {
    throw new Error('CONFIG_MISSING')
  }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.qweatherapi\.com$/i.test(value.apiHost)) {
    throw new Error('CONFIG_INVALID')
  }
  return value
}

function requestJson(path, params, weatherConfig) {
  const url = new URL(`https://${weatherConfig.apiHost}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  })
  const token = createJwt({
    credentialId: weatherConfig.credentialId,
    projectId: weatherConfig.projectId,
    privateKey: weatherConfig.privateKey
  })

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip',
        'User-Agent': 'linxu-weather-api/1.0'
      },
      timeout: 8000
    }, response => {
      const chunks = []
      response.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      response.on('end', () => {
        try {
          const data = decodeJsonBody(
            Buffer.concat(chunks),
            response.headers['content-encoding']
          )
          if (data.code !== '200') throw new Error(`QWEATHER_${data.code || response.statusCode}`)
          resolve(data)
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('timeout', () => request.destroy(new Error('QWEATHER_TIMEOUT')))
    request.on('error', reject)
  })
}

async function searchCity(keyword, weatherConfig, number = 10) {
  const text = String(keyword || '').trim().slice(0, 40)
  if (!text) throw new Error('LOCATION_REQUIRED')
  const result = await requestJson('/geo/v2/city/lookup', {
    location: text,
    range: 'cn',
    number,
    lang: 'zh'
  }, weatherConfig)
  return (result.location || []).map(item => ({
    id: item.id,
    name: item.name,
    adm1: item.adm1 || '',
    adm2: item.adm2 || '',
    lat: item.lat,
    lon: item.lon
  }))
}

function coordinate(payload) {
  const longitude = Number(payload.longitude)
  const latitude = Number(payload.latitude)
  if (
    !Number.isFinite(longitude)
    || !Number.isFinite(latitude)
    || longitude < -180
    || longitude > 180
    || latitude < -90
    || latitude > 90
  ) {
    throw new Error('LOCATION_INVALID')
  }
  return `${longitude.toFixed(2)},${latitude.toFixed(2)}`
}

async function getWeather(payload, weatherConfig) {
  const lookup = payload.locationId
    ? String(payload.locationId).trim().slice(0, 30)
    : coordinate(payload)
  const cacheKey = `weather:${lookup}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const locations = await searchCity(lookup, weatherConfig, 1)
  if (!locations.length) throw new Error('LOCATION_NOT_FOUND')
  const location = locations[0]
  const params = { location: location.id, lang: 'zh', unit: 'm' }
  const [now, forecast, indices] = await Promise.all([
    requestJson('/v7/weather/now', params, weatherConfig),
    requestJson('/v7/weather/7d', params, weatherConfig),
    requestJson('/v7/indices/3d', { ...params, type: '3,5' }, weatherConfig)
  ])
  const data = normalizeWeather(location, now, forecast, indices)
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS })
  return data
}

exports.main = async (event = {}) => {
  try {
    const weatherConfig = config()
    const action = String(event.action || '')
    const payload = event.payload || {}

    if (action === 'searchCity') {
      return success({
        locations: await searchCity(payload.keyword, weatherConfig)
      })
    }
    if (action === 'getWeather') {
      return success(await getWeather(payload, weatherConfig))
    }
    return failure('ACTION_NOT_FOUND', '不支持的天气操作')
  } catch (error) {
    console.error('weatherApi:', error.message)
    if (error.message.startsWith('CONFIG_')) {
      return failure('CONFIG_ERROR', '天气服务尚未配置')
    }
    if (error.message.startsWith('LOCATION_')) {
      return failure(error.message, '未找到可用城市')
    }
    return failure('WEATHER_UNAVAILABLE', '天气服务暂时不可用')
  }
}
