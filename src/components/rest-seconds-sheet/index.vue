<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  adjustRestSeconds,
  normalizeRestSeconds,
  REST_PRESETS,
  type RestApplyScope
} from '@/utils/rest-options'

const props = withDefaults(
  defineProps<{
    visible: boolean
    exerciseName: string
    value: number
    allowAllMatching?: boolean
    defaultScope?: RestApplyScope
  }>(),
  { allowAllMatching: false, defaultScope: 'CURRENT' }
)

const emit = defineEmits<{
  close: []
  confirm: [value: { restSeconds: number; scope: RestApplyScope }]
}>()
const seconds = ref(60)
const scope = ref<RestApplyScope>('CURRENT')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    seconds.value = normalizeRestSeconds(props.value)
    scope.value = props.defaultScope
  }
)
</script>

<template>
  <view v-if="visible" class="rest-sheet__mask" catchtouchmove="true" @tap="emit('close')">
    <view class="rest-sheet" @tap.stop>
      <view class="rest-sheet__head">
        <view
          ><view class="rest-sheet__title">设置组间休息</view
          ><view class="rest-sheet__sub">{{ exerciseName }}</view></view
        >
        <view class="rest-sheet__close btn-press" @tap="emit('close')">×</view>
      </view>
      <view class="rest-sheet__value-row">
        <view class="rest-sheet__step btn-press" @tap="seconds = adjustRestSeconds(seconds, -1)"
          >−15</view
        >
        <view class="rest-sheet__value">{{ seconds ? `${seconds} 秒` : '不自动休息' }}</view>
        <view class="rest-sheet__step btn-press" @tap="seconds = adjustRestSeconds(seconds, 1)"
          >+15</view
        >
      </view>
      <view class="rest-sheet__presets">
        <view
          v-for="item in REST_PRESETS"
          :key="item"
          class="rest-sheet__preset btn-press"
          :class="{ 'rest-sheet__preset--active': seconds === item }"
          @tap="seconds = item"
        >
          {{ item ? `${item}秒` : '不自动' }}
        </view>
      </view>
      <view v-if="allowAllMatching" class="rest-sheet__scope">
        <view class="rest-sheet__scope-title">应用范围</view>
        <view class="rest-sheet__scope-options">
          <view
            class="rest-sheet__scope-item btn-press"
            :class="{ 'rest-sheet__scope-item--active': scope === 'CURRENT' }"
            @tap="scope = 'CURRENT'"
            >仅当前安排</view
          >
          <view
            class="rest-sheet__scope-item btn-press"
            :class="{ 'rest-sheet__scope-item--active': scope === 'ALL_MATCHING' }"
            @tap="scope = 'ALL_MATCHING'"
            >计划内所有同名动作</view
          >
        </view>
      </view>
      <view
        class="rest-sheet__confirm btn-press"
        @tap="emit('confirm', { restSeconds: seconds, scope })"
        >确认休息时间</view
      >
    </view>
  </view>
</template>

<style scoped lang="scss">
.rest-sheet {
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
  &__head,
  &__value-row,
  &__scope-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }
  &__title {
    font-size: 36rpx;
    font-weight: 800;
  }
  &__sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
  }
  &__close {
    display: grid;
    place-items: center;
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    background: var(--app-surface-soft);
    font-size: 40rpx;
  }
  &__value-row {
    margin: 32rpx 0 24rpx;
  }
  &__value {
    font-size: 42rpx;
    font-weight: 900;
  }
  &__step {
    padding: 18rpx 24rpx;
    border-radius: 20rpx;
    background: var(--app-surface-soft);
    font-weight: 700;
  }
  &__presets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14rpx;
  }
  &__preset,
  &__scope-item {
    padding: 20rpx 8rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 20rpx;
    text-align: center;
    background: var(--app-surface-soft);
  }
  &__preset--active,
  &__scope-item--active {
    border-color: #ff6b2c;
    color: #ff5b1f;
    background: rgba(255, 107, 44, 0.12);
    font-weight: 700;
  }
  &__scope {
    margin-top: 28rpx;
  }
  &__scope-title {
    margin-bottom: 14rpx;
    font-weight: 700;
  }
  &__scope-item {
    flex: 1;
  }
  &__confirm {
    display: grid;
    place-items: center;
    min-height: 92rpx;
    margin-top: 28rpx;
    border-radius: 24rpx;
    color: #fff;
    background: linear-gradient(135deg, #ff541f, #ff8a24);
    font-weight: 800;
  }
}
</style>
