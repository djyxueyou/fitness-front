<script setup lang="ts">
defineProps<{
  neon?: boolean
}>()
</script>

<template>
  <view class="glass-card" :class="{ 'glass-card--neon': neon }">
    <slot />
  </view>
</template>
