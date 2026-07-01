const assert = require('node:assert/strict')
const test = require('node:test')
const { insertCalendarRecommendation } = require('../calendar-insert')

test('successful insert is generated', async () => {
  const result = await insertCalendarRecommendation(async () => {})

  assert.equal(result, 'generated')
})

test('duplicate-key insert is skipped', async () => {
  const result = await insertCalendarRecommendation(async () => {
    throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
  })

  assert.equal(result, 'skipped')
})

test('unrelated insert error is rethrown', async () => {
  const error = new Error('database unavailable')

  await assert.rejects(
    insertCalendarRecommendation(async () => {
      throw error
    }),
    (caught) => caught === error
  )
})
