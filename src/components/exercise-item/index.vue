<script setup lang="ts">
import { ref } from 'vue'
import type { Exercise } from '@/types/exercise'

defineProps<{
  exercise: Exercise
  customActions?: boolean
}>()

const thumbFailed = ref(false)

const emit = defineEmits<{
  select: [number]
  favorite: [number]
  rename: [number]
  delete: [number]
}>()

const levelColorMap: Record<string, string> = {
  初级: '#50c8ff',
  中级: '#ffa03c',
  高级: '#ff501e'
}
</script>

<template>
  <view class="glass-card exercise-item">
    <image
      v-if="exercise.thumbnailUrl && !thumbFailed"
      class="exercise-item__thumb"
      :src="exercise.thumbnailUrl"
      mode="aspectFill"
      lazy-load
      @error="thumbFailed = true"
      @tap="emit('select', exercise.id)"
    />
    <view v-else class="exercise-item__avatar" @tap="emit('select', exercise.id)">
      {{ exercise.name.slice(0, 1) }}
    </view>
    <view class="exercise-item__body btn-press" @tap="emit('select', exercise.id)">
      <view class="exercise-item__name">{{ exercise.name }}</view>
      <view class="exercise-item__meta">
        {{ exercise.category || '未分类' }} · {{ exercise.muscle || '未设置肌群' }} ·
        {{ exercise.equipment || '未设置器械' }}
      </view>
    </view>
    <view class="exercise-item__actions" @tap.stop>
      <view
        class="exercise-item__level"
        :style="{
          color: levelColorMap[exercise.level] || '#ffa03c',
          background: `${levelColorMap[exercise.level] || '#ffa03c'}22`
        }"
      >
        {{ exercise.level }}
      </view>
      <view
        class="exercise-item__favorite"
        :class="{ 'exercise-item__favorite--active': exercise.favorited }"
        @tap.stop="emit('favorite', exercise.id)"
      >
        {{ exercise.favorited ? '♥' : '♡' }}
      </view>
      <view
        v-if="customActions && exercise.exerciseType === 'USER'"
        class="exercise-item__custom-action"
        @tap.stop="emit('rename', exercise.id)"
      >
        改
      </view>
      <view
        v-if="customActions && exercise.exerciseType === 'USER'"
        class="exercise-item__custom-action exercise-item__custom-action--danger"
        @tap.stop="emit('delete', exercise.id)"
      >
        删
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

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: 24rpx;
    background: rgba(255, 80, 30, 0.12);
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__meta {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 14rpx;
  }

  &__favorite,
  &__arrow,
  &__custom-action {
    font-size: 28rpx;
    color: #828296;
  }

  &__favorite {
    width: 44rpx;
    height: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    transition:
      color 0.2s ease,
      text-shadow 0.2s ease;

    &--active {
      color: #ff4d4f;
      text-shadow: 0 0 12rpx rgba(255, 77, 79, 0.5);
    }
  }

  &__level {
    padding: 8rpx 16rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
  }

  &__custom-action {
    min-width: 44rpx;
    height: 44rpx;
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    font-size: 20rpx;
    font-weight: 800;

    &--danger {
      color: #ff6b4a;
    }
  }
}
</style>
