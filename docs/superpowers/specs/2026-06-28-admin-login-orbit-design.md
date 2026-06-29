# 后台登录页五行轨道动画设计

## 目标

让登录页现有的圆环和“金、木、水、火、土”产生类似行星绕太阳公转的动态效果，同时保持登录表单可用、页面性能稳定，并明确 CloudBase 登录配置状态。

## 动画设计

- 沿用登录页现有三层同心圆，不引入图片、Canvas 或第三方动画库。
- 五行文字分布在三条轨道上，使用 CSS `transform: rotate() translateX()` 实现环绕运动。
- 每条轨道采用不同周期和方向，形成差速公转效果，周期控制在 18～32 秒。
- 轨道节点反向旋转，使“金、木、水、火、土”始终保持正向可读。
- 鼠标悬停动画区域时降低速度。
- 系统开启 `prefers-reduced-motion: reduce` 时禁用公转动画。

## CloudBase 配置与登录状态

- `VITE_CLOUDBASE_ENV_ID` 指向小程序使用的同一 CloudBase 环境。
- `VITE_CLOUDBASE_ACCESS_KEY` 填写该环境生成的客户端 Publishable Key。
- `VITE_ADMIN_DEMO_MODE=false` 后使用真实 CloudBase Auth 登录。
- Publishable Key 只负责让浏览器端 SDK 连接环境，不会自动创建管理员账号。
- 登录按钮仅在 Demo 模式开启，或环境 ID 与 Publishable Key 均已加载时可用。
- 配置缺失时登录页应明确列出缺失项，而不是只呈现无法解释的禁用按钮。

## 管理员账号

首个后台账号需要在 CloudBase 身份认证中创建用户名密码用户。该用户还必须在 `adminUsers` 集合中存在启用状态的管理员记录，记录的 `uid` 与身份认证用户 UID 一致；否则即使密码验证成功，`adminApi` 也会拒绝后台权限。

## 验证

- 运行管理后台 TypeScript 类型检查和生产构建。
- 在浏览器验证五行节点沿轨道运动、文字保持正向。
- 分别验证 Demo 模式、缺少 Publishable Key、真实 CloudBase 配置三种状态下的按钮及提示。
- 验证减少动态效果媒体查询能关闭动画。
