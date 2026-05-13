export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000)
const TOKEN_KEY = 'LIFTLOG_TOKEN'
const USER_PROFILE_KEY = 'LIFTLOG_USER_PROFILE'
const API_DEBUG = String(import.meta.env.VITE_API_DEBUG || 'false').toLowerCase() === 'true'
const UNAUTHORIZED_CODE = 40100

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8080'

export class AuthExpiredError extends Error {
  constructor(message = '登录已失效，请重新登录') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

interface RequestOptions {
  url: string
  method?: RequestMethod
  data?: unknown
  withAuth?: boolean
  timeoutMs?: number
}

function stringifyPayload(payload: unknown, maxLength = 500) {
  try {
    const raw = JSON.stringify(payload)
    if (!raw) return ''
    if (raw.length <= maxLength) return raw
    return `${raw.slice(0, maxLength)}...`
  } catch {
    return '[unserializable]'
  }
}

function isUnauthorized(statusCode: number, body: ApiResponse<unknown> | null, rawText: string) {
  if (statusCode === 401 || statusCode === 403) return true
  if (body?.code === UNAUTHORIZED_CODE) return true
  const message = (body?.message || rawText || '').toLowerCase()
  return (
    message.includes('token') &&
    (message.includes('无效') || message.includes('失效') || message.includes('unauthorized'))
  )
}

function handleUnauthorized(message?: string): never {
  clearToken()
  uni.removeStorageSync(USER_PROFILE_KEY)
  const errorMessage = message || '登录已失效，请重新登录'
  uni.showToast({ title: errorMessage, icon: 'none' })
  throw new AuthExpiredError(errorMessage)
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, withAuth = true, timeoutMs } = options
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT
  const token = uni.getStorageSync(TOKEN_KEY) as string | undefined
  const requestKey = `${method} ${url}`
  const startAt = Date.now()

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  }
  if (withAuth && token) {
    headers.satoken = token
  }

  if (API_DEBUG) {
    console.log('[api][request]', requestKey, {
      baseUrl: API_BASE_URL,
      timeout,
      withAuth,
      data: stringifyPayload(data)
    })
  }

  let response: UniApp.RequestSuccessCallbackResult
  try {
    response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${API_BASE_URL}${url}`,
        method,
        data: data as UniApp.RequestOptions['data'],
        header: headers,
        timeout,
        success: resolve,
        fail: reject
      })
    })
  } catch (err) {
    if (API_DEBUG) {
      console.error('[api][network-error]', requestKey, {
        elapsedMs: Date.now() - startAt,
        error: stringifyPayload(err)
      })
    }
    throw err
  }

  let body: ApiResponse<T> | null = null
  let rawText = ''
  if (typeof response.data === 'string') {
    rawText = response.data
    try {
      body = JSON.parse(response.data) as ApiResponse<T>
    } catch {
      body = null
    }
  } else {
    body = response.data as ApiResponse<T>
  }

  if (response.statusCode >= 400) {
    const message =
      (body && typeof body.message === 'string' && body.message) ||
      (body && typeof (body as unknown as Record<string, unknown>).msg === 'string'
        ? String((body as unknown as Record<string, unknown>).msg)
        : '') ||
      (rawText ? rawText.slice(0, 120) : '') ||
      `HTTP ${response.statusCode}`

    if (isUnauthorized(response.statusCode, body as ApiResponse<unknown> | null, rawText)) {
      handleUnauthorized(message)
    }

    if (API_DEBUG) {
      console.error('[api][error]', requestKey, {
        elapsedMs: Date.now() - startAt,
        statusCode: response.statusCode,
        response: stringifyPayload(body || rawText)
      })
    }
    throw new Error(message)
  }

  if (!body || typeof body.code !== 'number') {
    const error = new Error(`Invalid response format, status=${response.statusCode}`)
    if (API_DEBUG) {
      console.error('[api][error]', requestKey, {
        elapsedMs: Date.now() - startAt,
        statusCode: response.statusCode,
        response: stringifyPayload(response.data)
      })
    }
    throw error
  }

  if (body.code !== 0) {
    if (body.code === UNAUTHORIZED_CODE) {
      handleUnauthorized(body.message)
    }

    if (API_DEBUG) {
      console.error('[api][error]', requestKey, {
        elapsedMs: Date.now() - startAt,
        statusCode: response.statusCode,
        code: body.code,
        message: body.message,
        response: stringifyPayload(body.data)
      })
    }
    throw new Error(body.message || `Request failed with code ${body.code}`)
  }

  if (API_DEBUG) {
    console.log('[api][response]', requestKey, {
      elapsedMs: Date.now() - startAt,
      statusCode: response.statusCode,
      code: body.code,
      message: body.message,
      data: stringifyPayload(body.data)
    })
  }
  return body.data
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) as string | undefined
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}
