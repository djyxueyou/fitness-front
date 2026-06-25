<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { exerciseDefaultImageUrl } from '@/utils/static-assets'

const props = defineProps<{
  name: string
  recordType?: string
  url?: string
  size?: 'small' | 'large'
}>()

const failed = ref(false)

watch(
  () => props.url,
  () => {
    failed.value = false
  }
)

const fallbackSource = computed(() => {
  if (props.recordType === 'DURATION') return exerciseDefaultImageUrl('duration.jpg')
  if (props.recordType === 'BODYWEIGHT_REPS') return exerciseDefaultImageUrl('bodyweight-reps.jpg')
  return exerciseDefaultImageUrl('weight-reps.jpg')
})
</script>

<template>
  <image
    v-if="url && !failed"
    class="exercise-thumbnail"
    :class="`exercise-thumbnail--${size || 'small'}`"
    :src="url"
    mode="aspectFill"
    lazy-load
    @error="failed = true"
  />
  <image
    v-else
    class="exercise-thumbnail exercise-thumbnail--fallback"
    :class="`exercise-thumbnail--${size || 'small'}`"
    :src="fallbackSource"
    mode="aspectFill"
    lazy-load
  />
</template>

<style lang="scss" scoped>
.exercise-thumbnail {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
  background: rgba(255, 80, 30, 0.12);

  &--large {
    width: 104rpx;
    height: 104rpx;
    border-radius: 24rpx;
  }

  &--fallback {
    border: 1rpx solid rgba(255, 80, 30, 0.18);
    box-shadow: inset 0 0 20rpx rgba(255, 255, 255, 0.04);
  }
}
</style>
