import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim() || ''
const region = import.meta.env.VITE_CLOUDBASE_REGION?.trim() || 'ap-shanghai'
const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY?.trim() || ''

export const demoMode = import.meta.env.VITE_ADMIN_DEMO_MODE === 'true'
export const cloudbaseMissingConfig = [
  !envId ? 'VITE_CLOUDBASE_ENV_ID' : '',
  !accessKey ? 'VITE_CLOUDBASE_ACCESS_KEY' : ''
].filter(Boolean)
export const cloudbaseConfigured = Boolean(envId && accessKey)

export const cloudApp: any = cloudbaseConfigured
  ? cloudbase.init({
      env: envId,
      region,
      accessKey,
      auth: { detectSessionInUrl: true }
    })
  : null

export const cloudAuth: any = cloudApp
  ? cloudApp.auth({ persistence: 'local' })
  : null

export const cloudbaseConfig = {
  envId,
  region,
  hasAccessKey: Boolean(accessKey)
}
