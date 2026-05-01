<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'
import { formatWeight } from '@/utils/unit'

const profileStore = useProfileStore()
const avatarText = computed(() => (profileStore.nickname || 'U').slice(0, 1).toUpperCase())
const weightUnit = computed(() => profileStore.unit)
const profileStats = computed(() => [
  { icon: '🔥', value: `${profileStore.currentStreakDays} 天`, label: '连续训练' },
  { icon: '🏋', value: `${profileStore.totalSessions} 次`, label: '累计训练' },
  {
    icon: '⚡',
    value: `${formatWeight(profileStore.totalVolumeKg, weightUnit.value, 0)} ${weightUnit.value}`,
    label: '累计容量'
  }
])

const menuItems = [
  {
    label: '训练日历',
    sub: '查看训练记录',
    path: routes.workoutCalendar,
    icon: '📦',
    tone: 'cyan'
  },
  {
    label: '历史记录',
    sub: '浏览训练明细',
    path: routes.profileHistory,
    icon: '🕘',
    tone: 'orange'
  },
  {
    label: '模板管理',
    sub: '维护训练模板',
    path: routes.templateManager,
    icon: '🎸',
    tone: 'violet'
  },
  { label: '我的收藏', sub: '常用动作收藏', path: routes.favorites, icon: '⭐', tone: 'gold' }
]

const otherItems = [
  { label: '设置', path: routes.settings, icon: '⚿' },
  { label: '关于', path: routes.about, icon: '⚸' }
]

onShow(async () => {
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await Promise.all([profileStore.refreshProfile(), profileStore.refreshSummary()])
})

function openPage(path: string) {
  uni.navigateTo({ url: path })
}

function getToneBg(tone?: string) {
  switch (tone) {
    case 'cyan':
      return 'rgba(80, 200, 255, 0.15)'
    case 'violet':
      return 'rgba(200, 80, 255, 0.15)'
    case 'gold':
      return 'rgba(255, 200, 80, 0.15)'
    default:
      return 'rgba(255, 80, 30, 0.15)'
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell tab-page safe-bottom">
      <view class="profile__hero">
        <view class="profile__hero-top">
          <view class="profile__avatar">{{ avatarText }}</view>
          <view class="profile__info">
            <view class="eyebrow">Athlete Profile</view>
            <view class="title-lg">{{ profileStore.nickname }}</view>
            <view class="muted"
              >单位 {{ profileStore.unit }} · 休息 {{ profileStore.restSeconds }}s</view
            >
          </view>
          <view class="glass-card profile__settings btn-press" @tap="openPage(routes.settings)"
            >⚿</view
          >
        </view>

        <view class="profile__stats">
          <view v-for="item in profileStats" :key="item.label" class="glass-card profile__stat">
            <view class="profile__stat-icon">{{ item.icon }}</view>
            <view class="profile__stat-value">{{ item.value }}</view>
            <view class="muted">{{ item.label }}</view>
          </view>
        </view>
      </view>

      <view class="section-label profile__section-label">功能</view>
      <view class="profile__menu">
        <view
          v-for="item in menuItems"
          :key="item.label"
          class="glass-card profile__menu-item btn-press"
          @tap="openPage(item.path)"
        >
          <view class="profile__menu-icon" :style="{ background: getToneBg(item.tone) }">{{
            item.icon
          }}</view>
          <view class="profile__menu-body">
            <view class="profile__menu-title">{{ item.label }}</view>
            <view class="profile__menu-sub">{{ item.sub }}</view>
          </view>
          <view class="profile__menu-arrow">›</view>
        </view>
      </view>

      <view class="section-label profile__section-label">其他</view>
      <view class="profile__menu">
        <view
          v-for="item in otherItems"
          :key="item.label"
          class="glass-card profile__menu-item btn-press"
          @tap="openPage(item.path)"
        >
          <view class="profile__menu-icon">{{ item.icon }}</view>
          <view class="profile__menu-body">
            <view class="profile__menu-title">{{ item.label }}</view>
          </view>
          <view class="profile__menu-arrow">›</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.profile {
  &__hero {
    padding: 12rpx 0 12rpx;
  }

  &__hero-top {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__avatar {
    width: 112rpx;
    height: 112rpx;
    border-radius: 32rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    font-weight: 700;
    box-shadow: 0 0 32rpx rgba(255, 80, 30, 0.32);
  }

  &__info {
    flex: 1;
  }

  &__settings {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__stat {
    padding: 22rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  &__stat-icon {
    font-size: 30rpx;
  }

  &__stat-value {
    font-size: 26rpx;
    font-weight: 700;
  }

  &__section-label {
    margin: 28rpx 0 16rpx;
  }

  &__menu {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__menu-item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 24rpx;
  }

  &__menu-icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__menu-body {
    flex: 1;
  }

  &__menu-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__menu-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__menu-arrow {
    color: #828296;
    font-size: 28rpx;
  }
}
</style>
