/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV_ID?: string
  readonly VITE_CLOUDBASE_REGION?: string
  readonly VITE_CLOUDBASE_ACCESS_KEY?: string
  readonly VITE_ADMIN_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Element Plus 中文语言包（zh-cn.mjs）未携带类型声明，显式声明为模块以消除 TS7016。
declare module 'element-plus/dist/locale/zh-cn.mjs'
