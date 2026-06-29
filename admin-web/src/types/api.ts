export type ApiSuccess<T> = {
  success: true
  data: T
  requestId: string
}

export type ApiFailure = {
  success: false
  code: string
  message: string
  details?: unknown
  requestId: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type PageResult<T> = {
  list: T[]
  page: number
  pageSize: number
  total: number
}

export class AdminApiError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    this.details = details
  }
}
