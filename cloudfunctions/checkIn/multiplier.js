const MULTIPLIER_RULES = [
  { multiplier: 2, weight: 50 },
  { multiplier: 3, weight: 30 },
  { multiplier: 4, weight: 15 },
  { multiplier: 5, weight: 5 }
]

function drawMultiplier(randomValue = Math.random()) {
  const totalWeight = MULTIPLIER_RULES.reduce((sum, item) => sum + item.weight, 0)
  let cursor = randomValue * totalWeight
  for (const rule of MULTIPLIER_RULES) {
    cursor -= rule.weight
    if (cursor < 0) return rule.multiplier
  }
  return MULTIPLIER_RULES[0].multiplier
}

module.exports = {
  MULTIPLIER_RULES,
  drawMultiplier
}
