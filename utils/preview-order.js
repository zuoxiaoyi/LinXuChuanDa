/**
 * 六宫格「可见顺序」→ 全屏相册「编号顺序」的唯一映射。
 *
 * 背景：详情页并不按接口返回顺序摆放卡片，而是先按场景列（通勤/休闲/度假）
 * 用 toSceneColumns() 重排，再用 wx:for 渲染。原实现却直接拿 bestList/secondList
 * 的原始数组拼相册，导致「第一排左→右」与「相册 1/2/3」不是同一套：
 * 点第一张可能显示 3 / 6，点第三张显示 1 / 6。后台人工调整过顺序时尤其明显。
 *
 * 这里以「列」为唯一真源：先算第一排，再算第二排，编号严格按从左往右连续递增。
 * 同时把 albumIndex 写回列对象，点击时直接用下标定位，不再靠 _id 反查
 * （_id 可能缺失、重复，历史数据里同一套也可能出现在两个分组）。
 */

/**
 * @param {Array<{item?: object}>} bestColumns  第一排列（toSceneColumns 的产物）
 * @param {Array<{item?: object}>} secondColumns 第二排列
 * @returns {{
 *   bestColumns: Array<{item?: object, albumIndex: number}>,
 *   secondColumns: Array<{item?: object, albumIndex: number}>,
 *   ordered: Array<{outfit: object, rank: string, albumIndex: number}>
 * }}
 */
function orderPreviewColumns(bestColumns, secondColumns) {
  const ordered = []
  const decorate = (columns, rank) => (Array.isArray(columns) ? columns : []).map(column => {
    const outfit = column && column.item
    // 空列（「未创建」占位）与封面缺失的卡片不进相册，且不占用编号
    const usable = !!(outfit && outfit.coverUrl)
    const albumIndex = usable ? ordered.length : -1
    if (usable) ordered.push({ outfit, rank, albumIndex })
    return { ...column, albumIndex }
  })

  // 顺序不能换：先第一排再第二排，编号才是 1/2/3、4/5/6
  const decoratedBest = decorate(bestColumns, '最佳')
  const decoratedSecond = decorate(secondColumns, '次佳')
  return { bestColumns: decoratedBest, secondColumns: decoratedSecond, ordered }
}

module.exports = { orderPreviewColumns }
