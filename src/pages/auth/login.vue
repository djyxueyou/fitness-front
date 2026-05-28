<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { bootstrapAuth } from '@/utils/auth-bootstrap'
import { emitAuthChanged } from '@/utils/auth-events'
import { openPrivacyPolicy } from '@/utils/privacy'
import { openUserAgreement } from '@/utils/user-agreement'

const loading = ref(false)
const agreed = ref(false)
let emitted = false
let eventChannel: UniApp.EventChannel | undefined

onLoad(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  eventChannel = currentPage?.getOpenerEventChannel?.()
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

async function confirmLogin() {
  if (loading.value) return
  if (!agreed.value) {
    uni.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await bootstrapAuth()
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
  <view class="auth-login">
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
  background: #f7f7f8;
  color: #25252b;
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
    background: rgba(0, 0, 0, 0.06);
    color: #6b6b76;
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
    color: #3a3a40;
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
    border: 2rpx solid #b8b8c2;
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
    color: #9a9aa5;
    font-size: 24rpx;
  }

  &__link {
    color: #ff701c;
    font-size: 24rpx;
    text-decoration: underline;
  }
}
</style>
