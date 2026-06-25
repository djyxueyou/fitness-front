<script setup lang="ts">
import { computed } from 'vue'
import { cultivationImageUrl } from '@/utils/static-assets'

const props = withDefaults(
  defineProps<{
    visualKey?: string
    themeColor?: string
    accentColor?: string
    muted?: boolean
    upgraded?: boolean
    compact?: boolean
    immersive?: boolean
    thumbnail?: boolean
    ghost?: boolean
    imageMode?: 'aspectFill' | 'aspectFit'
  }>(),
  {
    visualKey: 'body',
    themeColor: '#ff6a2a',
    accentColor: '#b73518',
    muted: false,
    upgraded: false,
    compact: false,
    immersive: false,
    thumbnail: false,
    ghost: false,
    imageMode: 'aspectFill'
  }
)

const imageMap: Record<string, string> = {
  body: cultivationImageUrl('realm-lianti.jpg'),
  qi: cultivationImageUrl('realm-lianqi.jpg'),
  foundation: cultivationImageUrl('realm-zhuji.jpg'),
  core: cultivationImageUrl('realm-jiedan.jpg'),
  spirit: cultivationImageUrl('realm-yuanying.jpg'),
  deity: cultivationImageUrl('realm-huashen.jpg')
}

const imageSrc = computed(() => imageMap[props.visualKey || 'body'] || imageMap.body)
const classes = computed(() => [
  'cultivation-figure',
  {
    'cultivation-figure--muted': props.muted,
    'cultivation-figure--upgraded': props.upgraded,
    'cultivation-figure--compact': props.compact,
    'cultivation-figure--immersive': props.immersive,
    'cultivation-figure--thumbnail': props.thumbnail,
    'cultivation-figure--ghost': props.ghost
  }
])
const styleVars = computed(() => ({
  '--cultivation-theme': props.themeColor,
  '--cultivation-accent': props.accentColor
}))
</script>

<template>
  <view :class="classes" :style="styleVars">
    <view class="cultivation-figure__back-glow" />
    <view class="cultivation-figure__ring cultivation-figure__ring--outer" />
    <view class="cultivation-figure__ring cultivation-figure__ring--inner" />
    <image class="cultivation-figure__image" :src="imageSrc" :mode="imageMode" />
    <view class="cultivation-figure__vignette" />
    <view class="cultivation-figure__fade cultivation-figure__fade--top" />
    <view class="cultivation-figure__fade cultivation-figure__fade--bottom" />
    <view class="cultivation-figure__fade cultivation-figure__fade--left" />
    <view class="cultivation-figure__fade cultivation-figure__fade--right" />
    <view class="cultivation-figure__particle cultivation-figure__particle--one" />
    <view class="cultivation-figure__particle cultivation-figure__particle--two" />
    <view class="cultivation-figure__particle cultivation-figure__particle--three" />
    <view class="cultivation-figure__particle cultivation-figure__particle--four" />
  </view>
</template>

<style lang="scss" scoped>
.cultivation-figure {
  --cultivation-theme: #ff6a2a;
  --cultivation-accent: #b73518;
  position: relative;
  width: 320rpx;
  height: 426rpx;
  margin: 0 auto;
  border-radius: 34rpx;
  overflow: hidden;
  background: #050508;
  box-shadow:
    0 0 46rpx rgba(0, 0, 0, 0.42),
    0 0 34rpx var(--cultivation-theme);
  transform: translateZ(0);

  &--compact {
    width: 240rpx;
    height: 320rpx;
    border-radius: 30rpx;
  }

  &--thumbnail {
    width: 104rpx;
    height: 104rpx;
    border-radius: 22rpx;
    box-shadow:
      0 0 20rpx rgba(0, 0, 0, 0.38),
      0 0 18rpx var(--cultivation-theme);

    .cultivation-figure__image {
      opacity: 0.92;
    }

    .cultivation-figure__back-glow {
      width: 92rpx;
      height: 92rpx;
      filter: blur(18rpx);
    }

    .cultivation-figure__ring,
    .cultivation-figure__particle {
      display: none;
    }

    .cultivation-figure__fade--top {
      height: 28rpx;
    }

    .cultivation-figure__fade--bottom {
      height: 44rpx;
    }
  }

  &--ghost {
    width: 100%;
    height: 430rpx;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    opacity: 0.42;

    .cultivation-figure__image {
      inset: -76rpx -90rpx -36rpx;
      width: calc(100% + 180rpx);
      height: calc(100% + 112rpx);
      opacity: 0.78;
    }

    .cultivation-figure__back-glow {
      top: 28%;
      width: 520rpx;
      height: 520rpx;
      opacity: 0.42;
      filter: blur(72rpx);
    }

    .cultivation-figure__ring {
      top: 50%;
      opacity: 0.14;
    }

    .cultivation-figure__ring--outer {
      width: 520rpx;
      height: 520rpx;
    }

    .cultivation-figure__ring--inner {
      width: 340rpx;
      height: 340rpx;
    }

    .cultivation-figure__fade--top {
      height: 160rpx;
      background: linear-gradient(180deg, rgba(16, 16, 24, 0.72), transparent);
    }

    .cultivation-figure__fade--bottom {
      height: 190rpx;
      background: linear-gradient(0deg, rgba(16, 16, 24, 0.94), transparent);
    }
  }

  &--immersive {
    width: 560rpx;
    max-width: 100%;
    height: 650rpx;
    margin-top: -10rpx;
    margin-bottom: -26rpx;
    border-radius: 0;
    background:
      radial-gradient(circle at 50% 28%, var(--cultivation-theme), transparent 42%),
      radial-gradient(circle at 50% 78%, rgba(255, 255, 255, 0.1), transparent 22%),
      transparent;
    box-shadow: none;

    .cultivation-figure__image {
      inset: -28rpx -42rpx -22rpx;
      width: calc(100% + 84rpx);
      height: calc(100% + 50rpx);
      opacity: 0.96;
    }

    .cultivation-figure__back-glow {
      top: 18%;
      width: 520rpx;
      height: 520rpx;
      opacity: 0.34;
      filter: blur(62rpx);
    }

    .cultivation-figure__ring {
      top: 48%;
      opacity: 0.2;
    }

    .cultivation-figure__ring--outer {
      width: 420rpx;
      height: 420rpx;
    }

    .cultivation-figure__ring--inner {
      width: 290rpx;
      height: 290rpx;
    }

    .cultivation-figure__fade--top {
      height: 122rpx;
      background: linear-gradient(180deg, rgba(16, 16, 24, 0.76), transparent);
    }

    .cultivation-figure__fade--bottom {
      height: 220rpx;
      background:
        linear-gradient(0deg, rgba(16, 16, 24, 0.98) 0%, rgba(16, 16, 24, 0.72) 45%, transparent 100%);
    }

    .cultivation-figure__fade--left,
    .cultivation-figure__fade--right {
      display: block;
      top: 0;
      bottom: 0;
      width: 112rpx;
    }

    .cultivation-figure__fade--left {
      right: auto;
      background: linear-gradient(90deg, rgba(16, 16, 24, 0.88), transparent);
    }

    .cultivation-figure__fade--right {
      left: auto;
      background: linear-gradient(270deg, rgba(16, 16, 24, 0.88), transparent);
    }

    .cultivation-figure__vignette {
      opacity: 1;
    }
  }

  &--muted {
    opacity: 0.62;

    .cultivation-figure__ring,
    .cultivation-figure__particle,
    .cultivation-figure__back-glow {
      animation: none;
      opacity: 0.18;
    }
  }

  &--upgraded {
    box-shadow:
      0 0 54rpx var(--cultivation-theme),
      0 0 92rpx var(--cultivation-accent);

    .cultivation-figure__ring--outer {
      animation-duration: 3.6s;
    }
  }

  &__image {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 100%;
  }

  &__vignette {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    opacity: 0.64;
    background:
      radial-gradient(circle at 50% 42%, transparent 0 38%, rgba(5, 5, 8, 0.28) 66%, rgba(5, 5, 8, 0.72) 100%),
      linear-gradient(180deg, transparent 48%, rgba(5, 5, 8, 0.5));
  }

  &__back-glow {
    position: absolute;
    z-index: 1;
    left: 50%;
    top: 18%;
    width: 280rpx;
    height: 280rpx;
    transform: translateX(-50%);
    border-radius: 999rpx;
    background: var(--cultivation-theme);
    opacity: 0.24;
    filter: blur(34rpx);
    animation: cultivation-glow 2.8s ease-in-out infinite;
  }

  &__ring {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 43%;
    border-radius: 999rpx;
    border: 2rpx solid var(--cultivation-theme);
    transform: translate(-50%, -50%);
    pointer-events: none;
    opacity: 0.36;
    box-shadow: 0 0 28rpx var(--cultivation-theme);
  }

  &__ring--outer {
    width: 280rpx;
    height: 280rpx;
    animation: cultivation-spin 9s linear infinite;
  }

  &__ring--inner {
    width: 190rpx;
    height: 190rpx;
    opacity: 0.22;
    border-style: dashed;
    animation: cultivation-spin-reverse 7s linear infinite;
  }

  &__fade {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 4;
    pointer-events: none;
  }

  &__fade--top {
    top: 0;
    height: 90rpx;
    background: linear-gradient(180deg, rgba(5, 5, 8, 0.66), transparent);
  }

  &__fade--bottom {
    bottom: 0;
    height: 116rpx;
    background: linear-gradient(0deg, rgba(5, 5, 8, 0.82), transparent);
  }

  &__fade--left,
  &__fade--right {
    display: none;
  }

  &__particle {
    position: absolute;
    z-index: 5;
    width: 8rpx;
    height: 8rpx;
    border-radius: 999rpx;
    background: var(--cultivation-theme);
    box-shadow: 0 0 18rpx var(--cultivation-theme);
    animation: cultivation-float 3.2s ease-in-out infinite;
  }

  &__particle--one {
    left: 42rpx;
    top: 120rpx;
  }

  &__particle--two {
    right: 46rpx;
    top: 164rpx;
    animation-delay: 0.6s;
  }

  &__particle--three {
    left: 76rpx;
    bottom: 118rpx;
    animation-delay: 1.1s;
  }

  &__particle--four {
    right: 84rpx;
    bottom: 146rpx;
    animation-delay: 1.7s;
  }
}

@keyframes cultivation-spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes cultivation-spin-reverse {
  to {
    transform: translate(-50%, -50%) rotate(-360deg);
  }
}

@keyframes cultivation-glow {
  0%,
  100% {
    opacity: 0.18;
    transform: translateX(-50%) scale(0.92);
  }

  50% {
    opacity: 0.32;
    transform: translateX(-50%) scale(1.08);
  }
}

@keyframes cultivation-float {
  0% {
    opacity: 0;
    transform: translateY(22rpx) scale(0.7);
  }

  45% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateY(-70rpx) scale(1.08);
  }
}
</style>
