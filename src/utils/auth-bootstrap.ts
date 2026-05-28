import { clearToken, getToken, setToken } from '@/api/http'
import { wechatLogin } from '@/api/auth'
import { clearCachedUserProfile, fetchUserProfile, setCachedUserProfile } from '@/api/user'

const LOGIN_TIMEOUT_MS = 2500
let loginInFlight: Promise<void> | null = null
let authRunSeq = 0

const PERSISTENT_MOCK_KEY = 'LIFTLOG_MOCK_OPENID'

function getPersistentMockCode() {
  const stored = uni.getStorageSync(PERSISTENT_MOCK_KEY)
  if (stored) return String(stored)
  const code = `mock-${Date.now()}`
  uni.setStorageSync(PERSISTENT_MOCK_KEY, code)
  return code
}

function mockCode() {
  return getPersistentMockCode()
}

function isMockWechatCode(code: string) {
  const normalized = String(code || '')
    .trim()
    .toLowerCase()
  return !normalized || normalized.includes('mock') || normalized.includes('the code is a mock one')
}

async function tryGetWechatCodeWithTimeout(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('uni.login timeout'))
    }, LOGIN_TIMEOUT_MS)

    try {
      uni.login({
        provider: 'weixin',
        success: (res) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (res.code) {
            resolve(res.code)
            return
          }
          reject(new Error('No wechat code'))
        },
        fail: (err) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          reject(err)
        }
      })
    } catch (err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    }
  })
}

async function ensureTokenValid(): Promise<boolean> {
  const token = getToken()
  if (!token) {
    return false
  }
  try {
    const profile = await fetchUserProfile()
    setCachedUserProfile(profile)
    return true
  } catch {
    clearToken()
    clearCachedUserProfile()
    return false
  }
}

function isLatestRun(runId: number) {
  return runId === authRunSeq
}

async function runLogin(runId: number) {
  const useRealLogin = String(import.meta.env.VITE_WECHAT_REAL_LOGIN || '').toLowerCase() === 'true'
  let code = mockCode()

  if (useRealLogin) {
    code = await tryGetWechatCodeWithTimeout()
    if (isMockWechatCode(code)) {
      throw new Error('微信返回了模拟 code，请关闭游客模式并使用绑定 AppID 的账号调试')
    }
  }

  const loginRes = await wechatLogin({
    code,
    nickname: 'LiftLog User'
  })

  if (!isLatestRun(runId)) {
    return
  }
  setToken(loginRes.token)

  const profile = await fetchUserProfile()
  if (!isLatestRun(runId)) {
    return
  }
  setCachedUserProfile(profile)
}

export async function validateStoredToken() {
  await ensureTokenValid()
}

export async function bootstrapAuth() {
  const valid = await ensureTokenValid()
  if (valid) {
    return
  }
  if (loginInFlight) {
    return loginInFlight
  }

  const runId = ++authRunSeq
  loginInFlight = (async () => {
    try {
      await runLogin(runId)
    } catch (err) {
      if (isLatestRun(runId)) {
        clearToken()
        clearCachedUserProfile()
      }
      throw err
    } finally {
      if (isLatestRun(runId)) {
        loginInFlight = null
      }
    }
  })()
  return loginInFlight
}
