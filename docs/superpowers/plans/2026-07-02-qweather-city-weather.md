# 和风天气与城市定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 小程序首页通过独立 CloudBase 云函数安全读取和风天气，支持定位城市、手选城市、7 日天气、穿衣建议和出行护理提示。

**Architecture:** 新增 `weatherApi` Event 云函数。云函数用 Node.js 原生 `crypto` 生成 Ed25519 JWT，用原生 `https` 请求和风天气；私钥只从环境变量读取。小程序只传城市关键字、Location ID 或两位小数经纬度，成功结果保存在本地作为短期失败回退。

**Tech Stack:** 微信小程序、CloudBase Event 云函数、Node.js `crypto`/`https`、和风天气 GeoAPI v2 与 API v7。

## Global Constraints

- 不把和风天气私钥写入 Git、前端或构建产物。
- API Host 为 `na3yfr9xh2.re.qweatherapi.com`。
- Project ID 为 `4EKTACNYUX`，Credential ID 为 `KMB2MBR6YN`，均通过环境变量配置。
- JWT Header 仅包含 `alg=EdDSA`、`kid`；Payload 仅包含 `sub`、`iat`、`exp`。
- `iat=当前时间-30秒`，`exp=iat+900秒`。
- 本阶段不实现穿搭素材评分、广告解锁或后台天气管理。
- 云函数只修改本地代码，由用户在微信开发者工具手动上传。

---

### Task 1: 天气纯函数与接口契约

**Files:**
- Create: `cloudfunctions/weatherApi/weather-core.js`
- Create: `cloudfunctions/weatherApi/test/weather-core.test.js`
- Create: `cloudfunctions/weatherApi/package.json`

**Interfaces:**
- Produces: `createJwt(config, nowSeconds)`, `buildDailyAdvice(day, indexItem)`, `normalizeWeather(location, now, forecast, indices)`.

- [ ] 写 JWT、温度分档、降雨/大风/紫外线建议的失败测试。
- [ ] 运行 `node --test test`，确认因模块缺失失败。
- [ ] 用 Node.js 标准库实现最小纯函数。
- [ ] 再次运行测试，确认通过。

### Task 2: 独立 weatherApi 云函数

**Files:**
- Create: `cloudfunctions/weatherApi/index.js`
- Modify: `cloudfunctions/weatherApi/test/weather-core.test.js`

**Interfaces:**
- Consumes actions:
  - `searchCity`: `{ keyword }`
  - `getWeather`: `{ locationId?, longitude?, latitude? }`
- Produces:
  - `{ success:true, data:{ locations } }`
  - `{ success:true, data:{ location, now, days, updatedAt } }`

- [ ] 增加输入校验和环境变量校验测试。
- [ ] 用 `https` 请求 `/geo/v2/city/lookup`、`/v7/weather/now`、`/v7/weather/7d`、`/v7/indices/3d?type=3,5`。
- [ ] 经纬度统一裁剪为两位小数；城市搜索限制中国、最多 10 条。
- [ ] 天气接口失败时返回稳定错误契约，不返回密钥和上游响应头。
- [ ] 运行 `npm test`。

### Task 3: 首页定位、手选城市与天气卡

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`
- Create: `tests/miniprogram/weather-source.test.js`

**Interfaces:**
- Calls: `wx.cloud.callFunction({ name:'weatherApi', data:{ action, payload } })`.
- Stores: `selectedWeatherLocation`, `lastWeatherSnapshot`.

- [ ] 写源码契约测试：顶部不再显示城市/我的入口，城市 picker 位于天气卡片内，页面调用 `weatherApi`。
- [ ] 首次加载优先使用已选城市，否则请求 `wx.getLocation`。
- [ ] 定位成功后用经纬度搜索城市，再加载天气；拒绝或失败时使用武汉兜底并提示可手选。
- [ ] 手选地区后搜索城市并保存 Location ID。
- [ ] 日期切换同步显示对应 7 日预报、穿衣建议和“出行护理”。
- [ ] 天气失败时读取最后一次成功快照；没有快照则显示季节性兜底文案。
- [ ] 运行小程序测试。

### Task 4: 验证与人工部署交接

**Files:**
- Modify: `docs/DAILY_RECOMMENDATION_V1_TASK_CHECKLIST.md`

- [ ] 运行根目录、`weatherApi` 测试及 `git diff --check`。
- [ ] 确认 Git diff 不包含私钥。
- [ ] 告知用户在微信开发者工具上传 `cloudfunctions/weatherApi`，选择“云端安装依赖”。
- [ ] 告知用户配置四个 CloudBase 环境变量：`QWEATHER_API_HOST`、`QWEATHER_PROJECT_ID`、`QWEATHER_CREDENTIAL_ID`、`QWEATHER_PRIVATE_KEY`。
- [ ] 用户完成上传后再进行真机定位、城市切换和天气联调。
