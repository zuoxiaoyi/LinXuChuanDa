# 灵序穿搭后台数据库字段确认稿

## 1. 设计原则

- 继续使用现有 CloudBase NoSQL，不引入第二套数据库。
- 穿搭和配饰是长期素材；每日建议是算法生成后的“发布快照”。
- 管理数据统一包含状态、版本、创建人与更新时间，删除采用软删除。
- 积分只能通过流水变更，不能在后台直接覆盖用户积分余额。
- 算法规则保存结构化参数，不允许管理员录入并执行任意脚本。

## 2. 公共字段

后台维护的内容集合统一包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| status | string | `draft/published/disabled` |
| version | number | 乐观锁版本，从1开始 |
| createdAt | date | 创建时间 |
| createdBy | string | 管理员UID |
| updatedAt | date | 更新时间 |
| updatedBy | string | 管理员UID |
| isDeleted | boolean | 软删除标记 |
| deletedAt | date/null | 软删除时间 |

## 3. 集合定义

### 3.1 `adminUsers`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| _id | string | 是 | CloudBase Auth UID |
| displayName | string | 是 | 管理员名称 |
| role | string | 是 | `super_admin/editor/operator/viewer` |
| status | string | 是 | `active/disabled` |
| permissions | string[] | 否 | 额外权限覆盖 |
| lastLoginAt | date | 否 | 最近登录 |
| createdAt | date | 是 | 创建时间 |

权限约定：

- `super_admin`：全部权限和管理员管理。
- `editor`：素材、每日建议、内容配置。
- `operator`：用户查询、积分补发、运营配置。
- `viewer`：只读。

### 3.2 `outfits`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 穿搭名称 |
| description | string | 是 | 搭配说明 |
| coverUrl | string | 是 | 封面云存储ID |
| images | string[] | 否 | 详情图 |
| items | object[] | 否 | 单品名称、品牌、图片 |
| sceneTags | string[] | 是 | 通勤、休闲、度假、约会等 |
| colorTags | string[] | 是 | 米白、浅蓝、黑色等 |
| elementTags | string[] | 是 | 金、木、水、火、土 |
| seasonTags | string[] | 是 | 春、夏、秋、冬 |
| weatherTags | string[] | 否 | 晴、雨、雪、降温、大风等 |
| styleTags | string[] | 否 | 简约、甜美、复古等 |
| temperatureMin | number | 否 | 最低适用温度 |
| temperatureMax | number | 否 | 最高适用温度 |
| gender | string | 是 | 当前版本默认 `female` |
| priority | number | 是 | 运营优先级，默认0 |
| inventoryStatus | string | 是 | `available/unavailable` |
| status/version/... | - | 是 | 公共字段 |

### 3.3 `accessories`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 配饰名称 |
| description | string | 是 | 展示短文案 |
| imageUrl | string | 是 | 云存储ID |
| colorTags | string[] | 否 | 色彩标签 |
| elementTags | string[] | 是 | 五行标签 |
| sceneTags | string[] | 否 | 场景标签 |
| priority | number | 是 | 推荐优先级 |
| status/version/... | - | 是 | 公共字段 |

### 3.4 `recommendationRules`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 规则名称 |
| ruleVersion | string | 是 | 业务版本，如 `2026.1` |
| effectiveFrom | string | 是 | 生效日期 `YYYY-MM-DD` |
| effectiveTo | string/null | 否 | 失效日期 |
| stemMappings | object | 是 | 天干到五行/颜色映射 |
| branchMappings | object | 是 | 地支到五行/颜色映射 |
| preferredColorMappings | object | 是 | 首选、次选、不建议颜色 |
| scoreWeights | object | 是 | 干支、颜色、季节、天气、场景、运营权重 |
| multiplierRules | object[] | 是 | 签到倍率及概率 |
| unlockCost | number | 是 | 当前5积分 |
| status/version/... | - | 是 | 公共字段 |

首版评分字段预留：

```text
stemElementWeight
branchElementWeight
preferredColorWeight
secondaryColorWeight
avoidColorPenalty
seasonWeight
weatherWeight
sceneWeight
operationPriorityWeight
```

### 3.5 `dailyRecommendations`

该集合是小程序读取的最终快照，同一天只能有一条正式发布记录。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| date | string | 是 | `YYYY-MM-DD`，唯一 |
| calendar | object | 是 | 公历、农历、天干、地支、五行 |
| colorAdvice | object | 是 | `primary/secondary/avoid` |
| weatherSnapshot | object/null | 否 | 城市、温度、天气、风力、湿度、UV |
| dressingAdvice | object | 是 | 文案和标签 |
| skincareAdvice | object | 是 | 护肤文案 |
| bestOutfits | object[] | 是 | `outfitId/scene/score/reasons` |
| secondaryOutfits | object[] | 是 | `outfitId/scene/score/reasons` |
| accessoryIds | string[] | 是 | 幸运配饰ID |
| ruleVersion | string | 是 | 生成时使用的规则版本 |
| generationMode | string | 是 | `algorithm/manual/mixed` |
| manualOverride | boolean | 是 | 是否人工调整 |
| publishAt | date/null | 否 | 发布时间 |
| status/version/... | - | 是 | 公共字段 |

### 3.6 `contentConfigs`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| key | string | 是 | 唯一，如 `about/user_agreement/privacy/share_copy` |
| title | string | 是 | 内容标题 |
| content | string | 是 | 纯文本或受限富文本 |
| locale | string | 是 | 默认 `zh-CN` |
| status/version/... | - | 是 | 公共字段 |

“灵序穿搭简介”使用 `key=about`，小程序保留本地默认文案作为接口失败兜底。

### 3.7 `appConfigs`

| key | value示例 | 说明 |
|---|---|---|
| `checkin` | `{basePoints:1,multipliers:[...]}` | 签到规则 |
| `unlock` | `{freeDays:3,adUnlockDays:4,costPoints:5}` | 解锁规则 |
| `ads` | `{enabled:false,...}` | 广告开关，不保存密钥 |
| `weather` | `{provider:"...",cacheMinutes:30}` | 天气策略，不保存服务端密钥 |

### 3.8 用户行为集合

- `users`：保留当前字段，增加 `status/lastActiveAt`。
- `collections`：用户与单套穿搭收藏关系。
- `checkins`：签到、倍率、广告奖励状态。
- `pointLedger`：每一笔积分收入和支出。
- `unlocks`：积分或广告解锁记录。
- `browseHistory`：浏览日期与穿搭记录。
- `adRewardEvents`：广告展示、完成、奖励幂等记录。
- `auditLogs`：后台操作前后摘要、管理员、时间、IP/请求ID。

## 4. 必要索引

| 集合 | 索引 |
|---|---|
| dailyRecommendations | `date` 唯一 |
| collections | `_openid + outfitId` 唯一 |
| checkins | `_openid + date` 唯一 |
| unlocks | `_openid + targetType + targetKey` 唯一 |
| pointLedger | `_openid + createdAt(desc)` |
| outfits | `status + sceneTags + priority(desc)` |
| accessories | `status + elementTags + priority(desc)` |
| auditLogs | `operatorUid + createdAt(desc)` |

## 5. 发布与并发约束

- 保存时携带 `version`，版本不一致返回 `VERSION_CONFLICT`。
- 发布每日建议前校验至少3套最佳、3套次佳和1个配饰。
- 被每日建议引用的素材不能硬删除，只能下架或软删除。
- 积分调整必须同时写入 `pointLedger`，使用事务保证一致。
- 所有后台写接口必须写入 `auditLogs`。
