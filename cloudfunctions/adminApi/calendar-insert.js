function isDuplicateKeyError(error) {
  return String(error?.code ?? error?.errCode) === '11000' ||
    /E11000 duplicate key/i.test(error?.message || '')
}

async function insertCalendarRecommendation(insert) {
  try {
    await insert()
    return 'generated'
  } catch (error) {
    if (isDuplicateKeyError(error)) return 'skipped'
    throw error
  }
}

module.exports = { insertCalendarRecommendation }
