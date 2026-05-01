<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <view
    class="toggle"
    :class="{ 'toggle--on': modelValue }"
    @tap="emit('update:modelValue', !modelValue)"
  >
    <view class="toggle__thumb" :class="{ 'toggle__thumb--on': modelValue }" />
  </view>
</template>

<style lang="scss" scoped>
.toggle {
  width: 84rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.12);
  padding: 4rpx;
  transition: all 0.25s ease;

  &--on {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
  }

  &__thumb {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.25s ease;

    &--on {
      transform: translateX(36rpx);
    }
  }
}
</style>
