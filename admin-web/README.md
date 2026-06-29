# 灵序穿搭运营后台

Vue 3 + Vite + TypeScript + Element Plus + CloudBase 的轻量运营后台。

## 已实现模块

- CloudBase Auth用户名密码登录与会话守卫
- 管理员角色校验
- 运营概览
- 穿搭素材管理及图片上传
- 幸运配饰管理
- 每日建议草稿生成与发布入口
- 简介、协议、隐私和分享文案配置
- 用户查询与审计式积分调整
- 签到、倍率和解锁运营配置
- 显式Demo模式

## 本地启动

```bash
npm install
copy .env.example .env.local
npm run dev
```

`.env.local`：

```dotenv
VITE_CLOUDBASE_ENV_ID=完整环境ID
VITE_CLOUDBASE_REGION=ap-shanghai
VITE_CLOUDBASE_ACCESS_KEY=Publishable Key
VITE_ADMIN_DEMO_MODE=false
```

Publishable Key可以进入Web前端构建；管理员API Key和天气服务密钥禁止写入该文件。

## Demo模式

只用于本地页面联调：

```dotenv
VITE_ADMIN_DEMO_MODE=true
```

Demo模式默认关闭，不连接线上数据库，也不能用于生产部署。

## 首次CloudBase配置

1. 在CloudBase登录授权中启用用户名密码登录。
2. 创建Publishable Key。
3. 注册第一个后台账号，取得该账号UID。
4. 在 `adminUsers` 集合创建文档，文档 `_id` 必须等于UID：

```json
{
  "_id": "CloudBase Auth UID",
  "displayName": "超级管理员",
  "role": "super_admin",
  "status": "active",
  "permissions": [],
  "createdAt": "服务端时间"
}
```

5. 创建 `docs/ADMIN_DATA_MODEL.md` 中列出的集合和索引。
6. 上传并部署 `cloudfunctions/adminApi`，选择云端安装依赖。
7. 将后台域名加入CloudBase安全来源域名。
8. 构建并部署 `admin-web/dist` 到CloudBase静态托管。

## 验证

```bash
npm run typecheck
npm run build
```

当前构建暂时关闭CSS压缩，用于规避本地网络中断造成的Lightning CSS可选二进制缺失。依赖完整安装后可以移除 `vite.config.ts` 中的 `cssMinify: false`。

## 重要边界

- 干支匹配公式尚未提供，因此批量生成只创建每日草稿外壳，不生成虚假的穿搭结果。
- 管理端所有写操作经过 `adminApi`，不能直接从浏览器写数据库。
- 第一个超级管理员必须通过CloudBase控制台人工初始化，避免公开的“自助成为管理员”入口。
