<script setup lang="ts">
import { useMembershipPromptStore } from '@/stores/membership-prompt'

const promptStore = useMembershipPromptStore()
</script>

<template>
  <view v-if="promptStore.visible" class="membership-modal">
    <view class="membership-modal__mask" @tap="promptStore.close(false)" />
    <view class="membership-modal__card">
      <view class="membership-modal__handle" />
      <view class="membership-modal__badge">PRO</view>
      <view class="membership-modal__title">{{ promptStore.title }}</view>
      <view class="membership-modal__desc">{{ promptStore.description }}</view>
      <view v-if="promptStore.bullets.length" class="membership-modal__bullets">
        <view v-for="item in promptStore.bullets" :key="item" class="membership-modal__bullet">
          <text class="membership-modal__bullet-dot">✓</text>
          <text>{{ item }}</text>
        </view>
      </view>
      <view class="membership-modal__actions">
        <view class="membership-modal__secondary btn-press" @tap="promptStore.runSecondary">
          {{ promptStore.secondaryActionText }}
        </view>
        <view
          class="gradient-fire membership-modal__primary btn-press"
          @tap="promptStore.goMembership"
        >
          {{ promptStore.primaryActionText || '开通会员' }}
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.membership-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;

  &__mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(12rpx);
  }

  &__card {
    position: absolute;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(28rpx + env(safe-area-inset-bottom));
    padding: 28rpx;
    border-radius: 36rpx;
    border: 1px solid var(--app-border);
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 100, 24, 0.12), transparent 48%),
      var(--app-surface-raised);
    box-shadow: var(--app-shadow-focus);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 24rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
  }

  &__badge {
    width: fit-content;
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
    letter-spacing: 1rpx;
  }

  &__title {
    margin-top: 18rpx;
    color: var(--app-text);
    font-size: 40rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 14rpx;
    color: var(--app-text-secondary);
    font-size: 26rpx;
    line-height: 1.65;
  }

  &__bullets {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    margin-top: 22rpx;
  }

  &__bullet {
    display: flex;
    gap: 12rpx;
    align-items: flex-start;
    color: var(--app-text);
    font-size: 24rpx;
    line-height: 1.5;
  }

  &__bullet-dot {
    width: 34rpx;
    height: 34rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 16rpx;
    margin-top: 30rpx;
  }

  &__secondary,
  &__primary {
    min-height: 90rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__secondary {
    color: var(--app-text-secondary);
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__primary {
    color: #fff;
  }
}
</style>
