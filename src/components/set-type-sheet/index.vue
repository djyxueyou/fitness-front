<script setup lang="ts">
import type { WorkoutSetType } from '@/stores/workout'
defineProps<{ visible: boolean; value: WorkoutSetType }>()
const emit = defineEmits<{ close: []; select: [value: WorkoutSetType] }>()
const options: Array<{ value: WorkoutSetType; label: string; description: string }> = [
  { value: 'NORMAL', label: '普通组', description: '正式训练，参与完成率和进阶分析' },
  { value: 'WARMUP', label: '热身组', description: '用于准备，不计入正式训练统计' },
  { value: 'DROP', label: '递减组', description: '降低重量继续训练，不参与普通组进阶分析' },
  { value: 'FAILURE', label: '力竭组', description: '做到无法继续标准动作，不参与普通组进阶分析' }
]
</script>
<template>
  <view v-if="visible" class="set-type-sheet__mask" @tap="emit('close')"
    ><view class="set-type-sheet" @tap.stop>
      <view class="set-type-sheet__title">选择组类型</view
      ><view class="set-type-sheet__sub">只改变记录含义，不会自动修改重量或次数</view>
      <view
        v-for="item in options"
        :key="item.value"
        class="set-type-sheet__item btn-press"
        :class="{ 'set-type-sheet__item--active': value === item.value }"
        @tap="emit('select', item.value)"
      >
        <view
          ><view class="set-type-sheet__label">{{ item.label }}</view
          ><view class="set-type-sheet__desc">{{ item.description }}</view></view
        ><view>{{ value === item.value ? '✓' : '›' }}</view>
      </view>
      <view class="set-type-sheet__cancel btn-press" @tap="emit('close')">取消</view>
    </view></view
  >
</template>
<style scoped lang="scss">
.set-type-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 151;
  padding: 30rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: var(--app-surface-raised);
  &__mask {
    position: fixed;
    inset: 0;
    z-index: 150;
    background: rgba(0, 0, 0, 0.58);
  }
  &__title {
    font-size: 36rpx;
    font-weight: 800;
  }
  &__sub {
    margin: 8rpx 0 22rpx;
    color: var(--app-text-muted);
  }
  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22rpx;
    margin-top: 12rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 22rpx;
    background: var(--app-surface-soft);
  }
  &__item--active {
    border-color: #ff6b2c;
    background: rgba(255, 107, 44, 0.1);
  }
  &__label {
    font-weight: 800;
  }
  &__desc {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
  }
  &__cancel {
    display: grid;
    place-items: center;
    min-height: 84rpx;
    margin-top: 20rpx;
    border-radius: 22rpx;
    background: var(--app-surface-soft);
    font-weight: 700;
  }
}
</style>
