# 灵序穿搭后台接口契约确认稿

## 1. 调用方式

管理端通过 `@cloudbase/js-sdk` 调用 `adminApi` 云函数：

```ts
app.callFunction({
  name: 'adminApi',
  data: {
    action: 'outfits.list',
    payload: { page: 1, pageSize: 20 }
  }
})
```

所有写操作由云函数完成。浏览器不直接写数据库，也不保存管理员API Key。

## 2. 统一响应

```ts
type ApiResponse<T> =
  | {
      success: true
      data: T
      requestId: string
    }
  | {
      success: false
      code: string
      message: string
      details?: unknown
      requestId: string
    }
```

主要错误码：

| code | 说明 |
|---|---|
| `UNAUTHENTICATED` | 未登录 |
| `FORBIDDEN` | 无管理权限 |
| `VALIDATION_ERROR` | 参数错误 |
| `NOT_FOUND` | 数据不存在 |
| `VERSION_CONFLICT` | 数据已被其他管理员修改 |
| `DUPLICATE` | 唯一数据重复 |
| `DEPENDENCY_EXISTS` | 数据已被引用，不能删除 |
| `INTERNAL_ERROR` | 服务端错误 |

## 3. 权限

| 权限 | 说明 |
|---|---|
| `dashboard.read` | 仪表盘 |
| `outfits.read/write/publish` | 穿搭 |
| `accessories.read/write/publish` | 配饰 |
| `recommendations.read/write/publish` | 每日建议 |
| `content.read/write/publish` | 内容配置 |
| `users.read` | 用户查询 |
| `points.adjust` | 积分补发/扣减 |
| `configs.read/write` | 运营配置 |
| `audit.read` | 审计日志 |

## 4. Action清单

### 4.1 身份

#### `auth.me`

返回当前管理员、角色和权限。前端路由守卫必须以该接口为最终授权依据。

### 4.2 仪表盘

#### `dashboard.summary`

请求：

```ts
{ startDate: string; endDate: string }
```

返回用户数、签到数、收藏数、广告完成数、积分收支及待发布内容。

### 4.3 穿搭

- `outfits.list`：分页、关键词、状态、场景筛选。
- `outfits.get`：查询详情。
- `outfits.save`：新增或按版本更新。
- `outfits.setStatus`：发布、下架。
- `outfits.remove`：软删除。

`outfits.save` 请求核心字段与 `ADMIN_DATA_MODEL.md` 的 `outfits` 一致。

### 4.4 配饰

- `accessories.list`
- `accessories.get`
- `accessories.save`
- `accessories.setStatus`
- `accessories.remove`

### 4.5 每日建议

- `recommendations.list`
- `recommendations.get`
- `recommendations.generate`
- `recommendations.save`
- `recommendations.publish`
- `recommendations.unpublish`

生成请求：

```ts
{
  startDate: string
  endDate: string
  ruleVersion: string
  overwriteDraft?: boolean
}
```

生成只写草稿，不自动发布。返回每天的匹配分数和原因，便于人工复核。

### 4.6 内容

- `content.list`
- `content.get`
- `content.save`
- `content.publish`

首版内容键：`about`、`user_agreement`、`privacy`、`share_copy`。

### 4.7 用户与积分

- `users.list`
- `users.get`
- `users.setStatus`
- `users.pointLedger`
- `points.adjust`

积分调整请求：

```ts
{
  userId: string
  amount: number
  reason: string
  idempotencyKey: string
}
```

禁止传入目标余额，只能传正负变化量。

### 4.8 配置与审计

- `configs.get`
- `configs.save`
- `audit.list`

## 5. 小程序读取接口

后台发布后，小程序使用稳定的只读接口：

- `getHomeData({date,cityCode})`
- `getDailyDetail({date,cityCode})`
- `getContent({key})`

用户行为接口：

- `toggleCollection`
- `checkIn`
- `claimAdBonus`
- `unlockDates`
- `getUserProfile`

## 6. 安全要求

- Web登录使用CloudBase Auth真实会话，不能以本地Storage值判断管理员身份。
- `adminApi` 每次调用都查询 `adminUsers` 并校验状态与权限。
- Publishable Key可以进入Web构建；管理员API Key、天气密钥、广告服务密钥只能放服务端环境变量。
- 分页上限100，文本字段限制长度，标签使用白名单。
- 日志不得记录密码、Token、完整手机号或敏感密钥。
