<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const aboutFeatures = [
  { icon: '📒', title: '训练记录', desc: '记录每次训练的动作、重量、次数和容量。' },
  { icon: '🏋️', title: '动作库', desc: '按部位浏览动作，查看训练所需的基础信息。' },
  { icon: '⭐', title: '模板复用', desc: '使用系统模板或保存自己的常用训练计划。' }
]

onShow(async () => {
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    uni.switchTab({ url: routes.home })
  }
})

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="关于" show-back @back="goBack" />

      <view class="about__hero">
        <view class="about__logo">🔥</view>
        <view class="title-lg">FitForge</view>
        <view class="muted about__version">v1.0.0 · 锻造更强的自己</view>
      </view>

      <GlassCard>
        <view class="about__feature-card">
          <view class="about__section-title">核心功能</view>
          <view v-for="item in aboutFeatures" :key="item.title" class="about__feature">
            <view class="about__feature-icon">{{ item.icon }}</view>
            <view class="about__feature-body">
              <view class="about__feature-title">{{ item.title }}</view>
              <view class="about__feature-desc">{{ item.desc }}</view>
            </view>
          </view>
        </view>
      </GlassCard>

      <view class="about__links">
        <view class="glass-card about__link btn-press">
          <view class="about__link-icon">›</view>
          <view class="about__link-body">
            <view class="about__feature-title">用户协议</view>
            <view class="about__feature-desc">查看隐私政策与使用条款</view>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.about {
  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 28rpx;
  }

  &__logo {
    width: 128rpx;
    height: 128rpx;
    border-radius: 40rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 54rpx;
    color: #fff;
    margin-bottom: 18rpx;
  }

  &__version {
    margin-top: 10rpx;
  }

  &__feature-card {
    padding: 24rpx;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 18rpx;
  }

  &__feature,
  &__link {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
  }

  &__feature + &__feature {
    margin-top: 18rpx;
  }

  &__feature-icon,
  &__link-icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__feature-body,
  &__link-body {
    flex: 1;
  }

  &__feature-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__feature-desc {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.6;
  }

  &__links {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    margin-top: 20rpx;
  }

  &__link {
    padding: 24rpx;
  }
}
</style>
