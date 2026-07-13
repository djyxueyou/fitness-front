<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { clearToken, getToken, setToken } from '@/api/http'
import { wechatLogin } from '@/api/auth'
import {
  clearCachedUserProfile,
  fetchUserProfile,
  setCachedUserProfile,
  updateUserProfile
} from '@/api/user'
import { emitAuthChanged } from '@/utils/auth-events'
import { openPrivacyPolicy } from '@/utils/privacy'
import { openUserAgreement } from '@/utils/user-agreement'
import { useThemeStore } from '@/stores/theme'

const DEFAULT_LOGIN_TIMEOUT_MS = 10000
const PERSISTENT_MOCK_KEY = 'LIFTLOG_MOCK_OPENID'

const themeStore = useThemeStore()
const loading = ref(false)
const agreed = ref(false)
let emitted = false
let eventChannel: UniApp.EventChannel | undefined

onLoad(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  eventChannel = (
    currentPage as unknown as { getOpenerEventChannel?: () => UniApp.EventChannel }
  )?.getOpenerEventChannel?.()
})

onUnload(() => {
  if (!emitted) {
    emitResult(false)
  }
})

function emitResult(value: boolean) {
  emitted = true
  eventChannel?.emit('authorized', value)
}

function closeWithoutLogin() {
  emitResult(false)
  uni.navigateBack()
}

function toggleAgreed() {
  agreed.value = !agreed.value
}

async function getWechatProfile() {
  const allowed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '完善头像和昵称',
      content: '是否使用微信头像和昵称作为初始资料？不同意将使用默认头像和昵称。',
      cancelText: '使用默认',
      confirmText: '使用微信资料',
      confirmColor: '#ff701c',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
  if (!allowed) return {}
  try {
    const result = await new Promise<UniApp.GetUserProfileRes>((resolve, reject) => {
      uni.getUserProfile({
        desc: '用于完善训练账号头像和昵称',
        success: resolve,
        fail: reject
      })
    })
    return {
      nickname: result.userInfo?.nickName,
      avatarUrl: result.userInfo?.avatarUrl
    }
  } catch (err) {
    console.warn('[auth] get wechat profile skipped', err)
    return {}
  }
}

function getPersistentMockCode() {
  const stored = uni.getStorageSync(PERSISTENT_MOCK_KEY)
  if (stored) return String(stored)
  const code = `mock-${Date.now()}`
  uni.setStorageSync(PERSISTENT_MOCK_KEY, code)
  return code
}

function isMockWechatCode(code: string) {
  const normalized = String(code || '')
    .trim()
    .toLowerCase()
  return !normalized || normalized.includes('mock') || normalized.includes('the code is a mock one')
}

function getLoginTimeoutMs() {
  const configured = Number(import.meta.env.VITE_WECHAT_LOGIN_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LOGIN_TIMEOUT_MS
}

function shouldUseRealWechatLogin() {
  let isWechatMiniProgram = false
  // #ifdef MP-WEIXIN
  isWechatMiniProgram = true
  // #endif
  return (
    isWechatMiniProgram &&
    String(import.meta.env.VITE_WECHAT_REAL_LOGIN || '').toLowerCase() === 'true'
  )
}

async function getWechatCodeWithTimeout(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('微信登录超时，请重试'))
    }, getLoginTimeoutMs())

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

async function ensureTokenValid() {
  if (!getToken()) return false
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

async function loginWithWechat() {
  if (await ensureTokenValid()) return

  let code = getPersistentMockCode()
  if (shouldUseRealWechatLogin()) {
    code = await getWechatCodeWithTimeout()
    if (isMockWechatCode(code)) {
      throw new Error('微信返回了模拟 code，请关闭游客模式并使用绑定 AppID 的账号调试')
    }
  }

  const loginRes = await wechatLogin({ code })
  setToken(loginRes.token)

  if (loginRes.newUser && loginRes.profileInitializedByDefault) {
    const wechatProfile = await getWechatProfile()
    if (wechatProfile.nickname || wechatProfile.avatarUrl) {
      await updateUserProfile({
        nickname: wechatProfile.nickname || loginRes.nickname,
        avatarUrl: wechatProfile.avatarUrl || loginRes.avatarUrl
      })
    }
  }

  const profile = await fetchUserProfile()
  setCachedUserProfile(profile)
}

async function confirmLogin() {
  if (loading.value) return
  if (!agreed.value) {
    uni.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await loginWithWechat()
    emitAuthChanged()
    uni.showToast({ title: '登录成功', icon: 'none' })
    emitResult(true)
    uni.navigateBack()
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : '登录失败，请稍后重试'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
    console.error('[auth] login page failed', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="auth-login" :class="themeStore.themeClass">
    <view class="auth-login__close btn-press" @tap="closeWithoutLogin">×</view>

    <view class="auth-login__content">
      <image class="auth-login__logo" src="/static/app-logo.png" mode="aspectFill" />
      <view class="auth-login__name">健身房辅助训练助手</view>

      <view
        class="auth-login__button btn-press"
        :class="{ 'auth-login__button--loading': loading }"
        @tap="confirmLogin"
      >
        {{ loading ? '登录中...' : '微信一键登录' }}
      </view>

      <view class="auth-login__agreement">
        <view
          class="auth-login__checkbox"
          :class="{ 'auth-login__checkbox--checked': agreed }"
          @tap="toggleAgreed"
        >
          <text v-if="agreed">✓</text>
        </view>
        <text class="auth-login__agreement-text">我已阅读并同意</text>
        <text class="auth-login__link" @tap="openUserAgreement">《用户协议》</text>
        <text class="auth-login__agreement-text">和</text>
        <text class="auth-login__link" @tap="openPrivacyPolicy">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auth-login {
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 100, 24, 0.08), transparent 34%), var(--app-bg);
  color: var(--app-text);
  position: relative;
  display: flex;
  justify-content: center;

  &__close {
    position: fixed;
    left: 34rpx;
    top: calc(var(--status-bar-height) + 24rpx);
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 1rpx solid var(--app-border);
    background: var(--app-surface);
    color: var(--app-text-secondary);
    box-shadow: var(--app-shadow-card);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 38rpx;
    line-height: 1;
  }

  &__content {
    width: 100%;
    padding: 190rpx 72rpx 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__logo {
    width: 156rpx;
    height: 156rpx;
    border-radius: 36rpx;
    box-shadow: 0 14rpx 36rpx rgba(255, 112, 28, 0.18);
  }

  &__name {
    margin-top: 34rpx;
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 700;
  }

  &__button {
    width: 100%;
    height: 88rpx;
    margin-top: 112rpx;
    border-radius: 999rpx;
    background: linear-gradient(135deg, #ff501e, #ff941c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    font-weight: 800;
    box-shadow: 0 14rpx 32rpx rgba(255, 112, 28, 0.22);

    &--loading {
      opacity: 0.72;
    }
  }

  &__agreement {
    margin-top: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    row-gap: 10rpx;
  }

  &__checkbox {
    width: 32rpx;
    height: 32rpx;
    margin-right: 14rpx;
    border-radius: 6rpx;
    border: 2rpx solid var(--app-border-strong);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;

    &--checked {
      border-color: #ff701c;
      background: #ff701c;
    }
  }

  &__agreement-text {
    color: var(--app-text-muted);
    font-size: 24rpx;
  }

  &__link {
    color: var(--app-accent);
    font-size: 24rpx;
    text-decoration: underline;
  }
}
</style>
