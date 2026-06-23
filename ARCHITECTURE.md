# 灵序穿搭 - 微信小程序开发架构

## 一、项目概述
穿搭推荐类微信小程序，基于微信云开发（云函数 + 云数据库 + 云存储），为用户提供每日穿搭推荐、收藏、积分解锁等功能。

---

## 二、技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | 微信小程序原生 + Glass-Easel 组件框架 |
| 渲染引擎 | Skyline |
| 后端服务 | 微信云函数（Node.js） |
| 数据库 | 微信云数据库（NoSQL） |
| 存储 | 微信云存储（图片/资源） |
| 广告变现 | 微信激励视频广告 |

---

## 三、页面路由结构

```
pages/
├── splash/          # 开屏广告页（5s自动跳过）
├── index/           # 首页 - 穿搭瀑布流展示
├── login/           # 登录页 - 一键微信授权登录
├── detail/          # 详情页 - 穿搭详情/解锁/收藏
└── mine/            # 个人中心 - 签到/积分/收藏列表
```

---

## 四、云函数目录

```
cloudfunctions/
├── login/               # 用户登录与注册
├── getOutfits/          # 获取穿搭列表（分页）
├── getOutfitDetail/     # 获取穿搭详情
├── checkIn/             # 每日签到
├── collectOutfit/       # 收藏/取消收藏穿搭
├── unlockOutfit/        # 积分解锁穿搭日期
└── getUserProfile/      # 获取用户资料与积分
```

---

## 五、云数据库集合设计

### 1. `outfits` - 穿搭数据
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动ID |
| title | string | 穿搭标题 |
| coverUrl | string | 封面图云存储ID |
| images | array | 详情图片列表 |
| tags | array | 标签（风格/季节/场合） |
| description | string | 穿搭描述 |
| items | array | 单品信息列表 |
| season | string | 适用季节 |
| gender | string | 适用性别 |
| createTime | date | 创建时间 |
| isLocked | boolean | 是否需解锁查看 |

### 2. `users` - 用户数据
| 字段 | 类型 | 说明 |
|------|------|------|
| _openid | string | 微信openid（自动） |
| nickName | string | 昵称 |
| avatarUrl | string | 头像URL |
| points | number | 积分余额 |
| totalPoints | number | 累计积分 |
| createTime | date | 注册时间 |

### 3. `collections` - 收藏记录
| 字段 | 类型 | 说明 |
|------|------|------|
| _openid | string | 用户openid |
| outfitId | string | 穿搭ID |
| createTime | date | 收藏时间 |

### 4. `checkins` - 签到记录
| 字段 | 类型 | 说明 |
|------|------|------|
| _openid | string | 用户openid |
| date | string | 签到日期（YYYY-MM-DD） |
| points | number | 获得积分 |
| createTime | date | 签到时间 |

### 5. `adConfig` - 广告配置
| 字段 | 类型 | 说明 |
|------|------|------|
| adUnitId | string | 广告单元ID |
| type | string | banner/video/interstitial |
| scene | string | 使用场景 |
| isActive | boolean | 是否启用 |

---

## 六、核心业务流程

```
[开屏页] --5s/点击跳过--> [首页]
                              |
                     ┌───────┼───────┐
                     v       v       v
                 [登录页] [详情页] [个人中心]
                     |       |       |
                     v       v       v
                  授权登录  查看详情   签到积分
                  注册用户  广告解锁   收藏列表
                           积分兑换
                           收藏穿搭
```

---

## 七、数据流设计

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  小程序端   │ ── │  云函数层    │ ── │  云数据库   │
│  (WXML+JS)  │    │  (Node.js)   │    │  (NoSQL)    │
└─────────────┘    └──────────────┘    └─────────────┘
       │                   │                   │
       │  wx.cloud         │  db.collection    │
       │  .callFunction()  │  .where().get()   │
       │                   │  .add()/.update() │
       v                   v                   v
   展示数据            业务逻辑校验         数据持久化
```

---

## 八、开发阶段规划

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | 项目骨架搭建 | 页面目录、云函数目录、基础配置 |
| Phase 2 | 云数据库设计 | 集合创建、权限配置、索引优化 |
| Phase 3 | 云函数开发 | login/getOutfits/checkIn 等 |
| Phase 4 | 页面开发 | 各页面 WXML/JS/WXSS |
| Phase 5 | 广告接入 | 激励视频广告、开屏广告 |
| Phase 6 | 联调测试 | 全流程测试、性能优化 |

---

## 九、注意事项
- 云函数环境：Node.js 16+
- 云数据库权限：读权限放开、写权限仅创建者
- 激励视频广告需在微信公众平台提前申请广告位
- UI资源由后续统一提供，当前架构先搭建功能骨架
