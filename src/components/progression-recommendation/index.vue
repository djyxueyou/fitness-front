<script setup lang="ts">
import type { ExerciseProgressionRecommendation } from '@/api/progression'

const props = defineProps<{
  recommendation?: ExerciseProgressionRecommendation
}>()

const emit = defineEmits<{
  apply: []
  keep: []
  upgrade: []
}>()

function handlePrimary() {
  if (props.recommendation?.locked) {
    emit('upgrade')
    return
  }
  emit('apply')
}
</script>

<template>
  <view v-if="recommendation?.available" class="progression-card">
    <view class="progression-card__copy">
      <view class="progression-card__label">本次建议</view>
      <view v-if="recommendation.targetText" class="progression-card__target">
        {{ recommendation.targetText }}
      </view>
      <view class="progression-card__reason">{{ recommendation.reasonText }}</view>
      <view v-if="recommendation.evidence?.length && !recommendation.locked" class="progression-card__hint">
        依据：{{ recommendation.evidence.map((item) => item.label).join('、') }}
      </view>
      <view v-if="recommendation.effectText" class="progression-card__hint">
        {{ recommendation.effectText }}
      </view>
    </view>
    <view class="progression-card__actions">
      <view v-if="!recommendation.locked" class="progression-card__keep btn-press" @tap="$emit('keep')">
        {{ recommendation.secondaryActionText || '保持当前' }}
      </view>
      <view class="progression-card__apply btn-press" @tap="handlePrimary">
        {{ recommendation.primaryActionText || '应用建议' }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.progression-card {
  margin-bottom: 18rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  border: 1px solid rgba(47, 125, 247, 0.2);
  background: rgba(47, 125, 247, 0.07);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;

  &__copy {
    flex: 1;
    min-width: 0;
  }

  &__label {
    color: var(--app-info, #2f7df7);
    font-size: 21rpx;
    font-weight: 800;
  }

  &__target {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
    line-height: 1.3;
  }

  &__reason {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 23rpx;
    line-height: 1.45;
  }

  &__hint {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 19rpx;
    line-height: 1.4;
  }

  &__actions {
    display: flex;
    gap: 10rpx;
  }

  &__keep,
  &__apply {
    padding: 14rpx 16rpx;
    border-radius: 999rpx;
    font-size: 21rpx;
    font-weight: 800;
    white-space: nowrap;
  }

  &__keep {
    color: var(--app-text-secondary);
    background: var(--app-surface);
  }

  &__apply {
    color: #fff;
    background: var(--app-info, #2f7df7);
  }
}
</style>
