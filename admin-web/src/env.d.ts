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
