<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

const startX = ref(0)
const startY = ref(0)
const isMoving = ref(false)
const offset = ref(0)
const threshold = 35 // px
const maxDistance = 70 // px

function onTouchStart(e: TouchEvent) {
  if (props.disabled) return
  const touch = e.touches[0] || e.changedTouches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  isMoving.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isMoving.value || props.disabled) return
  const touch = e.touches[0] || e.changedTouches[0]
  const diffX = touch.clientX - startX.value
  const diffY = touch.clientY - startY.value

  // If moving more vertically than horizontally, it's likely a scroll
  if (Math.abs(diffY) > Math.abs(diffX)) {
    return
  }

  // Only allow sliding left
  if (diffX < 0) {
    offset.value = Math.max(diffX, -maxDistance)
  } else {
    offset.value = 0
  }
}

function onTouchEnd() {
  if (props.disabled) return
  isMoving.value = false
  if (offset.value < -threshold) {
    offset.value = -maxDistance // Keep menu open
  } else {
    offset.value = 0
  }
}

function handleDelete() {
  offset.value = 0
  emit('delete')
}

function close() {
  offset.value = 0
}

defineExpose({ close })
</script>

<template>
  <view class="swipe-action">
    <view class="swipe-action__menu" @tap.stop="handleDelete">
      <view class="swipe-action__delete">删除</view>
    </view>
    <view
      class="swipe-action__content"
      :style="{ transform: `translateX(${offset}px)` }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <slot />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.swipe-action {
  position: relative;
  width: 100%;
  border-radius: inherit;

  &__content {
    position: relative;
    z-index: 2;
    background: inherit;
    transition: transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  &__menu {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 140rpx;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  &__delete {
    width: 140rpx;
    height: 100%;
    background: #ff4d4f;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 700;
    border-radius: 0 24rpx 24rpx 0;
  }
}
</style>
