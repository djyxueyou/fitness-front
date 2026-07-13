<script setup lang="ts">
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'

defineProps<{
  name: string
  url?: string
  recordType?: string
}>()
</script>

<template>
  <view class="template-cover">
    <ExerciseThumbnail :name="name" :record-type="recordType" :url="url" size="large" />
  </view>
</template>

<style lang="scss" scoped>
.template-cover {
  position: relative;
  width: 104rpx;
  height: 104rpx;
  flex-shrink: 0;
}
</style>
