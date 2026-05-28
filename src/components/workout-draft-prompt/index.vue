<script setup lang="ts">
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'

const promptStore = useWorkoutDraftPromptStore()
</script>

<template>
  <view v-if="promptStore.visible" class="draft-prompt">
    <view class="draft-prompt__mask" @tap="promptStore.close" />
    <view class="draft-prompt__sheet">
      <view class="draft-prompt__handle" />
      <view class="draft-prompt__eyebrow">未完成训练</view>
      <view class="draft-prompt__title">继续当前训练？</view>
      <view class="draft-prompt__desc">
        你还有一场训练没有完成，可以继续记录，或放弃后重新开始。
      </view>
      <view class="gradient-fire draft-prompt__primary btn-press" @tap="promptStore.choose('continue')">
        继续当前训练
      </view>
      <view class="draft-prompt__danger btn-press" @tap="promptStore.choose('discard')">
        放弃并重新开始
      </view>
      <view class="draft-prompt__cancel btn-press" @tap="promptStore.close">返回</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.draft-prompt {
  position: fixed;
  inset: 0;
  z-index: 9998;

  &__mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(12rpx);
  }

  &__sheet {
    position: absolute;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(28rpx + env(safe-area-inset-bottom));
    padding: 28rpx;
    border-radius: 36rpx;
    border: 1px solid rgba(255, 80, 30, 0.28);
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 80, 30, 0.28), transparent 48%),
      rgba(18, 18, 26, 0.98);
    box-shadow: 0 30rpx 80rpx rgba(0, 0, 0, 0.5);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 24rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.16);
  }

  &__eyebrow {
    color: #ff7a32;
    font-size: 22rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
  }

  &__title {
    margin-top: 12rpx;
    color: #f5f5fa;
    font-size: 40rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 14rpx;
    color: #b8b8c8;
    font-size: 26rpx;
    line-height: 1.65;
  }

  &__primary,
  &__danger,
  &__cancel {
    min-height: 90rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__primary {
    margin-top: 30rpx;
    color: #fff;
  }

  &__danger {
    margin-top: 16rpx;
    color: #ff6b4a;
    background: rgba(255, 107, 74, 0.12);
    border: 1px solid rgba(255, 107, 74, 0.18);
  }

  &__cancel {
    margin-top: 16rpx;
    color: #d8d8e6;
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
