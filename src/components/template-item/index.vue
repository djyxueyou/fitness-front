<script setup lang="ts">
import type { Template } from '@/types/template'

defineProps<{
  template: Template
  compact?: boolean
  editable?: boolean
}>()

const emit = defineEmits<{
  start: [number]
  detail: [number]
  edit: [number]
}>()
</script>

<template>
  <view class="glass-card template-item btn-press" @tap="emit('detail', template.id)">
    <view class="template-item__top">
      <view
        class="template-item__badge"
        :style="{ background: template.color, color: template.accent }"
      >
        {{ template.tag }}
      </view>
      <view class="template-item__info">
        <view class="template-item__name-row">
          <view class="template-item__name">{{ template.name }}</view>
          <view v-if="template.templateType === 'SYSTEM'" class="template-item__system">
            系统推荐
          </view>
        </view>
        <view class="template-item__meta">
          {{ template.exercises }} 个动作 · {{ template.duration }} min · {{ template.level }}
        </view>
      </view>
      <view class="template-item__actions">
        <view
          v-if="editable && template.templateType !== 'SYSTEM'"
          class="template-item__edit btn-press"
          @tap.stop="emit('edit', template.id)"
        >
          编辑
        </view>
        <view class="template-item__play btn-press" @tap.stop="emit('start', template.id)">
          ▶
        </view>
      </view>
    </view>
    <view class="template-item__muscles">
      <view
        v-for="muscle in template.muscles"
        :key="muscle"
        class="template-item__chip"
        :style="{ background: template.color }"
      >
        {{ muscle }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.template-item {
  padding: 24rpx;

  &__top {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__badge {
    width: 80rpx;
    height: 80rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    min-width: 0;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__system {
    padding: 6rpx 12rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff501e;
    font-size: 18rpx;
    flex-shrink: 0;
  }

  &__meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12rpx;
    flex-shrink: 0;
  }

  &__edit {
    padding: 16rpx 20rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    font-size: 22rpx;
  }

  &__play {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__muscles {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 20rpx;
  }

  &__chip {
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    color: #f5f5fa;
    font-size: 20rpx;
  }
}
</style>
