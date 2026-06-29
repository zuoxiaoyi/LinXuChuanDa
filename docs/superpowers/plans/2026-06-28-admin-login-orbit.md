# 后台登录页五行轨道动画 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后台登录页增加五行差速环绕动画，并让 CloudBase 配置缺失原因直接显示在登录页。

**Architecture:** 动画完全封装在 `LoginPage.vue` 的模板和 scoped CSS 中，使用三层轨道容器与反向旋转节点保持文字正向。CloudBase 服务导出缺失配置项，登录页据此显示可操作的提示，认证流程保持不变。

**Tech Stack:** Vue 3、TypeScript、CSS animations、Node.js test runner、Vite

## Global Constraints

- 不引入动画依赖、Canvas 或图片资源。
- 不读取、修改或提交真实 Publishable Key。
- `prefers-reduced-motion: reduce` 时停止动画。
- Publishable Key 缺失时必须明确提示，登录按钮保持禁用。

---

### Task 1: 登录页轨道动画

**Files:**
- Modify: `admin-web/src/pages/LoginPage.vue`
- Create: `admin-web/tests/login-page.test.mjs`
- Modify: `admin-web/package.json`

**Interfaces:**
- Consumes: 登录页现有 `.story-orbit` 容器。
- Produces: `.orbit-track`、`.orbit-body` 和 `@keyframes orbit-spin` 样式约定。

- [x] **Step 1: 编写失败测试**

使用 Node.js test runner 读取 `LoginPage.vue`，断言存在三条轨道、五个节点、公转关键帧、反向旋转和减少动态效果规则。

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --test-name-pattern="五行轨道"`

Expected: FAIL，提示缺少 `.orbit-track`。

- [x] **Step 3: 实现轨道模板和 CSS**

将五行元素放入三条同心轨道，分别配置 18、25、32 秒周期，并通过节点内层反向旋转保证文字正向。

- [x] **Step 4: 运行测试确认通过**

Run: `npm test`

Expected: PASS。

### Task 2: CloudBase 配置缺失提示

**Files:**
- Modify: `admin-web/src/services/cloudbase.ts`
- Modify: `admin-web/src/pages/LoginPage.vue`
- Modify: `admin-web/tests/login-page.test.mjs`

**Interfaces:**
- Produces: `cloudbaseMissingConfig: string[]`。
- Consumes: `VITE_CLOUDBASE_ENV_ID` 与 `VITE_CLOUDBASE_ACCESS_KEY`。

- [x] **Step 1: 编写失败测试**

断言登录页消费 `cloudbaseMissingConfig`，并显示缺失 `.env` 配置项的中文提示。

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --test-name-pattern="配置提示"`

Expected: FAIL，提示未使用 `cloudbaseMissingConfig`。

- [x] **Step 3: 实现缺失配置导出与页面提示**

在 CloudBase 服务中计算缺失项，登录页显示“缺少配置：VITE_CLOUDBASE_ACCESS_KEY”等明确文案。

- [x] **Step 4: 完整验证**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Expected: 三条命令均退出码 0。
