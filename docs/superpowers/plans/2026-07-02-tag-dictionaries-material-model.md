# 标签字典与素材模型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可运营维护的标签字典，并让穿搭和配饰使用标准编码、自动推导五行及服务端发布校验。

**Architecture:** `adminApi` 使用纯规则模块保存默认字典、解析颜色与校验素材，数据库层负责鉴权、审计和唯一约束。`admin-web` 增加字典页，并让两个素材表单从接口读取字典，移除自由输入标签。

**Tech Stack:** CloudBase NoSQL、Node.js CommonJS、`node:test`、Vue 3、TypeScript、Element Plus

## Global Constraints

- `tagDictionaries` 使用 `type + code` 复合唯一索引。
- 五行编码固定为 `metal/wood/water/fire/earth`。
- 颜色由设计稿中的19个标准名称组成，并且每个颜色只绑定一个五行。
- 场景初始值为通勤、休闲、度假，但允许后台新增。
- 季节只参与筛选和后续加分，温度范围是后续算法硬条件。
- 客户端不能决定推导后的五行。
- 草稿允许不完整；发布必须执行完整校验。
- 不实现推荐算法、不修改小程序、不处理 `小程序流程.pptx` 删除记录。

---

## File Map

- Create: `cloudfunctions/adminApi/tag-defaults.js` — 默认字典和幂等键。
- Create: `cloudfunctions/adminApi/material-rules.js` — 编码校验、五行推导和发布校验。
- Create: `cloudfunctions/adminApi/test/tag-defaults.test.js`
- Create: `cloudfunctions/adminApi/test/material-rules.test.js`
- Modify: `cloudfunctions/adminApi/index.js` — 字典动作与素材保存/发布集成。
- Modify: `cloudfunctions/adminApi/test/admin-api-source.test.js` 或新建 `test/dictionaries-api-source.test.js` — API契约。
- Modify: `admin-web/src/types/domain.ts` — 字典和规范素材字段。
- Create: `admin-web/src/pages/DictionariesPage.vue` — 字典管理。
- Create: `admin-web/src/composables/useDictionaries.ts` — 两个素材表单共享的字典加载和分组。
- Modify: `admin-web/src/pages/OutfitsPage.vue`
- Modify: `admin-web/src/pages/AccessoriesPage.vue`
- Modify: `admin-web/src/router/index.ts`
- Modify: `admin-web/src/layout/AdminLayout.vue`
- Create: `admin-web/tests/dictionaries-materials.test.mjs`
- Modify: `admin-web/package.json`
- Modify: `docs/ADMIN_IMPLEMENTATION_CHECKLIST.md`

---

### Task 1: 默认字典与纯素材规则

**Files:**

- Create: `cloudfunctions/adminApi/tag-defaults.js`
- Create: `cloudfunctions/adminApi/material-rules.js`
- Create: `cloudfunctions/adminApi/test/tag-defaults.test.js`
- Create: `cloudfunctions/adminApi/test/material-rules.test.js`

**Interfaces:**

- Produces: `DEFAULT_DICTIONARIES: DictionarySeed[]`
- Produces: `normalizeOutfit(input, dictionaries): OutfitData`
- Produces: `normalizeAccessory(input, dictionaries): AccessoryData`
- Produces: `validatePublishMaterial(kind, material, dictionaries): void`

- [ ] **Step 1: 写默认字典失败测试**

`tag-defaults.test.js`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_DICTIONARIES } = require('../tag-defaults')

test('默认字典包含固定五行、19种颜色和V1运营标签', () => {
  const byType = type => DEFAULT_DICTIONARIES.filter(item => item.type === type)
  assert.deepEqual(byType('element').map(item => item.code), [
    'metal', 'wood', 'water', 'fire', 'earth'
  ])
  assert.equal(byType('color').length, 19)
  assert.deepEqual(byType('scene').map(item => item.name), ['通勤', '休闲', '度假'])
  assert.deepEqual(byType('weather').map(item => item.name), [
    '常规', '炎热', '降雨', '大风', '降雪'
  ])
})

test('每种颜色只绑定一个有效五行', () => {
  const elements = new Set(
    DEFAULT_DICTIONARIES.filter(item => item.type === 'element').map(item => item.code)
  )
  for (const color of DEFAULT_DICTIONARIES.filter(item => item.type === 'color')) {
    assert.ok(elements.has(color.elementCode))
    assert.match(color.colorHex, /^#[0-9a-f]{6}$/i)
  }
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test --prefix cloudfunctions/adminApi`

Expected: FAIL，缺少 `tag-defaults.js`。

- [ ] **Step 3: 实现默认字典**

`tag-defaults.js` 使用一个扁平数组，字段固定为：

```js
{
  type: 'color',
  code: 'white',
  name: '白',
  elementCode: 'metal',
  colorHex: '#f7f4ed',
  order: 1,
  enabled: true,
  systemLocked: true
}
```

五行和颜色 `systemLocked: true`；场景、季节、天气和配饰类型为 `false`。导出：

```js
module.exports = { DEFAULT_DICTIONARIES }
```

- [ ] **Step 4: 写素材规则失败测试**

`material-rules.test.js`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_DICTIONARIES } = require('../tag-defaults')
const {
  normalizeAccessory,
  normalizeOutfit,
  validatePublishMaterial
} = require('../material-rules')

test('穿搭根据颜色推导五行且忽略客户端五行', () => {
  const result = normalizeOutfit({
    primaryColorCodes: ['white', 'blue'],
    accentColorCodes: [],
    elementCodes: ['fire'],
    sceneCodes: ['commute'],
    seasonCodes: [],
    weatherCodes: [],
    temperatureMin: 10,
    temperatureMax: 20
  }, DEFAULT_DICTIONARIES)
  assert.deepEqual(result.elementCodes, ['metal', 'water'])
})

test('拒绝停用、未知编码和错误温度范围', () => {
  assert.throws(
    () => normalizeOutfit({
      primaryColorCodes: ['missing'],
      sceneCodes: ['commute'],
      temperatureMin: 20,
      temperatureMax: 10
    }, DEFAULT_DICTIONARIES),
    /颜色编码无效|最低温度不能高于最高温度/
  )
})

test('草稿可不完整但发布穿搭和配饰必须完整', () => {
  assert.doesNotThrow(() => normalizeOutfit({}, DEFAULT_DICTIONARIES))
  assert.throws(
    () => validatePublishMaterial('outfit', {
      title: '测试', primaryColorCodes: [], sceneCodes: []
    }, DEFAULT_DICTIONARIES),
    /发布穿搭还缺少/
  )
  assert.throws(
    () => validatePublishMaterial('accessory', {
      name: '测试', primaryColorCodes: [], sceneCodes: []
    }, DEFAULT_DICTIONARIES),
    /发布配饰还缺少/
  )
})
```

- [ ] **Step 5: 运行并确认失败**

Run: `npm test --prefix cloudfunctions/adminApi`

Expected: FAIL，缺少 `material-rules.js`。

- [ ] **Step 6: 实现纯规则**

`material-rules.js`：

- 通过 `type + code` Map 校验启用项；
- `primaryColorCodes` 限制1至3个，草稿允许0个；
- `elementCodes` 由主色和辅助色字典的 `elementCode` 去重生成；
- `temperatureMin/temperatureMax` 同时存在时校验范围；
- `validatePublishMaterial()` 汇总缺失字段并抛出一条明确错误；
- 穿搭发布要求 `coverUrl/title/description/primaryColorCodes/sceneCodes/temperatureMin/temperatureMax/inventoryStatus=available`；
- 配饰发布要求 `imageUrl/name/description/primaryColorCodes/sceneCodes/accessoryTypeCode`。

只使用标准库，不增加依赖。

- [ ] **Step 7: 运行测试并提交**

```powershell
npm test --prefix cloudfunctions/adminApi
node --check cloudfunctions/adminApi/tag-defaults.js
node --check cloudfunctions/adminApi/material-rules.js
git add cloudfunctions/adminApi/tag-defaults.js cloudfunctions/adminApi/material-rules.js cloudfunctions/adminApi/test/tag-defaults.test.js cloudfunctions/adminApi/test/material-rules.test.js
git commit -m "feat: add material tag rules"
```

Expected: 全部通过。

---

### Task 2: 字典管理 API

**Files:**

- Create: `cloudfunctions/adminApi/test/dictionaries-api-source.test.js`
- Modify: `cloudfunctions/adminApi/index.js`

**Interfaces:**

- `dictionaries.list`
- `dictionaries.save`
- `dictionaries.setStatus`
- `dictionaries.seedDefaults`

- [ ] **Step 1: 写失败的API契约测试**

```js
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')

test('adminApi 注册字典读写和初始化动作', () => {
  for (const action of [
    'dictionaries.list',
    'dictionaries.save',
    'dictionaries.setStatus',
    'dictionaries.seedDefaults'
  ]) assert.match(source, new RegExp(action.replace('.', '\\.')))
  assert.match(source, /tagDictionaries/)
  assert.match(source, /DEFAULT_DICTIONARIES/)
})

test('素材保存通过服务端规则推导五行', () => {
  assert.match(source, /normalizeOutfit/)
  assert.match(source, /normalizeAccessory/)
  assert.match(source, /validatePublishMaterial/)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test --prefix cloudfunctions/adminApi`

Expected: 新测试失败。

- [ ] **Step 3: 注册权限和集合**

增加权限：

```js
'dictionaries.list': 'configs.read',
'dictionaries.save': 'configs.write',
'dictionaries.setStatus': 'configs.write',
'dictionaries.seedDefaults': 'configs.write',
```

增加映射：

```js
dictionaries: 'tagDictionaries',
```

- [ ] **Step 4: 实现字典动作**

- `seedDefaults`：逐项按 `type + code` 查询，仅新增缺失项，返回 `{ created, skipped }`。
- `save`：校验 `type/code/name/order/enabled`；新增后不允许修改 `type/code`；系统锁定项不允许删除。
- `setStatus`：仅更新 `enabled` 和版本；五行不可停用；颜色和其他字典可停用。
- 所有写动作调用现有 `writeAudit()`。

- [ ] **Step 5: 集成素材规则**

增加：

```js
async function enabledDictionaries() {
  const result = await db.collection('tagDictionaries')
    .where({ enabled: true, isDeleted: command.neq(true) })
    .limit(1000)
    .get()
  return result.data
}
```

`outfits.save` 和 `accessories.save` 在调用 `saveDocument()` 前加载字典并使用 `normalizeOutfit()` / `normalizeAccessory()`。发布状态变更前，加载当前文档和字典，调用 `validatePublishMaterial()`；下架不校验。

- [ ] **Step 6: 运行并提交**

```powershell
npm test --prefix cloudfunctions/adminApi
node --check cloudfunctions/adminApi/index.js
git add cloudfunctions/adminApi/index.js cloudfunctions/adminApi/test/dictionaries-api-source.test.js
git commit -m "feat: add tag dictionary admin api"
```

Expected: 全部通过。

---

### Task 3: 字典后台页面

**Files:**

- Modify: `admin-web/src/types/domain.ts`
- Create: `admin-web/src/pages/DictionariesPage.vue`
- Modify: `admin-web/src/router/index.ts`
- Modify: `admin-web/src/layout/AdminLayout.vue`
- Create: `admin-web/tests/dictionaries-materials.test.mjs`
- Modify: `admin-web/package.json`

**Interfaces:**

- Produces TypeScript `TagDictionary`
- Consumes `dictionaries.list/save/setStatus/seedDefaults`

- [ ] **Step 1: 写失败的后台页面测试**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/DictionariesPage.vue')
const router = read('../src/router/index.ts')
const layout = read('../src/layout/AdminLayout.vue')
const types = read('../src/types/domain.ts')

test('后台提供标签字典页面和类型', () => {
  assert.match(types, /interface TagDictionary/)
  assert.match(page, /dictionaries\.list/)
  assert.match(page, /dictionaries\.seedDefaults/)
  assert.match(page, /五行|颜色|场景|季节|天气|配饰类型/)
  assert.match(router, /dictionaries/)
  assert.match(layout, /标签字典/)
})
```

将该测试加入 `admin-web/package.json` 的 `test` 命令。

- [ ] **Step 2: 运行并确认失败**

Run: `npm test --prefix admin-web`

Expected: FAIL，页面和类型不存在。

- [ ] **Step 3: 增加类型**

```ts
export type DictionaryType =
  | 'element'
  | 'color'
  | 'scene'
  | 'season'
  | 'weather'
  | 'accessoryType'

export interface TagDictionary {
  _id?: string
  type: DictionaryType
  code: string
  name: string
  colorHex?: string
  elementCode?: string
  order: number
  enabled: boolean
  systemLocked: boolean
  version?: number
}
```

- [ ] **Step 4: 创建字典页面**

页面实现：

- 顶部类型筛选；
- 表格展示名称、编码、五行归属、色块、排序、启停；
- “初始化默认字典”按钮调用 `dictionaries.seedDefaults`；
- 抽屉编辑名称、色值、五行、排序；
- `systemLocked` 时禁用类型和编码；
- 五行项隐藏停用按钮。

- [ ] **Step 5: 注册路由和菜单**

路由：`/dictionaries`，菜单名称“标签字典”，放在穿搭素材之前。

- [ ] **Step 6: 验证并提交**

```powershell
npm test --prefix admin-web
npm run typecheck --prefix admin-web
npm run build --prefix admin-web
git add admin-web/package.json admin-web/src/types/domain.ts admin-web/src/pages/DictionariesPage.vue admin-web/src/router/index.ts admin-web/src/layout/AdminLayout.vue admin-web/tests/dictionaries-materials.test.mjs
git commit -m "feat: add tag dictionary admin page"
```

Expected: 测试、类型检查和构建全部通过。

---

### Task 4: 素材表单改造

**Files:**

- Create: `admin-web/src/composables/useDictionaries.ts`
- Modify: `admin-web/src/types/domain.ts`
- Modify: `admin-web/src/pages/OutfitsPage.vue`
- Modify: `admin-web/src/pages/AccessoriesPage.vue`
- Modify: `admin-web/tests/dictionaries-materials.test.mjs`

**Interfaces:**

- `useDictionaries()` returns `loading`, `load`, `options(type)`, `elementsForColors(codes)`
- `Outfit` uses standard code arrays and capability booleans.
- `Accessory` uses standard code arrays and `accessoryTypeCode`.

- [ ] **Step 1: 扩充失败测试**

```js
const outfits = read('../src/pages/OutfitsPage.vue')
const accessories = read('../src/pages/AccessoriesPage.vue')
const dictionaryHook = read('../src/composables/useDictionaries.ts')

test('素材表单只使用字典选项并自动展示五行', () => {
  assert.match(dictionaryHook, /dictionaries\.list/)
  assert.match(outfits, /primaryColorCodes/)
  assert.match(outfits, /elementsForColors/)
  assert.match(outfits, /waterproof/)
  assert.match(outfits, /windproof/)
  assert.match(outfits, /breathable/)
  assert.match(accessories, /accessoryTypeCode/)
  assert.doesNotMatch(outfits, /allow-create/)
  assert.doesNotMatch(accessories, /allow-create/)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test --prefix admin-web`

Expected: 新测试失败。

- [ ] **Step 3: 实现共享字典加载**

`useDictionaries.ts`：

- 首次 `load()` 调用 `dictionaries.list`，`pageSize: 1000`；
- 仅将 `enabled` 项作为新选择；
- `options(type)` 按 `order` 返回；
- `elementsForColors(codes)` 根据颜色项的 `elementCode` 去重返回名称。

- [ ] **Step 4: 更新类型**

`Outfit` 增加：

```ts
primaryColorCodes: string[]
accentColorCodes: string[]
elementCodes: string[]
sceneCodes: string[]
seasonCodes: string[]
weatherCodes: string[]
waterproof: boolean
windproof: boolean
breathable: boolean
inventoryStatus: 'available' | 'unavailable'
```

`Accessory` 增加：

```ts
primaryColorCodes: string[]
elementCodes: string[]
sceneCodes: string[]
accessoryTypeCode: string
```

保留旧标签字段为可选字段，仅用于旧数据显示。

- [ ] **Step 5: 改造两个表单**

- 下拉选项全部使用 `options(type)`；
- 删除 `allow-create`；
- 五行改为只读标签，通过 `elementsForColors()` 展示；
- 穿搭增加主色、辅助色、库存、防水、防风、透气；
- 配饰增加主色和配饰类型；
- 旧记录没有规范字段时显示“待补标签”，不自动猜测。

- [ ] **Step 6: 验证并提交**

```powershell
npm test --prefix admin-web
npm run typecheck --prefix admin-web
npm run build --prefix admin-web
git add admin-web/src/composables/useDictionaries.ts admin-web/src/types/domain.ts admin-web/src/pages/OutfitsPage.vue admin-web/src/pages/AccessoriesPage.vue admin-web/tests/dictionaries-materials.test.mjs
git commit -m "feat: standardize material tag forms"
```

Expected: 全部通过。

---

### Task 5: 全量验证与部署交接

**Files:**

- Modify: `docs/ADMIN_IMPLEMENTATION_CHECKLIST.md`

- [ ] **Step 1: 更新检查清单**

记录：

- 标签字典代码和页面已完成；
- 默认字典待生产初始化；
- `tagDictionaries` 复合唯一索引待创建；
- 旧草稿待补标准标签；
- 推荐算法仍未开始。

- [ ] **Step 2: 全量验证**

```powershell
npm test
npm test --prefix cloudfunctions/adminApi
npm test --prefix admin-web
npm run typecheck --prefix admin-web
npm run build --prefix admin-web
node --check cloudfunctions/adminApi/index.js
git diff --check
```

Expected: 全部退出码为0。

- [ ] **Step 3: 提交文档**

```powershell
git add docs/ADMIN_IMPLEMENTATION_CHECKLIST.md
git commit -m "docs: track material dictionary rollout"
```

- [ ] **Step 4: 用户手动部署**

1. CloudBase 创建 `tagDictionaries` 集合。
2. 创建 `type + code` 复合唯一索引。
3. 微信开发者工具重新上传 `cloudfunctions/adminApi`，选择云端安装依赖。
4. 重新构建并发布 `admin-web`。
5. 进入“标签字典”，点击“初始化默认字典”。
6. 逐条编辑现有草稿并补齐规范字段，确认发布校验生效。
