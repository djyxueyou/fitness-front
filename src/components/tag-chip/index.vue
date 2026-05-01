<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    active?: boolean
    color?: string
  }>(),
  {
    active: false,
    color: '#ffffff'
  }
)
</script>

<template>
  <view
    class="tag-chip"
    :class="{ 'tag-chip--active': active }"
    :style="
      active
        ? { background: 'linear-gradient(135deg, #ff501e, #ffa03c)', color: '#ffffff' }
        : { background: 'rgba(255,255,255,0.06)', color }
    "
  >
    {{ text }}
  </view>
</template>

<style lang="scss" scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 60rpx;
  padding: 0 24rpx;
  border-radius: 22rpx;
  font-size: 22rpx;
  font-weight: 600;
}
</style>
