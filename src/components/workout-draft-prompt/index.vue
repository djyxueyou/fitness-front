<script setup lang="ts">
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useWorkoutStore } from '@/stores/workout'

const promptStore = useWorkoutDraftPromptStore()
const workoutStore = useWorkoutStore()
</script>

<template>
  <view v-if="promptStore.visible" class="draft-prompt">
    <view class="draft-prompt__mask" @tap="promptStore.close" />
    <view class="draft-prompt__sheet">
      <view class="draft-prompt__handle" />
      <template v-if="!promptStore.confirmingDiscard">
        <view class="draft-prompt__eyebrow">未完成训练</view>
        <view class="draft-prompt__title">
          {{ promptStore.startTarget ? '选择接下来要进行的训练' : '继续当前训练？' }}
        </view>
        <view class="draft-prompt__section-label">当前草稿</view>
        <view class="draft-prompt__summary">
          <view class="draft-prompt__summary-icon">▶</view>
          <view class="draft-prompt__summary-copy">
            <view class="draft-prompt__summary-title">{{ workoutStore.draftSummary.title }}</view>
            <view class="draft-prompt__summary-sub">
              已记录 {{ workoutStore.draftSummary.exerciseCount }} 个动作 ·
              {{ workoutStore.draftSummary.durationText }} ·
              {{ workoutStore.draftSummary.doneSets }} 组
            </view>
          </view>
        </view>
        <view v-if="promptStore.startTarget" class="draft-prompt__section-label">准备开始</view>
        <view v-if="promptStore.startTarget" class="draft-prompt__next">
          <view class="draft-prompt__next-icon">＋</view>
          <view class="draft-prompt__summary-copy">
            <view class="draft-prompt__summary-title">{{ promptStore.startTarget.title }}</view>
            <view class="draft-prompt__summary-sub">
              {{ promptStore.startTarget.subtitle || '删除当前草稿后直接开始' }}
            </view>
          </view>
        </view>
        <view
          class="gradient-fire draft-prompt__primary btn-press"
          @tap="promptStore.choose('continue')"
        >
          继续训练
        </view>
        <view class="draft-prompt__danger btn-press" @tap="promptStore.requestDiscard">
          {{
            promptStore.startTarget
              ? `删除草稿并开始“${promptStore.startTarget.title}”`
              : '删除草稿'
          }}
        </view>
        <view class="draft-prompt__cancel btn-press" @tap="promptStore.close">取消</view>
      </template>

      <template v-else>
        <view class="draft-prompt__eyebrow draft-prompt__eyebrow--danger">删除草稿</view>
        <view class="draft-prompt__title">
          {{ promptStore.startTarget ? '删除草稿并开始新训练？' : '删除这次训练草稿？' }}
        </view>
        <view class="draft-prompt__desc">
          已记录的动作、组数和重量会被删除，无法恢复。{{
            promptStore.startTarget ? `删除后将直接开始“${promptStore.startTarget.title}”。` : ''
          }}
        </view>
        <view class="draft-prompt__confirm-actions">
          <view
            class="draft-prompt__cancel draft-prompt__confirm-btn btn-press"
            @tap="promptStore.cancelDiscard"
          >
            取消
          </view>
          <view
            class="draft-prompt__danger draft-prompt__confirm-btn btn-press"
            @tap="promptStore.choose('discard')"
          >
            {{ promptStore.startTarget ? '删除并开始' : '删除' }}
          </view>
        </view>
      </template>
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

  &__eyebrow {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
  }

  &__title {
    margin-top: 12rpx;
    color: var(--app-text);
    font-size: 40rpx;
    font-weight: 900;
  }

  &__summary {
    margin-top: 24rpx;
    padding: 22rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
    background:
      radial-gradient(circle at 0% 0%, rgba(255, 100, 24, 0.1), transparent 44%), var(--app-surface);
    border: 1px solid var(--app-border);
  }

  &__section-label {
    margin-top: 22rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
    font-weight: 800;
  }

  &__next {
    margin-top: 10rpx;
    padding: 20rpx 22rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
    background: var(--app-accent-soft);
    border: 1px solid rgba(255, 80, 30, 0.24);
  }

  &__next-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-surface);
    font-size: 34rpx;
    font-weight: 800;
  }

  &__summary-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ff8c00);
    box-shadow: 0 0 28rpx rgba(255, 80, 30, 0.32);
    flex-shrink: 0;
    font-size: 24rpx;
  }

  &__summary-copy {
    flex: 1;
    min-width: 0;
  }

  &__summary-title {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 900;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__summary-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.4;
  }

  &__desc {
    margin-top: 14rpx;
    color: var(--app-text-secondary);
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
    color: var(--app-danger);
    background: rgba(255, 107, 74, 0.12);
    border: 1px solid rgba(255, 107, 74, 0.18);
  }

  &__eyebrow--danger {
    color: var(--app-danger);
  }

  &__confirm-actions {
    margin-top: 30rpx;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16rpx;
  }

  &__confirm-btn {
    margin-top: 0;
  }

  &__cancel {
    margin-top: 16rpx;
    color: var(--app-text-secondary);
    background: var(--app-bg);
  }
}
</style>
