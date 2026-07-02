function uniqueCodes(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))]
}

function dictionaryMap(dictionaries) {
  return new Map(
    dictionaries
      .filter(item => item.enabled !== false && !item.isDeleted)
      .map(item => [`${item.type}:${item.code}`, item])
  )
}

function validCodes(value, type, map, label, max = 30) {
  const codes = uniqueCodes(value).slice(0, max)
  for (const code of codes) {
    if (!map.has(`${type}:${code}`)) throw new Error(`${label}编码无效：${code}`)
  }
  return codes
}

function elementsForColors(codes, map) {
  return [...new Set(codes.map(code => map.get(`color:${code}`)?.elementCode).filter(Boolean))]
}

function normalizeOutfit(input = {}, dictionaries = []) {
  const map = dictionaryMap(dictionaries)
  const primaryColorCodes = validCodes(
    input.primaryColorCodes,
    'color',
    map,
    '颜色',
    3
  )
  const accentColorCodes = validCodes(input.accentColorCodes, 'color', map, '颜色')
  const sceneCodes = validCodes(input.sceneCodes, 'scene', map, '场景')
  const seasonCodes = validCodes(input.seasonCodes, 'season', map, '季节')
  const weatherCodes = validCodes(input.weatherCodes, 'weather', map, '天气')
  const temperatureMin = input.temperatureMin === undefined || input.temperatureMin === null
    ? undefined
    : Number(input.temperatureMin)
  const temperatureMax = input.temperatureMax === undefined || input.temperatureMax === null
    ? undefined
    : Number(input.temperatureMax)
  if (
    temperatureMin !== undefined
    && temperatureMax !== undefined
    && temperatureMin > temperatureMax
  ) {
    throw new Error('最低温度不能高于最高温度')
  }

  return {
    ...input,
    primaryColorCodes,
    accentColorCodes,
    elementCodes: elementsForColors([...primaryColorCodes, ...accentColorCodes], map),
    sceneCodes,
    seasonCodes,
    weatherCodes,
    temperatureMin,
    temperatureMax,
    waterproof: Boolean(input.waterproof),
    windproof: Boolean(input.windproof),
    breathable: Boolean(input.breathable),
    inventoryStatus: input.inventoryStatus === 'unavailable' ? 'unavailable' : 'available'
  }
}

function normalizeAccessory(input = {}, dictionaries = []) {
  const map = dictionaryMap(dictionaries)
  const primaryColorCodes = validCodes(input.primaryColorCodes, 'color', map, '颜色', 3)
  const sceneCodes = validCodes(input.sceneCodes, 'scene', map, '场景')
  const accessoryTypeCode = input.accessoryTypeCode
    ? validCodes([input.accessoryTypeCode], 'accessoryType', map, '配饰类型', 1)[0]
    : ''
  return {
    ...input,
    primaryColorCodes,
    elementCodes: elementsForColors(primaryColorCodes, map),
    sceneCodes,
    accessoryTypeCode
  }
}

function validatePublishMaterial(kind, material = {}) {
  const missing = []
  const need = (condition, label) => {
    if (!condition) missing.push(label)
  }

  if (kind === 'outfit') {
    need(material.coverUrl, '封面图')
    need(material.title, '穿搭名称')
    need(material.description, '搭配说明')
    need(material.primaryColorCodes?.length, '主色')
    need(material.sceneCodes?.length, '场景')
    need(Number.isFinite(material.temperatureMin), '最低温度')
    need(Number.isFinite(material.temperatureMax), '最高温度')
    need(material.inventoryStatus === 'available', '可用库存')
    if (missing.length) throw new Error(`发布穿搭还缺少：${missing.join('、')}`)
    return
  }

  need(material.imageUrl, '配饰图片')
  need(material.name, '名称')
  need(material.description, '说明')
  need(material.primaryColorCodes?.length, '主色')
  need(material.sceneCodes?.length, '场景')
  need(material.accessoryTypeCode, '配饰类型')
  if (missing.length) throw new Error(`发布配饰还缺少：${missing.join('、')}`)
}

module.exports = {
  normalizeAccessory,
  normalizeOutfit,
  validatePublishMaterial
}
