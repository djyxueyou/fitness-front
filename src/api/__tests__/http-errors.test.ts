import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, hasApiErrorCode, request } from '@/api/http'

describe('API business errors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves membership error codes without clearing the login token', async () => {
    const removeStorageSync = vi.fn()
    const showToast = vi.fn()
    const requestMock = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        statusCode: 403,
        data: { code: 40311, message: '会员权益不足', data: null },
        header: {},
        cookies: [],
        errMsg: 'request:ok'
      })
    })
    Object.assign(globalThis, {
      uni: {
        getStorageSync: vi.fn(() => 'token'),
        removeStorageSync,
        showToast,
        request: requestMock
      }
    })

    const error = await request({ url: '/api/pro-only' }).catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 40311, statusCode: 403 })
    expect(removeStorageSync).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('recognizes business codes even when a mini-program runtime loses the Error prototype', () => {
    expect(hasApiErrorCode(new ApiError('需要确认', 40910, 409), 40910)).toBe(true)
    expect(hasApiErrorCode({ name: 'ApiError', code: 40910 }, 40910)).toBe(true)
    expect(hasApiErrorCode({ name: 'ApiError', code: '40910' }, 40910)).toBe(true)
    expect(hasApiErrorCode({ code: 40311 }, 40910)).toBe(false)
  })

  it('keeps a confirmation-required response on the business-error path without HTTP 409', async () => {
    const requestMock = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        statusCode: 200,
        data: { code: 40910, message: '启用新计划会停用当前计划，请确认后继续', data: null },
        header: {},
        cookies: [],
        errMsg: 'request:ok'
      })
    })
    Object.assign(globalThis, {
      uni: {
        getStorageSync: vi.fn(() => 'token'),
        removeStorageSync: vi.fn(),
        showToast: vi.fn(),
        request: requestMock
      }
    })

    const error = await request({ url: '/api/system-plans/1001/activate', method: 'POST' }).catch(
      (caught) => caught
    )

    expect(error).toMatchObject({ code: 40910, statusCode: 200 })
    expect(hasApiErrorCode(error, 40910)).toBe(true)
  })
})
