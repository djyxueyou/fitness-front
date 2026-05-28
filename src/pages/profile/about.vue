<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { openPrivacyPolicy } from '@/utils/privacy'
import { openUserAgreement } from '@/utils/user-agreement'

const aboutFeatures = [
  { icon: '📝', title: '训练记录', desc: '记录动作、重量、次数、组数和训练容量。' },
  { icon: '🏋️', title: '动作库', desc: '按部位浏览动作，查看演示、要点和常见错误。' },
  { icon: '⭐', title: '模板复用', desc: '使用系统模板，或沉淀自己的常用训练计划。' }
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
        <image class="about__logo" src="/static/app-logo.png" mode="aspectFill" />
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

      <GlassCard>
        <view class="about__privacy-card btn-press" @tap="openUserAgreement">
          <view>
            <view class="about__section-title">用户协议</view>
            <view class="about__feature-desc">
              查看账号使用、会员服务、训练风险提示和用户行为规则。
            </view>
          </view>
          <view class="about__arrow">›</view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="about__privacy-card btn-press" @tap="openPrivacyPolicy">
          <view>
            <view class="about__section-title">隐私政策</view>
            <view class="about__feature-desc">
              登录后保存训练记录、收藏、模板和会员状态。点击查看完整隐私政策。
            </view>
          </view>
          <view class="about__arrow">›</view>
        </view>
      </GlassCard>
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
    margin-bottom: 18rpx;
    box-shadow: 0 0 32rpx rgba(255, 80, 30, 0.24);
  }

  &__version {
    margin-top: 10rpx;
  }

  &__feature-card,
  &__privacy-card {
    padding: 24rpx;
  }

  &__privacy-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 18rpx;
  }

  &__feature {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
  }

  &__feature + &__feature {
    margin-top: 18rpx;
  }

  &__feature-icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__feature-body {
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

  &__arrow {
    color: #828296;
    font-size: 42rpx;
  }
}
</style>
