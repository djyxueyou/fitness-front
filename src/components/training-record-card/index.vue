<script setup lang="ts">
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'

withDefaults(
  defineProps<{
    name: string
    meta: string
    coverUrl?: string
    coverRecordType?: string
    variant?: 'light' | 'dark'
  }>(),
  {
    coverUrl: '',
    coverRecordType: '',
    variant: 'light'
  }
)

const emit = defineEmits<{
  tap: []
}>()
</script>

<template>
  <view
    class="training-record-card btn-press"
    :class="`training-record-card--${variant}`"
    @tap="emit('tap')"
  >
    <ExerciseThumbnail :name="name" :url="coverUrl" :record-type="coverRecordType" />
    <view class="training-record-card__body">
      <view class="training-record-card__name">{{ name }}</view>
      <view class="training-record-card__meta">{{ meta }}</view>
    </view>
    <view class="training-record-card__arrow">→</view>
  </view>
</template>

<style lang="scss" scoped>
.training-record-card {
  min-height: 112rpx;
  padding: 18rpx;
  border-radius: 28rpx;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16rpx;

  &--light {
    border: 1rpx solid var(--app-border);
    background: var(--app-surface);
    box-shadow: var(--app-shadow-card);
  }

  &--dark {
    border: 1rpx solid var(--app-border);
    background: var(--app-surface);
    box-shadow: var(--app-shadow-card);
  }

  &__body {
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    color: var(--app-text);
    font-size: 25rpx;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--dark &__name {
    color: var(--app-text);
  }

  &__meta {
    margin-top: 7rpx;
    overflow: hidden;
    color: var(--app-text-muted);
    font-size: 19rpx;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--dark &__meta {
    color: var(--app-text-muted);
  }

  &__arrow {
    width: 34rpx;
    color: var(--app-text-muted);
    font-size: 26rpx;
    font-weight: 900;
    text-align: center;
  }

  &--dark &__arrow {
    color: var(--app-text-muted);
  }
}
</style>
