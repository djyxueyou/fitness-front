<script setup lang="ts">
import type { Exercise } from '@/types/exercise'

defineProps<{
  exercise: Exercise
}>()

const emit = defineEmits<{
  tap: [number]
  favorite: [number]
}>()

const levelColorMap: Record<string, string> = {
  初级: '#50c8ff',
  中级: '#ffa03c',
  高级: '#ff501e'
}
</script>

<template>
  <view class="glass-card exercise-item btn-press" @tap="emit('tap', exercise.id)">
    <view class="exercise-item__avatar">{{ exercise.name.slice(0, 1) }}</view>
    <view class="exercise-item__body">
      <view class="exercise-item__name">{{ exercise.name }}</view>
      <view class="exercise-item__meta">{{ exercise.muscle }} · {{ exercise.equipment }}</view>
    </view>
    <view class="exercise-item__actions">
      <view class="exercise-item__level" :style="{ color: levelColorMap[exercise.level], background: `${levelColorMap[exercise.level]}22` }">
        {{ exercise.level }}
      </view>
      <view class="exercise-item__favorite" @tap.stop="emit('favorite', exercise.id)">
        {{ exercise.favorited ? '★' : '☆' }}
      </view>
      <view class="exercise-item__arrow">›</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.exercise-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;

  &__avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 24rpx;
    background: rgba(255, 80, 30, 0.15);
    color: #ff501e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__meta {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 14rpx;
  }

  &__favorite,
  &__arrow {
    font-size: 28rpx;
    color: #828296;
  }

  &__favorite {
    width: 56rpx;
    text-align: center;
  }

  &__level {
    padding: 8rpx 16rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
  }
}
</style>
