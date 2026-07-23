<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    level?: number
    badgeName?: string
    badgeCode?: string
    themeColor?: string
    accentColor?: string
    size?: 'sm' | 'md' | 'lg'
    upgraded?: boolean
    showLevel?: boolean
  }>(),
  {
    level: 1,
    badgeName: '青铜',
    badgeCode: 'BRONZE',
    themeColor: '#ff7a1a',
    accentColor: '#cd7f32',
    size: 'md',
    upgraded: false,
    showLevel: true
  }
)

const badgeClass = computed(() => [
  'training-level-badge',
  `training-level-badge--${props.size}`,
  `training-level-badge--${props.badgeCode.toLowerCase()}`,
  {
    'training-level-badge--upgraded': props.upgraded,
    'training-level-badge--name-only': !props.showLevel
  }
])

const badgeStyle = computed(() => ({
  '--level-theme': props.themeColor,
  '--level-accent': props.accentColor
}))
</script>

<template>
  <view :class="badgeClass" :style="badgeStyle">
    <view class="training-level-badge__shine" />
    <view v-if="showLevel" class="training-level-badge__level">Lv.{{ level }}</view>
    <view class="training-level-badge__name">{{ badgeName }}</view>
  </view>
</template>

<style lang="scss" scoped>
.training-level-badge {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.8), transparent 34%),
    linear-gradient(135deg, var(--level-accent), var(--level-theme));
  box-shadow: 0 18rpx 40rpx rgba(255, 98, 31, 0.18);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  &--sm {
    width: 92rpx;
    height: 92rpx;
  }

  &--md {
    width: 116rpx;
    height: 116rpx;
  }

  &--lg {
    width: 148rpx;
    height: 148rpx;
  }

  &--upgraded {
    animation: badge-pop 0.7s ease-out both;
  }

  &--name-only &__name {
    margin-top: 0;
    font-size: 23rpx;
  }

  &__shine {
    position: absolute;
    inset: 10rpx 16rpx auto auto;
    width: 30%;
    height: 18%;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.55);
    filter: blur(2rpx);
  }

  &__level {
    position: relative;
    font-size: 24rpx;
    font-weight: 950;
    line-height: 1;
  }

  &__name {
    position: relative;
    margin-top: 8rpx;
    font-size: 20rpx;
    font-weight: 800;
    line-height: 1;
  }
}

@keyframes badge-pop {
  0% {
    transform: scale(0.88);
  }
  56% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}
</style>
