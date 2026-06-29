import { callDemoAction } from './demo-api'
import { cloudApp, cloudbaseConfigured, demoMode } from './cloudbase'
import { AdminApiError, type ApiResponse } from '@/types/api'

export async function callAdminApi<T>(
  action: string,
  payload: Record<string, any> = {}
): Promise<T> {
  if (demoMode) {
    return callDemoAction(action, payload) as Promise<T>
  }
  if (!cloudbaseConfigured || !cloudApp) {
    throw new AdminApiError(
      'CLOUDBASE_NOT_CONFIGURED',
      'CloudBase尚未配置，请根据.env.example填写环境ID和Publishable Key。'
    )
  }

  const response = await cloudApp.callFunction({
    name: 'adminApi',
    data: { action, payload }
  })
  const result = (response?.result || response) as ApiResponse<T>

  if (!result?.success) {
    throw new AdminApiError(
      result?.code || 'INTERNAL_ERROR',
      result?.message || '后台接口调用失败',
      result?.details
    )
  }
  return result.data
}
