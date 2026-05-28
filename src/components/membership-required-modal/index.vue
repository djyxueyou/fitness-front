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
      <view class="membership-modal__actions">
        <view class="membership-modal__secondary btn-press" @tap="promptStore.close(false)">
          暂不开通
        </view>
        <view class="gradient-fire membership-modal__primary btn-press" @tap="promptStore.goMembership">
          开通会员
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
    border: 1px solid rgba(255, 80, 30, 0.32);
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 80, 30, 0.3), transparent 48%),
      linear-gradient(180deg, rgba(32, 18, 18, 0.98), rgba(18, 18, 26, 0.98));
    box-shadow:
      0 30rpx 80rpx rgba(0, 0, 0, 0.48),
      0 0 48rpx rgba(255, 80, 30, 0.18);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 24rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.16);
  }

  &__badge {
    width: fit-content;
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.18);
    color: #ff8a3d;
    font-size: 22rpx;
    font-weight: 900;
    letter-spacing: 1rpx;
  }

  &__title {
    margin-top: 18rpx;
    color: #f5f5fa;
    font-size: 40rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 14rpx;
    color: #c7c7d6;
    font-size: 26rpx;
    line-height: 1.65;
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
    color: #d8d8e6;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__primary {
    color: #fff;
  }
}
</style>
