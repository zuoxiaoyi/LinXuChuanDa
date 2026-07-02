const assert = require('node:assert/strict')
const { generateKeyPairSync, verify } = require('node:crypto')
const test = require('node:test')

const {
  base64UrlDecode,
  buildDailyAdvice,
  createJwt,
  normalizeWeather
} = require('../weather-core')

test('JWT 只包含和风天气要求的字段并可通过 Ed25519 验签', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const token = createJwt({
    credentialId: 'KID',
    projectId: 'PROJECT',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  }, 1000)
  const [headerPart, payloadPart, signaturePart] = token.split('.')

  assert.deepEqual(JSON.parse(base64UrlDecode(headerPart)), {
    alg: 'EdDSA',
    kid: 'KID'
  })
  assert.deepEqual(JSON.parse(base64UrlDecode(payloadPart)), {
    sub: 'PROJECT',
    iat: 970,
    exp: 1870
  })
  assert.equal(
    verify(
      null,
      Buffer.from(`${headerPart}.${payloadPart}`),
      publicKey,
      Buffer.from(signaturePart, 'base64url')
    ),
    true
  )
})

test('穿衣建议优先采用官方穿衣指数并补充天气提醒', () => {
  const result = buildDailyAdvice(
    {
      tempMin: '18',
      tempMax: '27',
      textDay: '中雨',
      windScaleDay: '4',
      uvIndex: '5'
    },
    { type: '3', category: '舒适', text: '建议穿长袖衬衫。' }
  )

  assert.match(result.dressingAdvice, /建议穿长袖衬衫/)
  assert.match(result.dressingAdvice, /雨具/)
  assert.match(result.careAdvice, /防晒/)
  assert.deepEqual(result.dressingTags, ['长袖', '轻薄', '雨具', '防风'])
})

test('7日天气没有官方指数时按温度生成稳定兜底建议', () => {
  const result = buildDailyAdvice({
    tempMin: '2',
    tempMax: '10',
    textDay: '晴',
    windScaleDay: '2',
    uvIndex: '2'
  })

  assert.match(result.dressingAdvice, /厚外套/)
  assert.deepEqual(result.dressingTags, ['厚外套', '保暖'])
})

test('天气响应统一成小程序可直接展示的7日结构', () => {
  const result = normalizeWeather(
    { id: '101200101', name: '武汉', adm1: '湖北省', adm2: '武汉市' },
    {
      updateTime: '2026-07-02T10:00+08:00',
      now: { temp: '30', feelsLike: '33', text: '多云', windDir: '南风', windScale: '2' }
    },
    {
      daily: [{
        fxDate: '2026-07-02',
        tempMin: '26',
        tempMax: '34',
        textDay: '多云',
        windScaleDay: '2',
        uvIndex: '6'
      }]
    },
    {
      daily: [{ date: '2026-07-02', type: '3', text: '炎热，建议穿轻薄衣物。' }]
    }
  )

  assert.equal(result.location.name, '武汉')
  assert.equal(result.now.temperature, '30°')
  assert.equal(result.days[0].date, '2026-07-02')
  assert.match(result.days[0].dressingAdvice, /轻薄衣物/)
})
